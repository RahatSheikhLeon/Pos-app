import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  CreditCard,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Crown,
} from 'lucide-react';
import { RootState } from '../../store';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, pro: false },
  { path: '/products',     label: 'Products',     icon: Package,         pro: false },
  { path: '/checkout',     label: 'Checkout',     icon: ShoppingCart,    pro: false },
  { path: '/inventory',    label: 'Inventory',    icon: Boxes,           pro: false },
  { path: '/transactions', label: 'Transactions', icon: CreditCard,      pro: false },
  { path: '/reports',      label: 'Reports',      icon: BarChart2,       pro: false },
  { path: '/settings',     label: 'Settings',     icon: Settings,        pro: false },
  { path: '/subscription', label: 'Subscription', icon: Crown,           pro: false },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useSelector((state: RootState) => state.auth);
  const isFree = user?.plan === 'free' || !user?.plan;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-gray-900 flex flex-col transition-all duration-300 z-20 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg">ShopIQ</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto">
            <Zap size={14} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, pro }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />

            {!collapsed && (
              <>
                <span className="text-sm font-medium flex-1">{label}</span>
                {pro && isFree && (
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shrink-0">
                    PRO
                  </span>
                )}
              </>
            )}

            {/* collapsed mode: small dot indicator for PRO items */}
            {collapsed && pro && isFree && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500 ring-1 ring-gray-900" />
            )}
          </NavLink>
        ))}
      </nav>

      {collapsed && (
        <div className="pb-4 flex justify-center">
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}
