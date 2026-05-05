import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../../types';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  customerEmail: string;
  customerPhone: string;
  discount: number;
}

const initialState: CartState = {
  items: [],
  customerEmail: '',
  customerPhone: '',
  discount: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<Product>) {
      const existing = state.items.find((i) => i.product.id === action.payload.id);
      if (existing) {
        if (existing.quantity < existing.product.stock) {
          existing.quantity += 1;
        }
      } else {
        state.items.push({ product: action.payload, quantity: 1 });
      }
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.product.id !== action.payload);
    },
    updateQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const item = state.items.find((i) => i.product.id === action.payload.productId);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.product.id !== action.payload.productId);
        } else {
          item.quantity = Math.min(action.payload.quantity, item.product.stock);
        }
      }
    },
    clearCart(state) {
      state.items = [];
      state.customerEmail = '';
      state.customerPhone = '';
      state.discount = 0;
    },
    setCustomer(state, action: PayloadAction<{ email?: string; phone?: string }>) {
      if (action.payload.email !== undefined) state.customerEmail = action.payload.email;
      if (action.payload.phone !== undefined) state.customerPhone = action.payload.phone;
    },
    setDiscount(state, action: PayloadAction<number>) {
      state.discount = action.payload;
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, setCustomer, setDiscount } =
  cartSlice.actions;
export default cartSlice.reducer;
