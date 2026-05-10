import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';
import { getDeviceId } from '../../utils/deviceId';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  isAdmin?: boolean;
}

interface AuthState {
  user:         AuthUser | null;
  pendingEmail: string | null; // set after startRegistration, cleared after verify
  loading:      boolean;
  error:        string | null;
  checked:      boolean;
}

const initialState: AuthState = {
  user:         null,
  pendingEmail: null,
  loading:      false,
  error:        null,
  checked:      false,
};

export const startRegistration = createAsyncThunk(
  'auth/startRegistration',
  async (data: { email: string; password: string; name: string }) => {
    return await authApi.registerStart(data.email, data.password, data.name);
  }
);

export const verifyRegistration = createAsyncThunk(
  'auth/verifyRegistration',
  async (data: { email: string; otp: string }) => {
    return await authApi.registerVerify(data.email, data.otp, getDeviceId());
  }
);

export const resendRegistrationOtp = createAsyncThunk(
  'auth/resendRegistrationOtp',
  async (email: string) => {
    return await authApi.registerResend(email);
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string; fingerprint?: string }) => {
    return await authApi.login(creds.email, creds.password, creds.fingerprint);
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
    clearError(state)  { state.error = null; },
    clearPending(state) { state.pendingEmail = null; },
    updatePlan(state, action: PayloadAction<string>) {
      if (state.user) state.user.plan = action.payload;
    },
    setChecked(state) { state.checked = true; },
  },
  extraReducers: (builder) => {
    builder
      // startRegistration
      .addCase(startRegistration.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(startRegistration.fulfilled, (state, action) => {
        state.loading      = false;
        state.pendingEmail = action.payload.pendingEmail;
      })
      .addCase(startRegistration.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.error.message || 'Registration failed';
      })

      // verifyRegistration
      .addCase(verifyRegistration.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(verifyRegistration.fulfilled, (state, action) => {
        state.loading      = false;
        state.pendingEmail = null;
        state.user         = action.payload;
        state.checked      = true;
      })
      .addCase(verifyRegistration.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.error.message || 'Verification failed';
      })

      // resendRegistrationOtp — no state change beyond loading
      .addCase(resendRegistrationOtp.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(resendRegistrationOtp.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resendRegistrationOtp.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.error.message || 'Resend failed';
      })

      // login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
        state.checked = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.error.message || 'Login failed';
      })

      // profile
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user    = action.payload;
        state.checked = true;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.user    = null;
        state.checked = true;
      })

      // logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user    = null;
        state.checked = true;
      });
  },
});

export const { clearError, clearPending, updatePlan, setChecked } = authSlice.actions;
export default authSlice.reducer;
