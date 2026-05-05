import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  setCustomer,
  setDiscount,
} from '../store/slices/cartSlice';
import { fetchProducts } from '../store/slices/productsSlice';
import { checkoutApi } from '../services/api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

type PaymentMethod = 'cash' | 'card' | 'wallet';

export default function Checkout() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, customerEmail, customerPhone, discount } = useSelector(
    (state: RootState) => state.cart
  );
  const { items: products } = useSelector((state: RootState) => state.products);
  const { taxRate, currencySymbol } = useSelector((state: RootState) => state.settings);

  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processing, setProcessing] = useState(false);
  const [cashGiven, setCashGiven] = useState('');

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.trim()) {
      dispatch(fetchProducts({ search: value }));
    }
  };

  const subtotal = items.reduce((sum, i) => sum + i.product.sellPrice * i.quantity, 0);
  const taxableSubtotal = items
    .filter((i) => i.product.taxable)
    .reduce((sum, i) => sum + i.product.sellPrice * i.quantity, 0);
  const tax = (taxableSubtotal * taxRate) / 100;
  const total = subtotal + tax - discount;

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const handleConfirmPayment = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      await checkoutApi.process({
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.sellPrice,
        })),
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
      });
      dispatch(clearCart());
      setShowPayment(false);
      setSearch('');
      toast.success('Payment confirmed! Transaction saved.');
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode.includes(search)
      )
    : [];

  const change =
    paymentMethod === 'cash' && cashGiven ? parseFloat(cashGiven) - total : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-4">
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Search Products</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, SKU or barcode..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          {filteredProducts.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  onClick={() => {
                    dispatch(addToCart(p));
                    setSearch('');
                    toast.success(`${p.name} added`);
                  }}
                  disabled={p.stock === 0}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmt(p.sellPrice)}</p>
                    <p className={`text-xs ${p.stock < 10 ? 'text-amber-500' : 'text-green-500'}`}>
                      {p.stock} left
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Customer (Optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                placeholder="customer@email.com"
                value={customerEmail}
                onChange={(e) => dispatch(setCustomer({ email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                placeholder="+1 555 000 0000"
                value={customerPhone}
                onChange={(e) => dispatch(setCustomer({ phone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Cart ({items.length} items)
            </h2>
            {items.length > 0 && (
              <button
                onClick={() => dispatch(clearCart())}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Clear all
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingCart size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-xs">IMG</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400">{fmt(product.sellPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        dispatch(updateQuantity({ productId: product.id, quantity: quantity - 1 }))
                      }
                      className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                    <button
                      onClick={() =>
                        dispatch(updateQuantity({ productId: product.id, quantity: quantity + 1 }))
                      }
                      disabled={quantity >= product.stock}
                      className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {fmt(product.sellPrice * quantity)}
                  </span>
                  <button
                    onClick={() => dispatch(removeFromCart(product.id))}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:w-80 xl:w-96 shrink-0">
        <div className="card p-5 sticky top-0">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Tax ({taxRate}%)</span>
              <span>{fmt(tax)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  max={subtotal + tax}
                  className="w-20 text-right border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={discount}
                  onChange={(e) =>
                    dispatch(setDiscount(Math.max(0, parseFloat(e.target.value) || 0)))
                  }
                />
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold text-gray-900 dark:text-white text-base">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
          <button
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
            disabled={items.length === 0}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard size={16} />
            Proceed to Payment
          </button>
        </div>
      </div>

      <Modal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title="Payment"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-300 text-sm">Total Due</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(total)}</span>
          </div>

          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'wallet'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                    paymentMethod === m
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
                  }`}
                >
                  {m === 'wallet' ? 'Digital Wallet' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div>
              <label className="label">Cash Given</label>
              <input
                className="input"
                type="number"
                placeholder={`Min. ${fmt(total)}`}
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
              />
              {change !== null && change >= 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Change: {fmt(change)}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowPayment(false)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={
                processing ||
                (paymentMethod === 'cash' &&
                  cashGiven !== '' &&
                  parseFloat(cashGiven) < total)
              }
              onClick={handleConfirmPayment}
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm Payment'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
