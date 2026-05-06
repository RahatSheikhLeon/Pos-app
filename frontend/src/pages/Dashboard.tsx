import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp } from 'lucide-react';
import { AppDispatch, RootState } from '../store';
import { dashboardApi } from '../services/api';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton';
import { useState } from 'react';
import { DashboardStats } from '../types';

export default function Dashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { currencySymbol } = useSelector((state: RootState) => state.settings);
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .finally(() => setLoading(false));
  }, [dispatch]);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const paymentBadge = (method: string) => {
    if (method === 'cash') return <Badge variant="green">Cash</Badge>;
    if (method === 'card') return <Badge variant="blue">Card</Badge>;
    return <Badge variant="indigo">Wallet</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Today's Sales"
              value={fmt(data?.todaySales ?? 0)}
              sub={`${data?.todayTransactions ?? 0} transactions`}
              icon={DollarSign}
              iconColor="text-green-600"
              iconBg="bg-green-50 dark:bg-green-900/30"
            />
            <StatCard
              title="Weekly Sales"
              value={fmt(data?.weeklySales ?? 0)}
              sub={`${data?.weeklyTransactions ?? 0} transactions`}
              icon={TrendingUp}
              iconColor="text-blue-600"
              iconBg="bg-blue-50 dark:bg-blue-900/30"
            />
            <StatCard
              title="Monthly Sales"
              value={fmt(data?.monthlySales ?? 0)}
              sub={`${data?.monthlyTransactions ?? 0} transactions`}
              icon={ShoppingBag}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            />
            <StatCard
              title="Low Stock Items"
              value={data?.lowStockCount ?? 0}
              sub="Items below 10 units"
              icon={AlertTriangle}
              iconColor="text-amber-600"
              iconBg="bg-amber-50 dark:bg-amber-900/30"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Return Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                ) : data?.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No returns yet
                    </td>
                  </tr>
                ) : (
                  data?.recentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">
                        #{t.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(t.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">
                        {fmt(t.total)}
                      </td>
                      <td className="px-5 py-3">{paymentBadge(t.paymentMethod)}</td>
                      <td className="px-5 py-3">
                        {t.status === 'returned' ? (
                          <Badge variant="red">Returned</Badge>
                        ) : t.status === 'partially_refunded' ? (
                          <Badge variant="yellow">Partial Refund</Badge>
                        ) : (
                          <Badge variant="green">Completed</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Low Stock Alerts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />)
                ) : data?.lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      All products well stocked
                    </td>
                  </tr>
                ) : (
                  data?.lowStockProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                      <td className="px-5 py-3">
                        <Badge variant={p.stock === 0 ? 'red' : 'yellow'}>
                          {p.stock} units
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
