import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Check, Zap, Monitor, ShieldCheck, Loader2,
  Clock, AlertCircle, Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RootState } from '../store';
import { stripeApi, subscriptionPlansApi, devicesApi } from '../services/api';
import { SubscriptionPlan, UserSubscription } from '../types';
import Modal from '../components/ui/Modal';

// ── Plan card accent colours ──────────────────────────────────────
const ACCENT: Record<string, { border: string; glow: string; badge: string }> = {
  plan_free:         { border: 'border-gray-200 dark:border-gray-700', glow: '', badge: '' },
  plan_pro_basic:    { border: 'border-blue-400',    glow: 'shadow-blue-100 dark:shadow-blue-900/20',    badge: 'bg-blue-500' },
  plan_pro_standard: { border: 'border-indigo-500',  glow: 'shadow-indigo-100 dark:shadow-indigo-900/20', badge: 'bg-indigo-600' },
  plan_pro_premium:  { border: 'border-purple-500',  glow: 'shadow-purple-100 dark:shadow-purple-900/20', badge: 'bg-purple-600' },
};

export default function Subscription() {
  const { user } = useSelector((state: RootState) => state.auth);

  const [plans, setPlans]             = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [devices, setDevices]         = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [initiating, setInitiating]   = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, s, d, ps] = await Promise.all([
        subscriptionPlansApi.getAll(),
        stripeApi.getSubscription(),
        devicesApi.list(),
        stripeApi.getPaymentStatus(),
      ]);
      setPlans(p);
      setSubscription(s);
      setDevices(d);
      setPaymentStatus(ps.status);
    } catch { toast.error('Failed to load subscription'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const activePlanId  = subscription?.planId ?? 'plan_free';
  const isPro         = user?.plan !== 'free';
  const isActive      = subscription?.status === 'active';
  const hasPending      = paymentStatus === 'pending';
  const hasCompleted    = paymentStatus === 'completed';
  // Pending is NOT blocked — user can switch plan by selecting again (backend will update the row)
  const purchaseBlocked = hasCompleted;

  const yearlyDiscount = 20; // % discount for yearly billing

  const displayPrice = (plan: SubscriptionPlan) => {
    if (plan.price === 0) return { amount: 0, label: 'Free' };
    if (billingCycle === 'yearly') {
      const yearly = plan.yearlyPrice || plan.price * 12 * (1 - yearlyDiscount / 100);
      return { amount: +(yearly / 12).toFixed(2), label: `$${(yearly / 12).toFixed(2)}/mo` };
    }
    return { amount: plan.price, label: `$${plan.price}/mo` };
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    setInitiating(true);
    try {
      const { sessionUrl } = await stripeApi.createCheckout(selectedPlan.id, billingCycle);
      window.location.href = sessionUrl;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
      setInitiating(false);
    }
  };


  const handleRemoveDevice = async (id: string) => {
    try {
      await devicesApi.remove(id);
      setDevices(d => d.filter(dev => dev.id !== id));
      toast.success('Device removed');
    } catch { toast.error('Failed to remove device'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-10">

      {/* ── Current Plan Banner ──────────────────────────────────── */}
      <div className="card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            isPro ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            {isPro
              ? <Crown size={24} className="text-white" />
              : <ShieldCheck size={24} className="text-gray-400" />}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Your current plan</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {subscription?.plan?.name ?? 'Free Plan'}
            </p>
            <p className="text-xs text-gray-400">
              {subscription?.status && (
                <span className={`capitalize font-medium mr-2 ${
                  subscription.status === 'active' ? 'text-green-500'
                  : subscription.status === 'past_due' ? 'text-amber-500'
                  : 'text-red-400'
                }`}>{subscription.status}</span>
              )}
              {subscription?.endDate &&
                `Renews ${new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
          </div>
        </div>
        {hasPending && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-4 py-2 rounded-xl">
            <Clock size={15} className="text-blue-500 shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-400">
              Payment pending — select any plan below to change it, or complete checkout
            </span>
          </div>
        )}
        {!isPro && !hasPending && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2 rounded-xl">
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Upgrade to unlock Transactions, Reports &amp; Hardware
            </span>
          </div>
        )}
      </div>

      {/* ── Billing Toggle ───────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a Plan</h2>
        <p className="text-gray-400 text-sm">Scale as your business grows</p>
        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mt-4">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              billingCycle === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Yearly
            <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">
              -{yearlyDiscount}%
            </span>
          </button>
        </div>
      </div>

      {/* ── Plan Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const accent      = ACCENT[plan.id] ?? ACCENT.plan_free;
          const isCurrent   = plan.id === activePlanId;
          const isSelected  = selectedPlan?.id === plan.id;
          const isFree      = plan.type === 'free';
          const isPopular   = plan.id === 'plan_pro_standard';
          const price       = displayPrice(plan);

          return (
            <div
              key={plan.id}
              onClick={() => !isFree && !isCurrent && setSelectedPlan(isSelected ? null : plan)}
              className={[
                'relative p-5 rounded-2xl border-2 transition-all duration-200',
                !isFree && !isCurrent ? 'cursor-pointer' : '',
                isSelected ? `${accent.border} ${accent.glow} shadow-xl bg-white dark:bg-gray-800 scale-[1.02]`
                  : isCurrent ? 'ring-2 ring-indigo-500 border-indigo-400 bg-white dark:bg-gray-800'
                  : `${accent.border} bg-white dark:bg-gray-800 hover:shadow-md`,
              ].join(' ')}
            >
              {isPopular && !isCurrent && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 rounded-full shadow-lg">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute top-3 right-3 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
              {isSelected && !isCurrent && (
                <span className={`absolute top-3 right-3 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${accent.badge}`}>
                  Selected
                </span>
              )}

              <p className="font-bold text-gray-900 dark:text-white">{plan.name}</p>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {price.amount === 0 ? 'Free' : `$${price.amount}`}
                </span>
                {price.amount > 0 && (
                  <span className="text-xs text-gray-400 ml-1">
                    /mo{billingCycle === 'yearly' ? ' · billed yearly' : ''}
                  </span>
                )}
              </div>

              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <Monitor size={11} className="shrink-0" />
                  {plan.maxDevices} device{plan.maxDevices > 1 ? 's' : ''}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={11} className="text-green-500 shrink-0" />
                  {plan.maxProducts === -1 ? 'Unlimited products' : `${plan.maxProducts} products`}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={11} className="text-green-500 shrink-0" />
                  {plan.maxCustomers === -1 ? 'Unlimited customers' : `${plan.maxCustomers} customers`}
                </li>
                {(plan.features as string[]).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={11} className="text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Upgrade CTA ─────────────────────────────────────────── */}
      {selectedPlan && (
        <div className="card p-5 flex items-center justify-between gap-4 flex-wrap border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {selectedPlan.name} — {displayPrice(selectedPlan).label}
              {billingCycle === 'yearly' && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                  Save {yearlyDiscount}% vs monthly
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Subscription renews automatically · Cancel anytime
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPlan(null)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Deselect
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={purchaseBlocked}
              title={hasCompleted ? 'Already subscribed — cancel first to change plan' : undefined}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} />
              {hasPending ? 'Change Plan & Pay' : 'Subscribe Now'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Devices ───────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Monitor size={15} className="text-gray-400" />
            Active Devices ({devices.length})
          </h2>
        </div>
        {devices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No devices registered</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{d.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{d.fingerprint}</p>
                </div>
                <button onClick={() => handleRemoveDevice(d.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Confirm Subscribe Modal ──────────────────────────────── */}
      <Modal open={showConfirm} onClose={() => !initiating && setShowConfirm(false)}
        title="Confirm Subscription" size="md">
        {selectedPlan && (
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2.5">
              {[
                ['Plan',    selectedPlan.name],
                ['Billing', billingCycle === 'yearly' ? 'Yearly (billed annually)' : 'Monthly'],
                ['Price',   displayPrice(selectedPlan).label],
                ['Devices', String(selectedPlan.maxDevices)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>

            <ul className="space-y-1.5">
              {(selectedPlan.features as string[]).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Check size={12} className="text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
              <Clock size={13} className="shrink-0 mt-0.5" />
              <span>Subscription activates immediately after payment. Cancel anytime from this page.</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={initiating}
                className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCheckout} disabled={initiating}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {initiating
                  ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                  : <><Zap size={14} /> Pay with Stripe</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
