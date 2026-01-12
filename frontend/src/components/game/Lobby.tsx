import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/authSlice';
import { playerAPI } from '../../services/api';
import GameBoard from './GameBoard';
import { initSocket, closeSocket, getSocket } from '../../services/socket';
import { setGameState, setSearching, setCountdown, setResult, resetGame } from '../../redux/gameSlice';
import { GameState, MatchResult } from '../../types';

export default function Lobby() {
  const dispatch = useDispatch();
  const { player, token } = useSelector((state: RootState) => state.auth);
  const { gameState, isSearching, countdownSeconds, result } = useSelector((state: RootState) => state.game);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'casual' | 'friends' | null>(null);
  const [challengeTarget, setChallengeTarget] = useState('');
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const socketReady = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await playerAPI.getStats();
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    if (!token || socketReady.current) return;
    const s = initSocket(token);
    socketReady.current = true;

    s.on('searching', () => dispatch(setSearching(true)));

    s.on('match_found', (data: any) => {
      dispatch(setSearching(false));
      const yourTotal = data.yourTotal ?? data.yourCards.reduce((a: number, b: number) => a + b, 0);
      const view: GameState = {
        matchId: data.matchId,
        mode: data.mode,
        currentTurn: data.startingTurn === 'player1' ? 'you' : 'opponent',
        yourCards: data.yourCards,
        yourTotal,
        opponentVisibleCard: data.opponentVisibleCard,
        opponentTotal: undefined,
        gamePhase: 'countdown',
        specialCards: [],
        yourStanding: false,
        opponentStanding: false,
        opponentName: data.opponent,
        turnDeadline: undefined
      };
      dispatch(setGameState(view));

      if (countdownTimer.current) clearInterval(countdownTimer.current);
      const computeCountdown = () => {
        const seconds = Math.max(0, Math.ceil((data.countdownStart - Date.now()) / 1000));
        dispatch(setCountdown(seconds));
      };
      computeCountdown();
      countdownTimer.current = setInterval(computeCountdown, 500);
    });

    s.on('game_update', (view: GameState) => {
      dispatch(setGameState({ ...view, gamePhase: view.gamePhase || 'gameplay' }));
      if (view.gamePhase === 'gameplay' && countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
    });

    s.on('match_ended', (res: MatchResult) => {
      dispatch(setResult(res));
      const current = gameStateRef.current;
      if (current) {
        const opponentTotal = res.loserId === player?.id ? res.winnerTotal : res.loserTotal;
        dispatch(setGameState({ ...current, gamePhase: 'result', opponentTotal, currentTurn: 'opponent' }));
      }
    });

    s.on('error', (payload: any) => {
      console.error('Socket error', payload);
      dispatch(setSearching(false));
    });

    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      socketReady.current = false;
      closeSocket();
      dispatch(resetGame());
    };
  }, [token, dispatch]);

  if (gameState && gameState.gamePhase !== 'lobby') {
    return <GameBoard />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden px-4 py-10">
      <div className="absolute inset-0 pointer-events-none opacity-60" style={{ background: 'radial-gradient(circle at 10% 20%, rgba(208,22,42,0.14), transparent 24%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(circle at 80% 0%, rgba(208,22,42,0.12), transparent 30%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(208,22,42,0.1) 0%, transparent 40%, rgba(208,22,42,0.06) 80%)' }} />

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center relative z-10">
        <div>
          <p className="text-sm tracking-[0.2em] uppercase text-red-400">Blood Arena</p>
          <h1 className="text-4xl font-bold hero-title">Blade Duel</h1>
          <p className="text-gray-400">Fast. Tense. Decisive.</p>
        </div>
        <button
          onClick={() => dispatch(logout())}
          className="px-6 py-2 rounded button-blood text-sm font-semibold"
        >
          Logout
        </button>
      </div>

      {/* Player Info */}
      <div className="max-w-5xl mx-auto mb-8 relative z-10">
        <div className="glass-panel rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{player?.username}</h2>
              <p className="text-gray-400">Level {player?.level}</p>
            </div>
            {stats && (
              <div className="text-right">
                <div className="text-3xl font-bold text-red-400">{(stats as any).current_rating || 1000}</div>
                <p className="text-gray-400 text-sm">Ranked Rating</p>
              </div>
            )}
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-lg holo-badge">
                <div className="text-xl font-bold">{(stats as any).casual_wins || 0}</div>
                <p className="text-sm">Casual Wins</p>
              </div>
              <div className="p-3 rounded-lg holo-badge">
                <div className="text-xl font-bold">{(stats as any).casual_losses || 0}</div>
                <p className="text-sm">Casual Losses</p>
              </div>
              <div className="p-3 rounded-lg holo-badge">
                <div className="text-xl font-bold">{(stats as any).ranked_wins || 0}</div>
                <p className="text-sm">Ranked Wins</p>
              </div>
              <div className="p-3 rounded-lg holo-badge">
                <div className="text-xl font-bold">{(stats as any).ranked_losses || 0}</div>
                <p className="text-sm">Ranked Losses</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Selection */}
      <div className="max-w-5xl mx-auto relative z-10 grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-white mb-4">Matchmaking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setMode('casual');
                dispatch(setResult(null));
                dispatch(setGameState(null));
                dispatch(setSearching(true));
                try {
                  getSocket().emit('join_queue', { mode: 'casual', token });
                } catch (err) {
                  console.error('Socket not ready', err);
                }
              }}
              className={`glass-panel rounded-xl p-8 text-left transition transform hover:-translate-y-1 hover:shadow-red-900/30 border border-red-800/30 ${isSearching && mode === 'casual' ? 'opacity-70' : ''}`}
            >
              <div className="text-2xl font-bold mb-2">🎮 Casual</div>
              <p className="text-sm text-gray-300">Fast queue, no ranks, full gore.</p>
            </button>

            <div className="glass-panel rounded-xl p-6 text-left border border-red-800/30">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-red-400">Challenge</div>
                  <p className="text-xs text-gray-400">Invite a specific foe</p>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  value={challengeTarget}
                  onChange={(e) => setChallengeTarget(e.target.value)}
                  placeholder="Opponent username"
                  className="w-full input-dark px-3 py-2 rounded"
                />
                <button
                  onClick={() => {
                    if (!challengeTarget) return;
                    setMode('friends');
                    dispatch(setResult(null));
                    dispatch(setGameState(null));
                    dispatch(setSearching(true));
                    try {
                      getSocket().emit('challenge_player', { token, targetUsername: challengeTarget });
                    } catch (err) {
                      console.error('Socket not ready', err);
                    }
                  }}
                  className="w-full button-blood py-2 rounded text-sm font-semibold"
                >
                  Send challenge
                </button>
              </div>
            </div>
          </div>
          {isSearching && (
            <p className="text-sm text-red-300 mt-3">Searching for opponent...</p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-6 border border-red-800/30">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-400">Battlepass</p>
              <h4 className="text-lg font-bold">Blood Tier</h4>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-300">Lv {player?.level ?? 1}</div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-2">Earn XP from matches to unlock card skins.</p>
          {player && (
            <div className="w-full bg-black/40 rounded h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-400"
                style={{ width: `${Math.min(100, ((player.xp ?? 0) % 1000) / 10)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">Next unlock: Crimson card skin.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-12 text-center text-gray-500 text-sm relative z-10">
        <p>⚔️ Bleed less than your foe. ⚔️</p>
        {countdownSeconds > 0 && gameState?.gamePhase === 'countdown' && (
          <p className="text-red-300 text-lg mt-2">Match starts in {countdownSeconds}s</p>
        )}
        {result && (
          <p className="text-red-300 text-sm mt-2">Winner: {result.winnerUsername}</p>
        )}
      </div>
    </div>
  );
}
