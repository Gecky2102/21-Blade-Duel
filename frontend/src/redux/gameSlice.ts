import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GameUIState, GameState, MatchResult } from '../types';

const initialState: GameUIState = {
  gameState: null,
  isSearching: false,
  error: null,
  countdownSeconds: 3,
  result: null
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameState(state, action: PayloadAction<GameState | null>) {
      state.gameState = action.payload;
    },
    setSearching(state, action: PayloadAction<boolean>) {
      state.isSearching = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setCountdown(state, action: PayloadAction<number>) {
      state.countdownSeconds = action.payload;
    },
    setResult(state, action: PayloadAction<MatchResult | null>) {
      state.result = action.payload;
    },
    resetGame(state) {
      state.gameState = null;
      state.isSearching = false;
      state.error = null;
      state.result = null;
    }
  }
});

export const { setGameState, setSearching, setError, setCountdown, setResult, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
