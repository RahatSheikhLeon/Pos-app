import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../../types';
import { cartsApi } from '../../services/api';

interface CartItem {
  product: Product;
  quantity: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  customerName: string;
  customerId?: string;
  discount: number;
}

interface CartState {
  carts: Cart[];
  activeCartId: string;
  loading: boolean;
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
};

const activeCart = (state: CartState) =>
  state.carts.find((c) => c.cartId === state.activeCartId);

// ── Async: fetch carts from backend (fallback when localStorage is empty) ──
export const fetchCarts = createAsyncThunk('cart/fetchAll', async () => {
  return await cartsApi.getAll();
});

// ── Async: background sync — push a cart to backend (fire-and-forget) ──
export const syncCart = createAsyncThunk('cart/sync', async (cart: Cart) => {
  return await cartsApi.upsert(cart.cartId, cart);
});

// ── Async: remove cart from backend ──
export const removeCartFromBackend = createAsyncThunk(
  'cart/removeFromBackend',
  async (cartId: string) => {
    await cartsApi.remove(cartId);
    return cartId;
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addCart(
      state,
      action: PayloadAction<{ customerName?: string; customerId?: string } | undefined>
    ) {
      if (state.carts.length >= 4) return;
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
    addItem(state, action: PayloadAction<Product>) {
      const cart = activeCart(state);
      if (!cart) return;
      const existing = cart.items.find((i) => i.product.id === action.payload.id);
      if (existing) {
        if (existing.quantity < existing.product.stock) existing.quantity += 1;
      } else {
        cart.items.push({ product: action.payload, quantity: 1 });
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      const cart = activeCart(state);
      if (cart) cart.items = cart.items.filter((i) => i.product.id !== action.payload);
    },
    updateQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const cart = activeCart(state);
      if (!cart) return;
      const item = cart.items.find((i) => i.product.id === action.payload.productId);
      if (item) {
        if (action.payload.quantity <= 0) {
          cart.items = cart.items.filter((i) => i.product.id !== action.payload.productId);
        } else {
          item.quantity = Math.min(action.payload.quantity, item.product.stock);
        }
      }
    },
    setDiscount(state, action: PayloadAction<number>) {
      const cart = activeCart(state);
      if (cart) cart.discount = action.payload;
    },
    clearCart(state, action: PayloadAction<string>) {
      if (action.payload === 'default') {
        const cart = state.carts.find((c) => c.cartId === 'default');
        if (cart) {
          cart.items = [];
          cart.customerName = 'Walk-in';
          cart.customerId = undefined;
          cart.discount = 0;
        }
      } else {
        state.carts = state.carts.filter((c) => c.cartId !== action.payload);
        if (state.activeCartId === action.payload) {
          state.activeCartId = state.carts[0]?.cartId ?? 'default';
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCarts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCarts.fulfilled, (state, action) => {
        state.loading = false;
        const backendCarts: Cart[] = action.payload ?? [];
        if (backendCarts.length === 0) return;

        const isEmptyDefault =
          state.carts.length === 1 &&
          state.carts[0].cartId === 'default' &&
          state.carts[0].items.length === 0 &&
          !state.carts[0].customerId;

        if (!isEmptyDefault) return; // localStorage has data — never override with backend

        // Only restore member-specific carts (those with a customerId).
        // The 'default' cart is intentionally excluded so a cleared default cart
        // can never be resurrected from the backend on reload.
        const memberCarts = backendCarts.filter((c) => c.customerId && c.cartId !== 'default');
        if (memberCarts.length > 0) {
          state.carts = [
            { cartId: 'default', items: [], customerName: 'Walk-in', discount: 0 },
            ...memberCarts,
          ];
          state.activeCartId = 'default';
        }
      })
      .addCase(fetchCarts.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const {
  addCart,
  removeCart,
  switchCart,
  addItem,
  removeItem,
  updateQuantity,
  setDiscount,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
