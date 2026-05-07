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
import ProBlurGate from './components/ui/ProBlurGate';
import { RootState, AppDispatch } from './store';
import { fetchSettings } from './store/slices/settingsSlice';
import { fetchProfile } from './store/slices/authSlice';
import { canAccessFeature } from './utils/featureAccess';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, checked } = useSelector((state: RootState) => state.auth);
  const theme = useSelector((state: RootState) => state.settings.theme);
  const plan = user?.plan;

  // Verify auth via cookie (no localStorage token)
  useEffect(() => {
    if (!checked) dispatch(fetchProfile());
  }, [checked, dispatch]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (user && checked) dispatch(fetchSettings());
  }, [user, checked, dispatch]);

  // Show nothing while we confirm auth status
  if (!checked) return null;

  const isAuthenticated = !!user;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />

        {/* Payment return pages — public, no layout */}
        <Route path="/payment/success" element={<PaymentReturn type="success" />} />
        <Route path="/payment/cancel"  element={<PaymentReturn type="failed" />} />

        {/* Protected POS app */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="products"     element={<Products />} />
          <Route path="checkout"     element={<Checkout />} />
          <Route path="inventory"    element={<Inventory />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />

          <Route path="transactions" element={
            <ProBlurGate locked={!canAccessFeature(plan, 'transactions')} feature="transactions" fullPage>
              <Transactions />
            </ProBlurGate>
          } />
          <Route path="reports" element={
            <ProBlurGate locked={!canAccessFeature(plan, 'reports')} feature="reports" fullPage>
              <Reports />
            </ProBlurGate>
          } />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
