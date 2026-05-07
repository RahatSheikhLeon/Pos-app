import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const TOKEN_KEY = 'shopiq_token';

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  loading: false,
  error: null,
};

export const login = createAsyncThunk('auth/login', async (creds: { email: string; password: string }) => {
  return await authApi.login(creds.email, creds.password);
});

export const register = createAsyncThunk(
  'auth/register',
  async (data: { email: string; password: string; name: string }) => {
    return await authApi.register(data.email, data.password, data.name);
  }
);

export const fetchProfile = createAsyncThunk('auth/profile', async () => {
  return await authApi.profile();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    clearError(state) {
      state.error = null;
    },
    updatePlan(state, action: PayloadAction<string>) {
      if (state.user) state.user.plan = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem(TOKEN_KEY, action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(register.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem(TOKEN_KEY, action.payload.token);
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Registration failed';
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.user = null;
        state.token = null;
        localStorage.removeItem(TOKEN_KEY);
      });
  },
});

export const { logout, clearError, updatePlan } = authSlice.actions;
export default authSlice.reducer;
