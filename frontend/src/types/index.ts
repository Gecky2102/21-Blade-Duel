import { ReactNode } from 'react';

export interface Player {
  id: string;
  username: string;
  level: number;
  xp: number;
  current_rating?: number;
}

export interface GameState {
  matchId: string;
  mode: 'casual' | 'friends';
  currentTurn: 'you' | 'opponent';
  yourCards: number[];
  yourTotal: number;
  opponentVisibleCard: number;
  opponentTotal?: number;
  gamePhase: 'lobby' | 'matchmaking' | 'countdown' | 'gameplay' | 'result';
  specialCards: string[];
  yourStanding: boolean;
  opponentStanding: boolean;
  opponentName?: string;
  turnDeadline?: number;
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

export interface AuthState {
  token: string | null;
  player: Player | null;
  loading: boolean;
  error: string | null;
}

export interface GameUIState {
  gameState: GameState | null;
  isSearching: boolean;
  error: string | null;
  countdownSeconds: number;
  result?: MatchResult | null;
}
