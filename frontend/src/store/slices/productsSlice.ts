import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { productsApi } from '../../services/api';
import { Product } from '../../types';

interface ProductsState {
  items: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  categories: [],
  loading: false,
  error: null,
};

export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async (params?: { search?: string; category?: string }) => {
    return await productsApi.getAll(params);
  }
);

export const fetchCategories = createAsyncThunk('products/fetchCategories', async () => {
  return await productsApi.getCategories();
});

export const createProduct = createAsyncThunk(
  'products/create',
  async (data: Partial<Product>) => {
    return await productsApi.create(data);
  }
);

export const updateProduct = createAsyncThunk(
  'products/update',
  async ({ id, data }: { id: string; data: Partial<Product> }) => {
    return await productsApi.update(id, data);
  }
);

export const deleteProduct = createAsyncThunk('products/delete', async (id: string) => {
  await productsApi.remove(id);
  return id;
});

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch products';
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      });
  },
});

export default productsSlice.reducer;
