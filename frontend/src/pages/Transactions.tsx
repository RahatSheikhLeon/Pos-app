import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Eye, RotateCcw, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import { fetchTransactions, returnTransaction } from '../store/slices/transactionsSlice';
import { Transaction } from '../types';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { TableRowSkeleton, CardSkeleton } from '../components/ui/Skeleton';

export default function Transactions() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, totalRevenue, loading } = useSelector((state: RootState) => state.transactions);
  const { currencySymbol } = useSelector((state: RootState) => state.settings);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [returning, setReturning] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);

  const filtered = items.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.id.toLowerCase().includes(q) ||
      t.paymentMethod.includes(q) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(q))
    );
  });

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const paymentBadge = (method: string) => {
    if (method === 'cash') return <Badge variant="green">Cash</Badge>;
    if (method === 'card') return <Badge variant="blue">Card</Badge>;
    return <Badge variant="indigo">Wallet</Badge>;
  };

  const handleReturn = async (id: string) => {
    setReturning(id);
    try {
      await dispatch(returnTransaction(id)).unwrap();
      toast.success('Transaction returned successfully');
      if (selected?.id === id) {
        setSelected(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Return failed');
    } finally {
      setReturning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
                <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{items.length}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30">
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                  {currencySymbol}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {fmt(totalRevenue)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search by ID, payment method or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 font-medium">Transaction ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      #{t.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(t.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {t.items.length} item{t.items.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {fmt(t.total)}
                    </td>
                    <td className="px-4 py-3">{paymentBadge(t.paymentMethod)}</td>
                    <td className="px-4 py-3">
                      {t.returned ? (
                        <Badge variant="red">Returned</Badge>
                      ) : (
                        <Badge variant="green">Completed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setSelected(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        {!t.returned && (
                          <button
                            onClick={() => handleReturn(t.id)}
                            disabled={returning === t.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                            title="Return"
                          >
                            {returning === t.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-500 rounded-full animate-spin block" />
                            ) : (
                              <RotateCcw size={15} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Transaction #${selected?.id.slice(-8).toUpperCase()}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(selected.date).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Payment Method</p>
                <div>{paymentBadge(selected.paymentMethod)}</div>
              </div>
              {selected.customerEmail && (
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Customer Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selected.customerEmail}</p>
                </div>
              )}
              {selected.customerPhone && (
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Customer Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selected.customerPhone}</p>
                </div>
              )}
            </div>

            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Price</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {selected.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        {item.productName}
                        <span className="text-xs text-gray-400 ml-1 font-mono">({item.sku})</span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">
                        {fmt(item.unitPrice)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                        {fmt(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span>{fmt(selected.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Tax</span>
                <span>{fmt(selected.tax)}</span>
              </div>
              {selected.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{fmt(selected.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2">
                <span>Total</span>
                <span>{fmt(selected.total)}</span>
              </div>
            </div>

            {!selected.returned && (
              <button
                className="w-full py-2 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() => handleReturn(selected.id)}
                disabled={returning === selected.id}
              >
                <RotateCcw size={15} />
                Return Transaction
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
