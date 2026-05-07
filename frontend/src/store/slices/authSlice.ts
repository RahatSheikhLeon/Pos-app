import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';

// No token in localStorage — auth state lives in httpOnly cookie (backend)
// Redux holds only the user profile for UI rendering

interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  checked: boolean; // true once we have confirmed auth status with backend
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  checked: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string }) => {
    return await authApi.login(creds.email, creds.password);
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (data: { email: string; password: string; name: string }) => {
    return await authApi.register(data.email, data.password, data.name);
  }
);

export const fetchProfile = createAsyncThunk('auth/profile', async () => {
  return await authApi.profile();
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  return await authApi.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    updatePlan(state, action: PayloadAction<string>) {
      if (state.user) state.user.plan = action.payload;
    },
    setChecked(state) { state.checked = true; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state)  => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.checked = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(register.pending, (state)  => { state.loading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.checked = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Registration failed';
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.checked = true;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.user = null;
        state.checked = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.checked = true;
      });
  },
});

export const { clearError, updatePlan, setChecked } = authSlice.actions;
export default authSlice.reducer;
