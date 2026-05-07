import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, Moon, Sun, User, LogOut, Zap } from 'lucide-react';
import { RootState, AppDispatch } from '../../store';
import { setTheme } from '../../store/slices/settingsSlice';
import { logout } from '../../store/slices/authSlice';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/checkout': 'Checkout',
  '/inventory': 'Inventory',
  '/transactions': 'Transactions',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/subscription': 'Subscription',
};

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export default function Header({ sidebarCollapsed }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { theme, storeName } = useSelector((state: RootState) => state.settings);
  const { user } = useSelector((state: RootState) => state.auth);

  const title = pageTitles[location.pathname] || 'ShopIQ';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
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
          onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative">
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
            <User size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">
              {user?.name || user?.email}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {user?.plan === 'free' ? 'Free Plan' : `${user?.plan?.replace('_', ' ')} Plan`}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Logout"
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
