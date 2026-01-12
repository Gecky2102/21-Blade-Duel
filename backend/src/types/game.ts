// Special card types
export type SpecialCardType = 
  | 'OVERCLOCK'
  | 'SWAP'
  | 'JAM'
  | 'ECHO'
  | 'BURN'
  | 'BLOOD_DRAW'
  | 'EDGE'
  | 'GREED'
  | 'DISTURB'
  | 'FAKE_STAND'
  | 'DELAY'
  | 'DOUBLE_EDGE'
  | 'LAST_BREATH';

export const SPECIAL_CARDS: SpecialCardType[] = [
  'OVERCLOCK',
  'SWAP',
  'JAM',
  'ECHO',
  'BURN',
  'BLOOD_DRAW',
  'EDGE',
  'GREED',
  'DISTURB',
  'FAKE_STAND',
  'DELAY',
  'DOUBLE_EDGE',
  'LAST_BREATH'
];

export interface SpecialCard {
  type: SpecialCardType;
  used: boolean;
}

export interface PlayerHand {
  numberCards: number[];
  specialCards: SpecialCard[];
  total: number;
  standing: boolean;
  hasUsedLastBreath: boolean;
  hasUsedEdge: boolean;
  maxAllowed: number;
}

export interface GameState {
  matchId: string;
  mode: 'casual' | 'ranked' | 'friends';
  player1: {
    id: string;
    username: string;
    hand: PlayerHand;
    visibleCards: number[]; // Cards visible to opponent
  };
  player2: {
    id: string;
    username: string;
    hand: PlayerHand;
    visibleCards: number[];
  };
  currentTurn: 'player1' | 'player2';
  turnCount: number;
  gamePhase: 'matchmaking' | 'init' | 'countdown' | 'gameplay' | 'resolution';
  specialCardsInPlay: {
    [key: string]: boolean | number;
  };
  gameLog: GameAction[];
  turnDeadline?: number;
}

export interface GameAction {
  turn: number;
  player: 'player1' | 'player2';
  action: 'HIT' | 'STAND' | 'USE_SPECIAL' | 'BUST' | 'WIN';
  cardValue?: number;
  newTotal?: number;
  specialCard?: SpecialCardType;
  timestamp: number;
}

export interface MatchResult {
  matchId: string;
  winnerId: string;
  winnerUsername: string;
  loserId: string;
  loserUsername: string;
  winnerTotal: number;
  loserTotal: number;
  winnerCardCount: number;
  loserCardCount: number;
  mode: 'casual' | 'ranked' | 'friends';
  durationSeconds: number;
}
