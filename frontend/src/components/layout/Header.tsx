import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, Moon, Sun, User, LogOut, Zap, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { RootState, AppDispatch } from '../../store';
import { setTheme, saveSettings } from '../../store/slices/settingsSlice';
import { logoutUser } from '../../store/slices/authSlice';
import { authApi } from '../../services/api';
import Modal from '../ui/Modal';
import ProfileDrawer from '../ui/ProfileDrawer';

const pageTitles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/products':     'Products',
  '/checkout':     'Checkout',
  '/inventory':    'Inventory',
  '/transactions': 'Transactions',
  '/reports':      'Reports',
  '/settings':     'Settings',
  '/subscription': 'Subscription',
};

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export default function Header({ sidebarCollapsed }: HeaderProps) {
  const location = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch<AppDispatch>();
  const { theme, storeName } = useSelector((state: RootState) => state.settings);
  const { user }             = useSelector((state: RootState) => state.auth);

  const title = pageTitles[location.pathname] || 'ShopIQ';

  // ── Profile drawer state ──────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handlePasswordChanged = async () => {
    setDrawerOpen(false);
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  // ── Logout confirmation modal state ──────────────────────────────
  const [showLogoutModal,    setShowLogoutModal]    = useState(false);
  const [logoutPassword,     setLogoutPassword]     = useState('');
  const [showLogoutPassword, setShowLogoutPassword] = useState(false);
  const [logoutError,        setLogoutError]        = useState<string | null>(null);
  const [loggingOut,         setLoggingOut]         = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const openLogoutModal = () => {
    setLogoutPassword('');
    setLogoutError(null);
    setShowLogoutPassword(false);
    setShowLogoutModal(true);
    setTimeout(() => passwordRef.current?.focus(), 80);
  };

  const closeLogoutModal = () => {
    if (loggingOut) return;
    setShowLogoutModal(false);
    setLogoutPassword('');
    setLogoutError(null);
  };

  const handleConfirmLogout = async () => {
    if (!logoutPassword) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await authApi.verifyPassword(logoutPassword);
      // Password verified — proceed with logout
      setShowLogoutModal(false);
      await dispatch(logoutUser());
      navigate('/login', { replace: true });
    } catch (err: any) {
      setLogoutError(err.message || 'Incorrect password');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 z-10 transition-all duration-300 ${
          sidebarCollapsed ? 'left-16' : 'left-60'
        }`}
      >
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-xs text-gray-400">{storeName}</p>
        </div>

        <div className="flex items-center gap-2">
          {user?.plan === 'free' && (
            <button
              onClick={() => navigate('/subscription')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <Zap size={12} />
              Upgrade to Pro
            </button>
          )}

          <button
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              dispatch(setTheme(next));
              dispatch(saveSettings({ theme: next }));
            }}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative">
            <Bell size={18} />
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
            title="Account settings"
          >
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <User size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {user?.plan === 'free' ? 'Free Plan' : `${user?.plan?.replace('_', ' ')} Plan`}
              </p>
            </div>
          </button>

          <button
            onClick={openLogoutModal}
            title="Logout"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Profile / password-management drawer ─────────────────── */}
      <ProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPasswordChanged={handlePasswordChanged}
      />

      {/* ── Logout confirmation modal ─────────────────────────────── */}
      <Modal
        open={showLogoutModal}
        onClose={closeLogoutModal}
        title="Confirm Logout"
        size="sm"
      >
        <div className="space-y-4">
          {/* Icon + description */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1">
              To confirm logout, enter your account password below.
              This prevents unauthorized sign-outs.
            </p>
          </div>

          {/* Error banner */}
          {logoutError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-xs px-3 py-2.5 rounded-lg">
              {logoutError}
            </div>
          )}

          {/* Password input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Account password
            </label>
            <div className="relative">
              <input
                ref={passwordRef}
                type={showLogoutPassword ? 'text' : 'password'}
                value={logoutPassword}
                onChange={(e) => { setLogoutPassword(e.target.value); setLogoutError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && !loggingOut && handleConfirmLogout()}
                placeholder="Enter your password"
                className="w-full px-3 py-2.5 pr-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowLogoutPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showLogoutPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={closeLogoutModal}
              disabled={loggingOut}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLogout}
              disabled={loggingOut || !logoutPassword}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loggingOut
                ? <><Loader2 size={13} className="animate-spin" /> Verifying…</>
                : <><LogOut size={13} /> Sign Out</>}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
