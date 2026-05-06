import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../../types';

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
};

const active = (state: CartState) =>
  state.carts.find((c) => c.cartId === state.activeCartId);

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
    assignCustomer(
      state,
      action: PayloadAction<{ customerName: string; customerId?: string }>
    ) {
      const cart = active(state);
      if (cart) {
        cart.customerName = action.payload.customerName;
        cart.customerId = action.payload.customerId;
      }
    },
    addItem(state, action: PayloadAction<Product>) {
      const cart = active(state);
      if (!cart) return;
      const existing = cart.items.find((i) => i.product.id === action.payload.id);
      if (existing) {
        if (existing.quantity < existing.product.stock) existing.quantity += 1;
      } else {
        cart.items.push({ product: action.payload, quantity: 1 });
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      const cart = active(state);
      if (cart) cart.items = cart.items.filter((i) => i.product.id !== action.payload);
    },
    updateQuantity(
      state,
      action: PayloadAction<{ productId: string; quantity: number }>
    ) {
      const cart = active(state);
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
      const cart = active(state);
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
});

export const {
  addCart,
  removeCart,
  switchCart,
  assignCustomer,
  addItem,
  removeItem,
  updateQuantity,
  setDiscount,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
