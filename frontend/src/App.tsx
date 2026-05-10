import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Checkout from './pages/Checkout';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Login from './pages/Login';
import Register from './pages/Register';
import PaymentReturn from './pages/PaymentReturn';
import DeviceLimitReached from './pages/DeviceLimitReached';
import ForgotPassword from './pages/ForgotPassword';
import { RootState, AppDispatch } from './store';
import { fetchSettings } from './store/slices/settingsSlice';
import { fetchProfile } from './store/slices/authSlice';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, checked, deviceLimitReached } = useSelector((state: RootState) => state.auth);
  const theme = useSelector((state: RootState) => state.settings.theme);

  useEffect(() => {
    if (!checked) dispatch(fetchProfile());
  }, [checked, dispatch]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (user && checked && !deviceLimitReached) dispatch(fetchSettings());
  }, [user, checked, deviceLimitReached, dispatch]);

  if (!checked) return null;

  const isAuthenticated = !!user;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"           element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register"        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Payment return pages — public, no layout */}
        <Route path="/payment/success" element={<PaymentReturn type="success" />} />
        <Route path="/payment/cancel"  element={<PaymentReturn type="failed" />} />

        {/* Device limit page — requires auth, shown when over device limit */}
        <Route
          path="/device-limit"
          element={isAuthenticated ? <DeviceLimitReached /> : <Navigate to="/login" replace />}
        />

        {/* Protected POS app — redirect to /device-limit when over limit */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? (deviceLimitReached ? <Navigate to="/device-limit" replace /> : <Layout />)
              : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="products"     element={<Products />} />
          <Route path="checkout"     element={<Checkout />} />
          <Route path="inventory"    element={<Inventory />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="reports"      element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
