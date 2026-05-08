import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { settingsApi } from '../../services/api';
import { Settings } from '../../types';

interface SettingsState extends Settings {
  loading: boolean;
  error: string | null;
}

// ── Theme helpers ─────────────────────────────────────────────────────────────
// Wrapped in try/catch because localStorage can throw in certain private-browsing
// configurations. All callers must be safe against storage being unavailable.

function readThemeFromStorage(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('shopiq_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* storage unavailable */ }
  // Fall back to OS preference so first-time dark-mode users feel at home
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
}

function writeThemeToStorage(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem('shopiq_theme', theme);
  } catch { /* storage unavailable */ }
}

// Read ONCE at module-evaluation time (synchronous, before React renders).
// This value is what both the Redux initialState AND the anti-flash <script>
// in index.html agree on, so there is no flicker.
const bootTheme = readThemeFromStorage();

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: SettingsState = {
  storeName: 'ShopIQ Store',
  address: '',
  phone: '',
  email: '',
  taxRate: 10,
  currency: 'USD',
  currencySymbol: '$',
  receiptHeader: 'Thank you for shopping with us!',
  receiptFooter: 'Please come again.',
  taxId: '',
  showLogo: true,
  showTaxId: false,
  theme: bootTheme,   // ← initialized from localStorage, not hardcoded 'light'
  loading: false,
  error: null,
};

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  return await settingsApi.get();
});

export const saveSettings = createAsyncThunk(
  'settings/save',
  async (data: Partial<Settings>) => {
    return await settingsApi.update(data);
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
      // Write to localStorage immediately so the value survives a page reload.
      writeThemeToStorage(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        // localStorage is the authoritative theme source because:
        //   1. It is applied before React renders (see index.html script)
        //   2. It reflects the user's most recent explicit toggle
        //
        // We only fall back to the server's stored value if the user has no
        // local preference (e.g. first visit, cleared storage, different device).
        const localTheme = readThemeFromStorage();
        const theme: 'light' | 'dark' =
          localTheme ?? (action.payload.theme as 'light' | 'dark') ?? 'light';

        // Keep localStorage in sync with whatever we resolved
        writeThemeToStorage(theme);

        return { ...state, ...action.payload, theme, loading: false, error: null };
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load settings';
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        // If the server echoes back a theme (e.g. from the Settings page Save),
        // keep localStorage in sync so it reflects the just-persisted value.
        if (action.payload.theme) {
          writeThemeToStorage(action.payload.theme as 'light' | 'dark');
        }
        return { ...state, ...action.payload };
      });
  },
});

export const { setTheme } = settingsSlice.actions;
export default settingsSlice.reducer;
