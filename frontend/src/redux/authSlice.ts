import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, Player } from '../types';

const initialState: AuthState = {
  token: localStorage.getItem('authToken'),
  player: localStorage.getItem('player') ? JSON.parse(localStorage.getItem('player')!) : null,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setAuth(state, action: PayloadAction<{ token: string; player: Player }>) {
      state.token = action.payload.token;
      state.player = action.payload.player;
      state.error = null;
      localStorage.setItem('authToken', action.payload.token);
      localStorage.setItem('player', JSON.stringify(action.payload.player));
    },
    logout(state) {
      state.token = null;
      state.player = null;
      state.error = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('player');
    }
  }
});

export const { setLoading, setError, setAuth, logout } = authSlice.actions;
export default authSlice.reducer;
