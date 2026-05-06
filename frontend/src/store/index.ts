import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './slices/cartSlice';
import productsReducer from './slices/productsSlice';
import transactionsReducer from './slices/transactionsSlice';
import settingsReducer from './slices/settingsSlice';
import userReducer from './slices/userSlice';

const CART_STORAGE_KEY = 'shopiq_cart_v1';

function loadCartState() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    products: productsReducer,
    transactions: transactionsReducer,
    settings: settingsReducer,
    user: userReducer,
  },
  preloadedState: {
    cart: loadCartState(),
  },
});

// Debounced save — write cart state to localStorage on every Redux change
let saveTimer: ReturnType<typeof setTimeout>;
store.subscribe(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.getState().cart));
    } catch {
      // storage quota exceeded or private browsing — ignore silently
    }
  }, 300);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
