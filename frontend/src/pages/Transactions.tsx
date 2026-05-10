import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Eye, RotateCcw, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import { fetchTransactions, returnTransaction } from '../store/slices/transactionsSlice';
import { Transaction, TransactionItem } from '../types';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { TableRowSkeleton, CardSkeleton } from '../components/ui/Skeleton';

// Return quantities keyed by productId
type ReturnQtys = Record<string, number>;

export default function Transactions() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, totalRevenue, loading } = useSelector(
    (state: RootState) => state.transactions
  );
  const { currencySymbol } = useSelector((state: RootState) => state.settings);

  // Search by ID only
  const [search, setSearch] = useState('');

  // Detail modal
  const [selected, setSelected] = useState<Transaction | null>(null);

  // Return state
  const [returning, setReturning] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<Transaction | null>(null);
  const [returnQtys, setReturnQtys] = useState<ReturnQtys>({});

  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);

  // Filter by ID only
  const filtered = items.filter(
    (t) => !search.trim() || t.id.toLowerCase().includes(search.trim().toLowerCase())
  );

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const statusBadge = (t: Transaction) => {
    if (t.status === 'returned') return <Badge variant="red">Returned</Badge>;
    if (t.status === 'partially_refunded') return <Badge variant="yellow">Partial Refund</Badge>;
    return <Badge variant="green">Completed</Badge>;
  };

  const paymentBadge = (method: string) => {
    if (method === 'cash') return <Badge variant="green">Cash</Badge>;
    if (method === 'card') return <Badge variant="blue">Card</Badge>;
    return <Badge variant="indigo">Wallet</Badge>;
  };

  // How many units of a given item have already been returned
  const alreadyReturned = (t: Transaction, productId: string) => {
    const r = t.returnedItems?.find((ri) => ri.productId === productId);
    return r?.quantity ?? 0;
  };

  // Remaining returnable quantity
  const remainingQty = (t: Transaction, item: TransactionItem) =>
    item.quantity - alreadyReturned(t, item.productId);

  // Open return flow
  const openReturn = (t: Transaction) => {
    const returnable = t.items.filter((i) => remainingQty(t, i) > 0);
    if (returnable.length === 0) {
      toast('All items have already been returned');
      return;
    }

    // RULE 1 — the ONLY case where a direct (no-popup) return is allowed:
    //   • the original transaction has exactly ONE product type, AND
    //   • exactly ONE unit of it remains to be returned.
    //
    // Every other situation requires the popup:
    //   RULE 2 — one product type, qty > 1  → popup (user picks how many)
    //   RULE 3 — multiple product types      → popup (always, even after partial returns)
    //
    // We deliberately use t.items.length (original count) NOT returnable.length
    // (remaining count). After a partial return reduces returnable to 1 item, the
    // original multi-product transaction must still go through the popup.
    if (t.items.length === 1 && remainingQty(t, returnable[0]) === 1) {
      confirmReturn(t, [{ productId: returnable[0].productId, quantity: 1 }]);
      return;
    }

    // All other cases: open the selection popup.
    // Default every item to 0 — the user must explicitly set the quantity they
    // want to return.  Defaulting to max caused a critical bug: if the user only
    // adjusted some items and confirmed, ALL items (at their max) were returned.
    const initial: ReturnQtys = {};
    returnable.forEach((i) => {
      initial[i.productId] = 0;
    });
    setReturnQtys(initial);
    setReturnTarget(t);
  };

  const confirmReturn = async (
    t: Transaction,
    items?: { productId: string; quantity: number }[]
  ) => {
    setReturning(t.id);
    setReturnTarget(null);
    try {
      await dispatch(returnTransaction({ id: t.id, items })).unwrap();
      // Re-fetch the full list so Redux always reflects the latest DB state.
      // This guarantees the next popup — opened immediately after this one — gets
      // accurate returnedItems/remainingQty regardless of any response-shape edge cases.
      dispatch(fetchTransactions());
      if (selected?.id === t.id) setSelected(null);
      toast.success('Return processed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Return failed');
    } finally {
      setReturning(null);
    }
  };

  const handleConfirmPartialReturn = () => {
    if (!returnTarget) return;
    const payload = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (payload.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }
    confirmReturn(returnTarget, payload);
  };

  // Refund amount preview for the return modal
  const returnRefundPreview = () => {
    if (!returnTarget) return 0;
    let amount = 0;
    for (const [productId, qty] of Object.entries(returnQtys)) {
      const item = returnTarget.items.find((i) => i.productId === productId);
      if (item && qty > 0) amount += item.unitPrice * qty;
    }
    return amount;
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
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

      {/* Search — ID only */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search by Transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Transaction table */}
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
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={7} />
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    {search ? `No transactions found for ID "${search}"` : 'No transactions yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const canReturn =
                    t.status !== 'returned' &&
                    t.items.some((i) => remainingQty(t, i) > 0);
                  return (
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
                      <td className="px-4 py-3">{statusBadge(t)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setSelected(t)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            title="View details"
                          >
                            <Eye size={15} />
                          </button>
                          {canReturn && (
                            <button
                              onClick={() => openReturn(t)}
                              disabled={returning === t.id}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                              title="Process return"
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
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
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Status</p>
                <div>{statusBadge(selected)}</div>
              </div>
            </div>

            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Unit</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-right font-medium">Returned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {selected.items.map((item) => {
                    const retQty = alreadyReturned(selected, item.productId);
                    return (
                      <tr key={item.productId}>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
                          {item.productName}
                          <span className="text-xs text-gray-400 ml-1 font-mono">
                            ({item.sku})
                          </span>
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
                        <td className="px-4 py-2 text-right">
                          {retQty > 0 ? (
                            <Badge variant="yellow">{retQty} returned</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

            {selected.status !== 'returned' && selected.items.some((i) => remainingQty(selected, i) > 0) && (
              <button
                className="w-full py-2 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => { setSelected(null); openReturn(selected); }}
                disabled={returning === selected.id}
              >
                <RotateCcw size={15} />
                Process Return
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Partial return modal */}
      <Modal
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        title={`Return — #${returnTarget?.id.slice(-8).toUpperCase()}`}
        size="md"
      >
        {returnTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Use <strong>+</strong> to set the quantity to return per product.
              Items left at <strong>0</strong> will not be returned.
            </p>

            <div className="space-y-3">
              {returnTarget.items
                .filter((i) => remainingQty(returnTarget, i) > 0)
                .map((item) => {
                  const max = remainingQty(returnTarget, item);
                  const val = returnQtys[item.productId] ?? max;
                  return (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmt(item.unitPrice)} each · max {max} returnable
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            setReturnQtys((q) => ({
                              ...q,
                              [item.productId]: Math.max(0, (q[item.productId] ?? max) - 1),
                            }))
                          }
                          className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-white">
                          {val}
                        </span>
                        <button
                          onClick={() =>
                            setReturnQtys((q) => ({
                              ...q,
                              [item.productId]: Math.min(max, (q[item.productId] ?? max) + 1),
                            }))
                          }
                          disabled={val >= max}
                          className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
              <span>Estimated Refund</span>
              <span className="text-green-600 dark:text-green-400">
                {fmt(returnRefundPreview())}
              </span>
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setReturnTarget(null)}>
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleConfirmPartialReturn}
                disabled={returning === returnTarget?.id}
              >
                {returning === returnTarget?.id ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Confirm Return
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
