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
  const { token, user } = useSelector((state: RootState) => state.auth);
  const theme = useSelector((state: RootState) => state.settings.theme);

  useEffect(() => {
    if (token && !user) dispatch(fetchProfile());
  }, [token, user, dispatch]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (token && user) dispatch(fetchSettings());
  }, [token, user, dispatch]);

  const plan = user?.plan;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <Register />} />

        <Route path="/" element={token ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="inventory" element={<Inventory />} />

          {/* Pro-only full pages — show upgrade wall for free users */}
          <Route
            path="transactions"
            element={
              <ProBlurGate locked={!canAccessFeature(plan, 'transactions')} feature="transactions" fullPage>
                <Transactions />
              </ProBlurGate>
            }
          />
          <Route
            path="reports"
            element={
              <ProBlurGate locked={!canAccessFeature(plan, 'reports')} feature="reports" fullPage>
                <Reports />
              </ProBlurGate>
            }
          />

          <Route path="settings" element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>

        {/* Payment gateway return pages — outside layout, no auth guard */}
        <Route path="/payment/success" element={<PaymentReturn type="success" />} />
        <Route path="/payment/failed"  element={<PaymentReturn type="failed" />} />

        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
