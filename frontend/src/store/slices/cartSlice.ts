import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../../types';
import { cartsApi, CartItemRow } from '../../services/api';
import { getCartLimit } from '../planLimits';
import { login, register, fetchProfile, updatePlan } from './authSlice';

interface CartItem {
  product: Product;
  quantity: number;
}

export interface Cart {
  cartId: string;       // "default" or "cart-{timestamp}"
  items: CartItem[];
  customerName: string;
  customerId?: string;
  discount: number;
}

interface CartState {
  carts: Cart[];
  activeCartId: string;
  loading: boolean;
  maxCarts: number;
}

const guestCart = (): Cart => ({
  cartId: 'default',
  items: [],
  customerName: 'Walk-in',
  discount: 0,
});

const initialState: CartState = {
  carts: [guestCart()],
  activeCartId: 'default',
  loading: false,
  maxCarts: 4,
};

// Rebuild the Redux cart array from flat per-item DB rows
function buildCartsFromRows(rows: CartItemRow[]): Cart[] {
  const sessionMap = new Map<string, CartItem[]>();

  for (const row of rows) {
    if (!row.product) continue;
    if (!sessionMap.has(row.sessionId)) sessionMap.set(row.sessionId, []);
    sessionMap.get(row.sessionId)!.push({
      product: row.product as Product,
      quantity: row.qty,
    });
  }

  // Always keep a default cart at index 0
  const defaultItems = sessionMap.get('default') ?? [];
  const result: Cart[] = [
    { cartId: 'default', items: defaultItems, customerName: 'Walk-in', discount: 0 },
  ];

  for (const [sessionId, items] of sessionMap.entries()) {
    if (sessionId === 'default') continue;
    result.push({ cartId: sessionId, items, customerName: 'Walk-in', discount: 0 });
  }

  return result;
}

// ── Async thunks ──────────────────────────────────────────────────────────────

// Load all cart items from MySQL and rebuild Redux state
export const fetchCarts = createAsyncThunk('cart/fetchAll', async () => {
  return await cartsApi.getAll();
});

// Add one unit of a product (optimistic UI + immediate DB write)
export const addItemToCart = createAsyncThunk(
  'cart/addItem',
  async (
    { product, sessionId }: { product: Product; sessionId: string },
    { rejectWithValue }
  ) => {
    try {
      return await cartsApi.addItem({
        productId: product.id,
        qty: 1,
        price: product.sellPrice,
        sessionId,
      });
    } catch (err: any) {
      return rejectWithValue(err.message ?? 'Failed to add item to cart');
    }
  }
);

// Set exact quantity for a cart item (optimistic UI + immediate DB write)
export const setItemQtyInCart = createAsyncThunk(
  'cart/setQty',
  async (
    { productId, qty, sessionId }: { productId: string; qty: number; sessionId: string },
    { rejectWithValue }
  ) => {
    try {
      // qty=0 → backend deletes the row; we handle Redux removal in pending
      if (qty <= 0) {
        await cartsApi.removeItem(productId, sessionId);
        return null;
      }
      return await cartsApi.setQty(productId, qty, sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message ?? 'Failed to update quantity');
    }
  }
);

// Remove a cart item entirely (optimistic UI + immediate DB write)
export const removeItemFromCart = createAsyncThunk(
  'cart/removeItem',
  async (
    { productId, sessionId }: { productId: string; sessionId: string },
    { rejectWithValue }
  ) => {
    try {
      await cartsApi.removeItem(productId, sessionId);
      return { productId, sessionId };
    } catch (err: any) {
      return rejectWithValue(err.message ?? 'Failed to remove item');
    }
  }
);

