import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionsApi } from '../../services/api';
import { Transaction } from '../../types';

interface TransactionsState {
  items: Transaction[];
  totalRevenue: number;
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  items: [],
  totalRevenue: 0,
  loading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async (params?: { search?: string; dateFrom?: string; dateTo?: string }) => {
    return await transactionsApi.getAll(params);
  }
);

export const returnTransaction = createAsyncThunk(
  'transactions/return',
  async ({ id, items }: { id: string; items?: { productId: string; quantity: number }[] }) => {
    return await transactionsApi.returnTransaction(id, items);
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.transactions;
        state.totalRevenue = action.payload.totalRevenue;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch transactions';
      })
      .addCase(returnTransaction.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      });
  },
});

export default transactionsSlice.reducer;
