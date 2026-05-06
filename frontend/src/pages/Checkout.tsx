import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  User,
  UserCheck,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import {
  addCart,
  removeCart,
  switchCart,
  addItem,
  removeItem,
  updateQuantity,
  setDiscount,
  clearCart,
} from '../store/slices/cartSlice';
import { fetchProducts } from '../store/slices/productsSlice';
import { checkoutApi, membersApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { Member } from '../types';

type PaymentMethod = 'cash' | 'card' | 'wallet';
type RightTab = 'finder' | 'newcart';

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
}

const emptyForm: CustomerForm = { name: '', phone: '', email: '' };

export default function Checkout() {
  const dispatch = useDispatch<AppDispatch>();
  const { carts, activeCartId } = useSelector((state: RootState) => state.cart);
  const { items: products } = useSelector((state: RootState) => state.products);
  const { taxRate, currencySymbol } = useSelector((state: RootState) => state.settings);

  // ── Product search (local, no Redux side-effects) ──
  const [productSearch, setProductSearch] = useState('');

  // ── Customer form (local, completely isolated from cart) ──
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyForm);
  const [customerExpanded, setCustomerExpanded] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savedMember, setSavedMember] = useState<{ name: string; membershipId: string } | null>(null);

  // ── Member search (local, read-only until explicit selection) ──
  const [rightTab, setRightTab] = useState<RightTab>('finder');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);

  // ── Payment modal ──
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load products once
  useEffect(() => {
    if (products.length === 0) dispatch(fetchProducts());
  }, [dispatch]);

  // Debounced member search — only reads from API, never mutates state
  useEffect(() => {
    if (!memberSearch.trim()) {
      setMemberResults([]);
      setMemberSearching(false);
      return;
    }
    setMemberSearching(true);
    const timer = setTimeout(async () => {
      const results = await membersApi.search(memberSearch).catch(() => []);
      setMemberResults(results);
      setMemberSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  // ── Derived values ───────────────────────────────────────────────
  const activeCart = carts.find((c) => c.cartId === activeCartId)!;

  const subtotal = activeCart.items.reduce((s, i) => s + i.product.sellPrice * i.quantity, 0);
  const taxableSubtotal = activeCart.items
    .filter((i) => i.product.taxable)
    .reduce((s, i) => s + i.product.sellPrice * i.quantity, 0);
  const tax = (taxableSubtotal * taxRate) / 100;
  const total = Math.max(0, subtotal + tax - activeCart.discount);

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const cartItemCount = (cart: (typeof carts)[0]) =>
    cart.items.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = productSearch.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.barcode.includes(productSearch)
        )
        .slice(0, 8)
    : [];

  // ── Customer form handlers (local state only, zero cart impact) ──
  const updateField = (field: keyof CustomerForm, value: string) =>
    setCustomerForm((prev) => ({ ...prev, [field]: value }));

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    setSavingCustomer(true);
    try {
      const existing = await membersApi.search(customerForm.phone).catch(() => [] as Member[]);
      const duplicate = existing.find((m) => m.phone === customerForm.phone);
      if (duplicate) {
        setSavedMember({ name: duplicate.name, membershipId: duplicate.membershipId });
        setCustomerForm(emptyForm);
        toast('Phone already registered — profile already exists', { icon: 'ℹ️' });
        return;
      }
      const newMember = await membersApi.create({
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email,
        membershipId: `MEM-${customerForm.phone.replace(/\D/g, '').slice(-6)}`,
      });
      setSavedMember({ name: newMember.name, membershipId: newMember.membershipId });
      setCustomerForm(emptyForm); // clear form — NO cart modification
      toast.success(`Profile saved — ${newMember.membershipId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSavingCustomer(false);
    }
  };

  // ── Member selection — ONLY place that creates carts for members ─
  const handleSelectMember = (m: Member) => {
    // Rule 1: if this member already has an open cart, just switch to it
    const existingCart = carts.find((c) => c.customerId === m.id);
    if (existingCart) {
      dispatch(switchCart(existingCart.cartId));
      toast.success(`Switched to ${m.name}'s cart`);
      setMemberSearch('');
      setMemberResults([]);
      return;
    }

    // Rule 2: enforce 4-cart limit
    if (carts.length >= 4) {
      toast.error('Max 4 carts reached — close one first');
      return;
    }

    // Rule 3: always create a brand-new cart — never mutate default or any existing cart
    dispatch(addCart({ customerName: m.name, customerId: m.id }));
    toast.success(`Cart created for ${m.name}`);
    setMemberSearch('');
    setMemberResults([]);
  };

  // ── Payment ──────────────────────────────────────────────────────
  const handleConfirmPayment = async () => {
    if (!activeCart || activeCart.items.length === 0) return;
    setProcessing(true);
    try {
      await checkoutApi.process({
        items: activeCart.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.sellPrice,
        })),
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        discount: activeCart.discount,
        total: parseFloat(total.toFixed(2)),
        paymentMethod,
        memberId: activeCart.customerId,
      });
      dispatch(clearCart(activeCartId));
      setShowPayment(false);
      setCashGiven('');
      setProductSearch('');
      toast.success(
        activeCart.customerId
          ? 'Payment recorded to member profile!'
          : 'Payment confirmed!'
      );
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const change = paymentMethod === 'cash' && cashGiven ? parseFloat(cashGiven) - total : null;

  return (
    <div className="flex flex-col lg:flex-row gap-5">

      {/* ══ LEFT PANEL ══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Product search */}
        <div className="card p-4 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search products by name, SKU or barcode..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          {filteredProducts.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  disabled={p.stock === 0}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0 disabled:opacity-50"
                  onClick={() => {
                    const inCart = activeCart.items.find((i) => i.product.id === p.id);
                    if ((inCart?.quantity ?? 0) >= p.stock) {
                      toast.error(`Only ${p.stock} units available`);
                      return;
                    }
                    dispatch(addItem(p));
                    setProductSearch('');
                    toast.success(`${p.name} added`);
                  }}
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                    <span className="text-xs text-gray-400 font-mono ml-2">{p.sku}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold">{fmt(p.sellPrice)}</span>
                    <span className={`text-xs ${p.stock < 10 ? 'text-amber-500' : 'text-green-500'}`}>
                      {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Customer profile form — local state only, never touches cart */}
        <div className="card p-4">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setCustomerExpanded((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <User size={15} className="text-gray-400 shrink-0" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Save Customer Profile
              </span>
              <span className="text-xs text-gray-400">(optional)</span>
            </div>
            {customerExpanded
              ? <ChevronUp size={15} className="text-gray-400 shrink-0" />
              : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
          </button>

          {customerExpanded && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/40 px-3 py-2 rounded-lg">
                Fill in customer details and click Save. Then use "Search Profile" on the right to assign them to a cart.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input"
                    placeholder="Full name"
                    value={customerForm.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">
                    Phone *
                    <span className="text-gray-400 font-normal ml-1 text-xs">(unique ID)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="+1 555 000 0000"
                    value={customerForm.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="customer@email.com"
                    value={customerForm.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveCustomer}
                  disabled={savingCustomer || !customerForm.name.trim() || !customerForm.phone.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCustomer ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {savingCustomer ? 'Saving…' : 'Save Customer Profile'}
                </button>

                {(customerForm.name || customerForm.phone || customerForm.email) && (
                  <button
                    onClick={() => { setCustomerForm(emptyForm); setSavedMember(null); }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {savedMember && (
                <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  <UserCheck size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{savedMember.name}</strong> ({savedMember.membershipId}) saved.
                    Use "Search Profile" on the right to assign them to a cart.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {activeCart.customerName}'s Cart
              </span>
              <span className="text-xs text-gray-400">
                ({activeCart.items.length} {activeCart.items.length === 1 ? 'item' : 'items'})
              </span>
            </div>
            {activeCart.items.length > 0 && (
              <button
                onClick={() => dispatch(clearCart(activeCartId))}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {activeCart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <ShoppingCart size={36} className="mb-2 opacity-25" />
              <p className="text-sm">Cart is empty — search a product above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {activeCart.items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingCart size={14} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-400">{fmt(product.sellPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => dispatch(updateQuantity({ productId: product.id, quantity: quantity - 1 }))}
                      className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-7 text-center text-sm font-medium">{quantity}</span>
                    <button
                      onClick={() => dispatch(updateQuantity({ productId: product.id, quantity: quantity + 1 }))}
                      disabled={quantity >= product.stock}
                      className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <span className="min-w-[4.5rem] text-right text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                    {fmt(product.sellPrice * quantity)}
                  </span>
                  <button
                    onClick={() => dispatch(removeItem(product.id))}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL ═════════════════════════════════════════════ */}
      <div className="lg:w-80 xl:w-96 shrink-0 space-y-4">

        {/* Search Profile / New Cart tabs */}
        <div className="card">
          <div className="flex border-b border-gray-100 dark:border-gray-700 rounded-t-xl overflow-hidden">
            <button
              onClick={() => setRightTab('finder')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                rightTab === 'finder'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 -mb-px bg-indigo-50/50 dark:bg-indigo-900/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Users size={14} />
              Search Profile
            </button>
            <button
              onClick={() => {
                if (carts.length >= 4) {
                  toast.error('Maximum 4 carts reached');
                  return;
                }
                dispatch(addCart());
                setRightTab('finder');
                toast.success('New cart added');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <Plus size={14} />
              New Cart
            </button>
          </div>

          {/* Search Profile panel */}
          {rightTab === 'finder' && (
            <div className="p-4" >
              <div className="relative">
                <UserCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Type name or phone to search..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setMemberResults([]), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && memberResults.length > 0) {
                      handleSelectMember(memberResults[0]);
                    }
                    if (e.key === 'Escape') {
                      setMemberSearch('');
                      setMemberResults([]);
                    }
                  }}
                />

                {/* Dropdown — shown only when results exist */}
                {memberResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-[999] max-h-56 overflow-y-auto">
                    {memberResults.map((m) => {
                      const hasCart = carts.some((c) => c.customerId === m.id);
                      return (
                        <button
                          key={m.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectMember(m)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                            <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                            <p className="text-xs text-gray-400">{m.phone} · {m.membershipId}</p>
                          </div>
                          {hasCart && (
                            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full shrink-0">
                              Active
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status messages below input */}
              {memberSearching && memberSearch.trim() && (
                <p className="text-xs text-gray-400 text-center mt-2">Searching…</p>
              )}
              {!memberSearching && memberSearch.trim() && memberResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  No profiles found for "{memberSearch}"
                </p>
              )}
              {!memberSearch.trim() && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Selecting a profile creates or switches to their cart
                </p>
              )}
            </div>
          )}
        </div>

        {/* Active carts */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Active Carts ({carts.length}/4)
          </p>
          <div className="flex flex-wrap gap-2">
            {carts.map((cart) => {
              const isActive = cart.cartId === activeCartId;
              const count = cartItemCount(cart);
              return (
                <button
                  key={cart.cartId}
                  onClick={() => dispatch(switchCart(cart.cartId))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500'
                  }`}
                >
                  <span className="truncate max-w-[80px]">{cart.customerName}</span>
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                    }`}>
                      {count}
                    </span>
                  )}
                  {cart.cartId !== 'default' && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); dispatch(removeCart(cart.cartId)); }}
                      className={`rounded-full p-0.5 transition-colors ${
                        isActive
                          ? 'hover:bg-white/20 text-white/70 hover:text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <X size={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeCart.customerId && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <UserCheck size={12} />
              <span>Purchase will be recorded to member profile</span>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Subtotal ({activeCart.items.length} items)</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Tax ({taxRate}%)</span>
              <span>{fmt(tax)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  className="w-20 text-right border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={activeCart.discount}
                  onChange={(e) =>
                    dispatch(setDiscount(Math.max(0, parseFloat(e.target.value) || 0)))
                  }
                />
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2.5 flex justify-between font-bold text-gray-900 dark:text-white">
              <span>Total</span>
              <span className="text-lg">{fmt(total)}</span>
            </div>
          </div>
          <button
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
            disabled={activeCart.items.length === 0}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard size={15} />
            Proceed to Payment
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Confirm Payment" size="sm">
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Due</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(total)}</span>
            </div>
            {activeCart.customerId && (
              <div className="flex items-center gap-2 mt-2 text-xs text-indigo-500 dark:text-indigo-400">
                <UserCheck size={11} />
                <span>{activeCart.customerName} · Member</span>
              </div>
            )}
          </div>

          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'wallet'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    paymentMethod === m
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
                  }`}
                >
                  {m === 'wallet' ? 'Wallet' : m.charAt(0).toUpperCase() + m.slice(1)}
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
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">
                  Change: {fmt(change)}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn-secondary flex-1" onClick={() => setShowPayment(false)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={
                processing ||
                (paymentMethod === 'cash' && cashGiven !== '' && parseFloat(cashGiven) < total)
              }
              onClick={handleConfirmPayment}
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
