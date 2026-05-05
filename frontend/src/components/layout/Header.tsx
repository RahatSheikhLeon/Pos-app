import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bell, Moon, Sun, User } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setTheme } from '../../store/slices/settingsSlice';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/checkout': 'Checkout',
  '/inventory': 'Inventory',
  '/transactions': 'Transactions',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export default function Header({ sidebarCollapsed }: HeaderProps) {
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { theme, storeName } = useSelector((state: RootState) => state.settings);
  const user = useSelector((state: RootState) => state.user);

  const title = pageTitles[location.pathname] || 'ShopIQ';

  const toggleTheme = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
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
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
            <User size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">
              {user.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