// Clear all items in a session and delete from DB (after checkout or close)
export const clearCartSession = createAsyncThunk(
  'cart/clearSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      await cartsApi.clearSession(sessionId);
      return sessionId;
    } catch (err: any) {
      return rejectWithValue(err.message ?? 'Failed to clear cart');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setMaxCarts(state, action: PayloadAction<number>) {
      state.maxCarts = action.payload;
    },
    addCart(
      state,
      action: PayloadAction<{ customerName?: string; customerId?: string } | undefined>
    ) {
      if (state.carts.length >= state.maxCarts) return;
      const cartId = `cart-${Date.now()}`;
      state.carts.push({
        cartId,
        items: [],
        customerName: action.payload?.customerName || 'Walk-in',
        customerId: action.payload?.customerId,
        discount: 0,
      });
      state.activeCartId = cartId;
    },
    removeCart(state, action: PayloadAction<string>) {
      if (action.payload === 'default') return;
      state.carts = state.carts.filter((c) => c.cartId !== action.payload);
      if (state.activeCartId === action.payload) {
        state.activeCartId = state.carts[0]?.cartId ?? 'default';
      }
    },
    switchCart(state, action: PayloadAction<string>) {
      if (state.carts.find((c) => c.cartId === action.payload)) {
        state.activeCartId = action.payload;
      }
    },
    setDiscount(state, action: PayloadAction<number>) {
      const cart = state.carts.find((c) => c.cartId === state.activeCartId);
      if (cart) cart.discount = action.payload;
    },
    setCustomer(
      state,
      action: PayloadAction<{ cartId: string; customerName: string; customerId: string }>
    ) {
      const cart = state.carts.find((c) => c.cartId === action.payload.cartId);
      if (cart) {
        cart.customerName = action.payload.customerName;
        cart.customerId = action.payload.customerId;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchCarts: reload entire cart state from MySQL ───────────
      .addCase(fetchCarts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCarts.fulfilled, (state, action) => {
        state.loading = false;
        const rows: CartItemRow[] = action.payload ?? [];
        const rebuilt = buildCartsFromRows(rows);
        // Preserve customer assignments from current in-memory state
        for (const rebuilt_cart of rebuilt) {
          const existing = state.carts.find((c) => c.cartId === rebuilt_cart.cartId);
          if (existing) {
            rebuilt_cart.customerName = existing.customerName;
            rebuilt_cart.customerId = existing.customerId;
            rebuilt_cart.discount = existing.discount;
          }
        }
        state.carts = rebuilt;
        if (!state.carts.find((c) => c.cartId === state.activeCartId)) {
          state.activeCartId = 'default';
        }
      })
      .addCase(fetchCarts.rejected, (state) => {
        state.loading = false;
      })

      // ── addItemToCart: optimistic add → revert on failure ─────────
      .addCase(addItemToCart.pending, (state, action) => {
        const { product, sessionId } = action.meta.arg;
        const cart = state.carts.find((c) => c.cartId === sessionId);
        if (!cart) return;
        const existing = cart.items.find((i) => i.product.id === product.id);
        if (existing) {
          if (existing.quantity < existing.product.stock) existing.quantity += 1;
        } else {
          cart.items.push({ product, quantity: 1 });
        }
      })
      .addCase(addItemToCart.rejected, (state, action) => {
        // Revert optimistic add
        const { product, sessionId } = action.meta.arg;
        const cart = state.carts.find((c) => c.cartId === sessionId);
        if (!cart) return;
        const idx = cart.items.findIndex((i) => i.product.id === product.id);
        if (idx !== -1) {
          if (cart.items[idx].quantity > 1) cart.items[idx].quantity -= 1;
          else cart.items.splice(idx, 1);
        }
      })

      // ── setItemQtyInCart: optimistic update → no rollback (refetch handles it) ──
      .addCase(setItemQtyInCart.pending, (state, action) => {
        const { productId, qty, sessionId } = action.meta.arg;
        const cart = state.carts.find((c) => c.cartId === sessionId);
        if (!cart) return;
        if (qty <= 0) {
          cart.items = cart.items.filter((i) => i.product.id !== productId);
        } else {
          const item = cart.items.find((i) => i.product.id === productId);
          if (item) item.quantity = Math.min(qty, item.product.stock);
        }
      })

      // ── removeItemFromCart: optimistic remove ──────────────────────
      .addCase(removeItemFromCart.pending, (state, action) => {
        const { productId, sessionId } = action.meta.arg;
        const cart = state.carts.find((c) => c.cartId === sessionId);
        if (cart) cart.items = cart.items.filter((i) => i.product.id !== productId);
      })

      // ── clearCartSession: optimistic clear ────────────────────────
      .addCase(clearCartSession.pending, (state, action) => {
        const sessionId = action.meta.arg;
        if (sessionId === 'default') {
          const cart = state.carts.find((c) => c.cartId === 'default');
          if (cart) {
            cart.items = [];
            cart.customerName = 'Walk-in';
            cart.customerId = undefined;
            cart.discount = 0;
          }
        } else {
          state.carts = state.carts.filter((c) => c.cartId !== sessionId);
          if (state.activeCartId === sessionId) {
            state.activeCartId = state.carts[0]?.cartId ?? 'default';
          }
        }
      })

      // ── plan limit: sync maxCarts from auth events ─────────────────
      .addCase(login.fulfilled, (state, action) => {
        state.maxCarts = getCartLimit(action.payload?.plan);
      })
      .addCase(register.fulfilled, (state, action) => {
        state.maxCarts = getCartLimit(action.payload?.plan);
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.maxCarts = getCartLimit(action.payload?.plan);
      })
      .addCase(updatePlan, (state, action) => {
        state.maxCarts = getCartLimit(action.payload);
      });
  },
});

export const {
  setMaxCarts,
  addCart,
  removeCart,
  switchCart,
  setDiscount,
  setCustomer,
} = cartSlice.actions;

export default cartSlice.reducer;
