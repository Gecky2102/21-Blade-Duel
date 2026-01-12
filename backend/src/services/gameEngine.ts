import { randomInt } from 'crypto';
import { SpecialCardType, SPECIAL_CARDS, GameState, PlayerHand } from '../types/game';

export class GameEngine {
  static generateNumberCard(): number {
    return randomInt(1, 12); // 1 to 11
  }

  static generateSpecialCard(): SpecialCardType {
    return SPECIAL_CARDS[randomInt(0, SPECIAL_CARDS.length)];
  }

  static createInitialHand(): PlayerHand {
    return {
      numberCards: [this.generateNumberCard(), this.generateNumberCard()],
      specialCards: [],
      total: 0,
      standing: false,
      hasUsedLastBreath: false,
      hasUsedEdge: false,
      maxAllowed: 21
    };
  }

  static calculateTotal(cards: number[]): number {
    return cards.reduce((sum, card) => sum + card, 0);
  }

  static drawNumberCard(hand: PlayerHand): void {
    const newCard = this.generateNumberCard();
    hand.numberCards.push(newCard);
    hand.total = this.calculateTotal(hand.numberCards);
  }

  static grantSpecialCard(hand: PlayerHand): void {
    if (hand.specialCards.length < 5) {
      hand.specialCards.push({
        type: this.generateSpecialCard(),
        used: false
      });
    }
  }

  static useSpecialCard(hand: PlayerHand, cardType: SpecialCardType): boolean {
    const cardIndex = hand.specialCards.findIndex(c => c.type === cardType && !c.used);
    if (cardIndex === -1) return false;

    hand.specialCards[cardIndex].used = true;
    return true;
  }

  static checkBust(total: number, maxAllowed: number, hasLastBreath: boolean): boolean {
    if (total > maxAllowed) {
      if (hasLastBreath && total === maxAllowed + 1) {
        return false; // Last Breath saves from +1 over
      }
      return true;
    }
    return false;
  }

  static applySpecialCardEffect(gameState: GameState, playerId: 'player1' | 'player2', cardType: SpecialCardType): void {
    const player = gameState[playerId];
    const opponent = playerId === 'player1' ? gameState.player2 : gameState.player1;

    switch (cardType) {
      case 'OVERCLOCK':
        player.hand.maxAllowed = 24;
        break;
      case 'JAM':
        gameState.specialCardsInPlay['JAM_' + (playerId === 'player1' ? 'PLAYER2' : 'PLAYER1')] = true;
        break;
      case 'BURN':
        if (player.hand.numberCards.length > 0) {
          player.hand.numberCards.pop();
          player.hand.numberCards.push(this.generateNumberCard());
          player.hand.total = this.calculateTotal(player.hand.numberCards);
        }
        break;
      case 'ECHO':
        if (player.hand.numberCards.length > 0) {
          const lastCard = player.hand.numberCards[player.hand.numberCards.length - 1];
          player.hand.numberCards.push(lastCard);
          player.hand.total = this.calculateTotal(player.hand.numberCards);
        }
        break;
      case 'EDGE':
        gameState.specialCardsInPlay['EDGE_' + playerId.toUpperCase()] = true;
        break;
      case 'DISTURB':
        const variance = (Math.random() > 0.5 ? 1 : -1) * randomInt(1, 3);
        gameState.specialCardsInPlay['DISTURB_' + playerId.toUpperCase()] = player.hand.total + variance;
        break;
      case 'LAST_BREATH':
        player.hand.hasUsedLastBreath = true;
        break;
      case 'DOUBLE_EDGE':
        gameState.specialCardsInPlay['DOUBLE_EDGE_' + playerId.toUpperCase()] = true;
        break;
    }
  }

  static compareHands(
    player1Total: number,
    player2Total: number,
    player1CardCount: number,
    player2CardCount: number
  ): 'player1' | 'player2' | 'tie' {
    if (player1Total > player2Total) return 'player1';
    if (player2Total > player1Total) return 'player2';

    // Same total, check card count
    if (player1CardCount < player2CardCount) return 'player1';
    if (player2CardCount < player1CardCount) return 'player2';

    // Tied
    return 'tie';
  }
}
