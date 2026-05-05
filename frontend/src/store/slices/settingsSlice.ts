import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { settingsApi } from '../../services/api';
import { Settings } from '../../types';

interface SettingsState extends Settings {
  loading: boolean;
  error: string | null;
}

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
  theme: 'light',
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
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        return { ...state, ...action.payload, theme: state.theme, loading: false, error: null };
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load settings';
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        return { ...state, ...action.payload };
      });
  },
});

export const { setTheme } = settingsSlice.actions;
export default settingsSlice.reducer;
