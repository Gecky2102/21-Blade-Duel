import { Server as SocketIOServer, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { GameEngine } from './gameEngine';
import { GameState, GameAction, SpecialCardType, MatchResult } from '../types/game';
import { redisService } from './redis';
import { queries } from './database';
import { AuthService } from './auth';

export class GameManager {
  private io: SocketIOServer;
  private matchmaking: Map<string, 'casual' | 'ranked'> = new Map();
  private activePlayers: Map<string, string> = new Map(); // playerId -> matchId
  private playerSockets: Map<string, string> = new Map(); // playerId -> socketId
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private static TURN_TIMEOUT_MS = 20000;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  initializeSocket(socket: Socket) {
    // register player room using handshake token
    const authToken = (socket.handshake as any)?.auth?.token;
    if (authToken) {
      const payload = AuthService.verifyToken(authToken);
      if (payload) {
        this.playerSockets.set(payload.playerId, socket.id);
        socket.join(`player:${payload.playerId}`);
      }
    }

    socket.on('join_queue', (data) => this.handleJoinQueue(socket, data));
    socket.on('game_action', (data) => this.handleGameAction(socket, data));
    socket.on('leave_match', (data) => this.handleLeaveMatch(socket, data));
    socket.on('challenge_player', (data) => this.handleChallengePlayer(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  private async handleJoinQueue(socket: Socket, data: { mode: 'casual' | 'ranked'; token: string }) {
    try {
      const payload = AuthService.verifyToken(data.token);
      if (!payload) {
        socket.emit('error', { message: 'Invalid token' });
        return;
      }

      const player = await queries.getPlayerById(payload.playerId);
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      const queueLength = await redisService.getQueueLength(data.mode);

      // If no one is waiting and mode is casual, spin up a bot immediately
      if (queueLength === 0 && data.mode === 'casual') {
        this.matchmaking.set(payload.playerId, data.mode);
        await this.createBotMatch(socket, player, 'casual');
        return;
      }

      this.matchmaking.set(payload.playerId, data.mode);
      await redisService.addToQueue(data.mode, payload.playerId, payload.username, player.current_rating);

      // Try to find a match
      const pair = await redisService.getMatchmakingPair(data.mode);
      if (pair) {
        const [p1, p2] = pair;
        await this.createMatch(socket, p1, p2, data.mode);
      } else {
        socket.emit('searching', { message: 'Searching for opponent...' });
        socket.join(`queue:${data.mode}`);
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to join queue' });
    }
  }

  private async createBotMatch(socket: Socket, player: any, mode: 'casual') {
    try {
      const bot = await queries.ensureBotPlayer();
      const matchId = await queries.createMatch(player.id, bot.id, mode);

      const gameState: GameState = {
        matchId,
        mode,
        player1: {
          id: player.id,
          username: player.username,
          hand: GameEngine.createInitialHand(),
          visibleCards: []
        },
        player2: {
          id: bot.id,
          username: 'A.I. Sever',
          hand: GameEngine.createInitialHand(),
          visibleCards: []
        },
        currentTurn: Math.random() > 0.5 ? 'player1' : 'player2',
        turnCount: 0,
        gamePhase: 'countdown',
        specialCardsInPlay: {},
        gameLog: []
      };

      gameState.player1.hand.total = GameEngine.calculateTotal(gameState.player1.hand.numberCards);
      gameState.player2.hand.total = GameEngine.calculateTotal(gameState.player2.hand.numberCards);
      gameState.player1.visibleCards = [gameState.player2.hand.numberCards[0]];
      gameState.player2.visibleCards = [gameState.player1.hand.numberCards[0]];

      await redisService.storeGameState(matchId, gameState);
      await redisService.setPlayerMatchId(player.id, matchId);

      this.activePlayers.set(player.id, matchId);

      this.joinMatchRoom(player.id, matchId);

      const countdownStart = Date.now() + 1500;

      this.io.to(`player:${player.id}`).emit('match_found', {
        matchId,
        mode: 'casual',
        opponent: gameState.player2.username,
        yourCards: gameState.player1.hand.numberCards,
        yourTotal: gameState.player1.hand.total,
        opponentVisibleCard: gameState.player1.visibleCards[0],
        startingTurn: gameState.currentTurn,
        countdownStart
      });

      setTimeout(() => this.startMatch(matchId), 1500);
    } catch (error) {
      console.error('Failed to create bot match', error);
      socket.emit('error', { message: 'Failed to create bot match' });
    }
  }

  private async createMatch(socket: Socket, player1: any, player2: any, mode: 'casual' | 'ranked' | 'friends') {
    try {
      const matchId = await queries.createMatch(player1.playerId, player2.playerId, mode);
      
      // Create initial game state
      const gameState: GameState = {
        matchId,
        mode,
        player1: {
          id: player1.playerId,
          username: player1.username,
          hand: GameEngine.createInitialHand(),
          visibleCards: []
        },
        player2: {
          id: player2.playerId,
          username: player2.username,
          hand: GameEngine.createInitialHand(),
          visibleCards: []
        },
        currentTurn: Math.random() > 0.5 ? 'player1' : 'player2',
        turnCount: 0,
        gamePhase: 'init',
        specialCardsInPlay: {},
        gameLog: []
      };

      // Set initial totals
      gameState.player1.hand.total = GameEngine.calculateTotal(gameState.player1.hand.numberCards);
      gameState.player2.hand.total = GameEngine.calculateTotal(gameState.player2.hand.numberCards);

      // Store visible cards (each player sees only one opponent card)
      gameState.player1.visibleCards = [gameState.player2.hand.numberCards[0]];
      gameState.player2.visibleCards = [gameState.player1.hand.numberCards[0]];

      // Countdown phase
      gameState.gamePhase = 'countdown';

      await redisService.storeGameState(matchId, gameState);
      await redisService.setPlayerMatchId(player1.playerId, matchId);
      await redisService.setPlayerMatchId(player2.playerId, matchId);

      this.activePlayers.set(player1.playerId, matchId);
      this.activePlayers.set(player2.playerId, matchId);

      // Join match room
      this.joinMatchRoom(player1.playerId, matchId);
      this.joinMatchRoom(player2.playerId, matchId);

      const countdownStart = Date.now() + 3000;

      // Notify both players
      this.io.to(`player:${player1.playerId}`).emit('match_found', {
        matchId,
        mode,
        opponent: player2.username,
        yourCards: gameState.player1.hand.numberCards,
        yourTotal: gameState.player1.hand.total,
        opponentVisibleCard: gameState.player1.visibleCards[0],
        startingTurn: gameState.currentTurn,
        countdownStart
      });

      this.io.to(`player:${player2.playerId}`).emit('match_found', {
        matchId,
        mode,
        opponent: player1.username,
        yourCards: gameState.player2.hand.numberCards,
        yourTotal: gameState.player2.hand.total,
        opponentVisibleCard: gameState.player2.visibleCards[0],
        startingTurn: gameState.currentTurn,
        countdownStart
      });

      // Start match after countdown
      setTimeout(() => this.startMatch(matchId), 3000);
    } catch (error) {
      console.error('Failed to create match:', error);
      socket.emit('error', { message: 'Failed to create match' });
    }
  }

  private async startMatch(matchId: string) {
    const gameState = await redisService.getGameState(matchId);
    if (!gameState) return;

    gameState.gamePhase = 'gameplay';

    // Grant first special card to starting player
    const currentPlayer = gameState[gameState.currentTurn];
    GameEngine.grantSpecialCard(currentPlayer.hand);

    await this.scheduleTurnTimer(gameState, matchId);
    await this.emitStateToPlayers(gameState, matchId, true);
    await this.maybeHandleBotTurn(gameState, matchId);
  }

  private async handleGameAction(socket: Socket, data: {
    matchId: string;
    token: string;
    action: 'HIT' | 'STAND' | 'USE_SPECIAL';
    specialCard?: SpecialCardType;
  }) {
    try {
      const gameState = await redisService.getGameState(data.matchId);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const payload = AuthService.verifyToken(data.token);
      const isBotTurn = gameState[gameState.currentTurn].username === 'A.I. Sever';
      const actingPlayerId = payload?.playerId || (isBotTurn ? gameState[gameState.currentTurn].id : null);

      if (!actingPlayerId) {
        socket.emit('error', { message: 'Invalid token' });
        return;
      }

      const isPlayer1 = gameState.player1.id === actingPlayerId;
      const isPlayer2 = gameState.player2.id === actingPlayerId;

      if (!isPlayer1 && !isPlayer2) {
        socket.emit('error', { message: 'Not in this game' });
        return;
      }

      const playerKey = isPlayer1 ? 'player1' : 'player2';
      if (gameState.currentTurn !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      const player = gameState[playerKey];
      const opponent = gameState[playerKey === 'player1' ? 'player2' : 'player1'];

      let actionResult = null;

      if (data.action === 'HIT') {
        GameEngine.drawNumberCard(player.hand);
        
        // Log action
        await queries.logAction(
          data.matchId,
          gameState.turnCount,
          actingPlayerId,
          'HIT',
          player.hand.numberCards[player.hand.numberCards.length - 1],
          player.hand.total
        );

        // Log in-memory
        gameState.gameLog.push({
          turn: gameState.turnCount,
          player: playerKey,
          action: 'HIT',
          cardValue: player.hand.numberCards[player.hand.numberCards.length - 1],
          newTotal: player.hand.total,
          timestamp: Date.now()
        } as GameAction);

        // Check if bust
        if (GameEngine.checkBust(player.hand.total, player.hand.maxAllowed, player.hand.hasUsedLastBreath)) {
          await this.endMatch(gameState, isPlayer1 ? 'player2' : 'player1', data.matchId);
          return;
        }

        actionResult = {
          action: 'HIT',
          playerTotal: player.hand.total,
          cardDrawn: player.hand.numberCards[player.hand.numberCards.length - 1]
        };
      } else if (data.action === 'STAND') {
        player.hand.standing = true;

        await queries.logAction(data.matchId, gameState.turnCount, actingPlayerId, 'STAND', undefined, player.hand.total);

        gameState.gameLog.push({
          turn: gameState.turnCount,
          player: playerKey,
          action: 'STAND',
          newTotal: player.hand.total,
          timestamp: Date.now()
        } as GameAction);

        // Check if both players standing
        if (opponent.hand.standing) {
          // End match with comparison
          const comparison = GameEngine.compareHands(
            player.hand.total,
            opponent.hand.total,
            player.hand.numberCards.length,
            opponent.hand.numberCards.length
          );

          let winnerKey: 'player1' | 'player2';
          if (comparison === 'tie') {
            winnerKey = Math.random() > 0.5 ? 'player1' : 'player2';
          } else {
            winnerKey = comparison;
          }

          await this.endMatch(gameState, winnerKey, data.matchId);
          return;
        }

        actionResult = {
          action: 'STAND',
          playerTotal: player.hand.total
        };
      } else if (data.action === 'USE_SPECIAL') {
        if (data.specialCard && GameEngine.useSpecialCard(player.hand, data.specialCard)) {
          GameEngine.applySpecialCardEffect(gameState, playerKey, data.specialCard);

          await queries.logAction(
            data.matchId,
            gameState.turnCount,
            actingPlayerId,
            'USE_SPECIAL',
            undefined,
            player.hand.total,
            data.specialCard
          );

          gameState.gameLog.push({
            turn: gameState.turnCount,
            player: playerKey,
            action: 'USE_SPECIAL',
            newTotal: player.hand.total,
            specialCard: data.specialCard,
            timestamp: Date.now()
          } as GameAction);

          actionResult = {
            action: 'USE_SPECIAL',
            specialCard: data.specialCard,
            playerTotal: player.hand.total
          };
        }
      }

      // Switch turn and grant next special card
      gameState.currentTurn = playerKey === 'player1' ? 'player2' : 'player1';
      gameState.turnCount++;
      const nextPlayer = gameState[gameState.currentTurn];
      GameEngine.grantSpecialCard(nextPlayer.hand);

      await this.scheduleTurnTimer(gameState, data.matchId);
      await this.emitStateToPlayers(gameState, data.matchId, true);
      await this.maybeHandleBotTurn(gameState, data.matchId);

    } catch (error) {
      console.error('Game action error:', error);
      socket.emit('error', { message: 'Action failed' });
    }
  }

  private async endMatch(gameState: GameState, winner: 'player1' | 'player2', matchId: string) {
    const loser = winner === 'player1' ? 'player2' : 'player1';
    const winnerId = gameState[winner].id;
    const loserId = gameState[loser].id;
    const duration = Math.floor((Date.now() - gameState.gameLog[0]?.timestamp) / 1000) || 0;

    await queries.finishMatch(
      matchId,
      winnerId,
      gameState.player1.hand.total,
      gameState.player2.hand.total,
      gameState.player1.hand.numberCards.length,
      gameState.player2.hand.numberCards.length,
      duration
    );

    // Update stats
    await queries.updatePlayerStats(winnerId, gameState.mode as any, true);
    await queries.updatePlayerStats(loserId, gameState.mode as any, false);

    // Award XP
    const player1 = await queries.getPlayerById(gameState.player1.id);
    const player2 = await queries.getPlayerById(gameState.player2.id);

    gameState.gamePhase = 'resolution';
    await redisService.storeGameState(matchId, gameState);

    const result: MatchResult = {
      matchId,
      winnerId,
      winnerUsername: gameState[winner].username,
      loserId,
      loserUsername: gameState[loser].username,
      winnerTotal: gameState[winner].hand.total,
      loserTotal: gameState[loser].hand.total,
      winnerCardCount: gameState[winner].hand.numberCards.length,
      loserCardCount: gameState[loser].hand.numberCards.length,
      mode: gameState.mode,
      durationSeconds: duration
    };

    this.io.to(`match:${matchId}`).emit('match_ended', result);

    await this.emitStateToPlayers(gameState, matchId, true);

    // Cleanup
    await redisService.removeGameState(matchId);
    await redisService.removePlayerMatchId(gameState.player1.id);
    await redisService.removePlayerMatchId(gameState.player2.id);
    this.activePlayers.delete(gameState.player1.id);
    this.activePlayers.delete(gameState.player2.id);
    const timer = this.turnTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(matchId);
    }
  }

  private handleLeaveMatch(socket: Socket, data: { matchId: string; token: string }) {
    const payload = AuthService.verifyToken(data.token);
    if (payload) {
      const matchId = this.activePlayers.get(payload.playerId);
      if (matchId) {
        this.endMatchOnForfeit(matchId, payload.playerId);
      }
      this.activePlayers.delete(payload.playerId);
      socket.leave(`match:${data.matchId}`);
    }
  }

  private handleDisconnect(socket: Socket) {
    // Cleanup mapping and forfeit
    for (const [playerId, sockId] of this.playerSockets.entries()) {
      if (sockId === socket.id) {
        const matchId = this.activePlayers.get(playerId);
        if (matchId) {
          this.endMatchOnForfeit(matchId, playerId);
        }
        this.playerSockets.delete(playerId);
      }
    }
  }

  private async handleChallengePlayer(socket: Socket, data: { token: string; targetUsername: string }) {
    try {
      const payload = AuthService.verifyToken(data.token);
      if (!payload) {
        socket.emit('error', { message: 'Invalid token' });
        return;
      }

      const challenger = await queries.getPlayerById(payload.playerId);
      const target = await queries.getPlayerByUsername(data.targetUsername);
      if (!target) {
        socket.emit('error', { message: 'Target not found' });
        return;
      }

      if (this.activePlayers.has(target.id)) {
        socket.emit('error', { message: 'Target already in match' });
        return;
      }

      const targetSocketId = this.playerSockets.get(target.id);
      if (!targetSocketId) {
        socket.emit('error', { message: 'Target not online' });
        return;
      }

      await this.createMatch(socket, {
        playerId: challenger.id,
        username: challenger.username,
        rating: challenger.current_rating || 1000
      }, {
        playerId: target.id,
        username: target.username,
        rating: target.current_rating || 1000
      }, 'friends');
    } catch (error) {
      console.error('Challenge failed', error);
      socket.emit('error', { message: 'Failed to challenge player' });
    }
  }

  private async endMatchOnForfeit(matchId: string, forfeitingPlayerId: string) {
    const gameState = await redisService.getGameState(matchId);
    if (!gameState) return;
    const winner = gameState.player1.id === forfeitingPlayerId ? 'player2' : 'player1';
    await this.endMatch(gameState, winner, matchId);
  }

  private joinMatchRoom(playerId: string, matchId: string) {
    const socketId = this.playerSockets.get(playerId);
    if (socketId) {
      const s = this.io.sockets.sockets.get(socketId);
      if (s) {
        s.join(`match:${matchId}`);
      }
    }
  }

  private async emitStateToPlayers(gameState: GameState, matchId: string, revealTotals = false) {
    const buildView = (perspective: 'player1' | 'player2') => {
      const you = gameState[perspective];
      const opp = perspective === 'player1' ? gameState.player2 : gameState.player1;
      return {
        matchId,
        mode: gameState.mode,
        gamePhase: gameState.gamePhase,
        currentTurn: gameState.currentTurn === perspective ? 'you' : 'opponent',
        yourCards: you.hand.numberCards,
        yourTotal: you.hand.total,
        yourStanding: you.hand.standing,
        opponentVisibleCard: opp.visibleCards[0],
        opponentTotal: revealTotals ? opp.hand.total : opp.hand.total,
        opponentStanding: opp.hand.standing,
        specialCards: you.hand.specialCards.map(c => c.type),
        opponentName: opp.username,
        turnDeadline: gameState.turnDeadline
      };
    };

    this.io.to(`player:${gameState.player1.id}`).emit('game_update', buildView('player1'));
    this.io.to(`player:${gameState.player2.id}`).emit('game_update', buildView('player2'));
  }

  private async scheduleTurnTimer(gameState: GameState, matchId: string) {
    const existing = this.turnTimers.get(matchId);
    if (existing) {
      clearTimeout(existing);
    }

    gameState.turnDeadline = Date.now() + GameManager.TURN_TIMEOUT_MS;
    await redisService.storeGameState(matchId, gameState);

    const expectedTurn = gameState.currentTurn;
    const timeout = setTimeout(async () => {
      const state = await redisService.getGameState(matchId);
      if (!state) return;
      if (state.currentTurn !== expectedTurn) return;
      const winner = expectedTurn === 'player1' ? 'player2' : 'player1';
      await this.endMatch(state, winner, matchId);
    }, GameManager.TURN_TIMEOUT_MS);

    this.turnTimers.set(matchId, timeout);
  }

  private async maybeHandleBotTurn(gameState: GameState, matchId: string) {
    const currentKey = gameState.currentTurn;
    const current = gameState[currentKey];
    if (current.username !== 'A.I. Sever') return;

    setTimeout(async () => {
      const state = await redisService.getGameState(matchId);
      if (!state) return;
      if (state.currentTurn !== currentKey) return;

      const botHand = state[currentKey].hand;
      const total = botHand.total;
      let action: 'HIT' | 'STAND';

      if (total <= 16) {
        action = 'HIT';
      } else if (total <= 18) {
        const oppVisible = state[currentKey === 'player1' ? 'player2' : 'player1'].visibleCards[0] || 0;
        action = oppVisible >= 9 ? 'HIT' : 'STAND';
      } else {
        action = 'STAND';
      }

      const socketId = this.playerSockets.get(state[currentKey].id);
      const fakeSocket: any = { emit: () => {}, id: socketId };
      await this.handleGameAction(fakeSocket as Socket, {
        matchId,
        token: '',
        action
      } as any);
    }, 800);
  }
}
