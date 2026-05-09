import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Check, Zap, Monitor, ShieldCheck, Loader2,
  Clock, AlertCircle, Crown, ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RootState } from '../store';
import { stripeApi, subscriptionPlansApi, devicesApi } from '../services/api';
import { SubscriptionPlan, UserSubscription } from '../types';
import Modal from '../components/ui/Modal';

// ── Per-plan visual theme ─────────────────────────────────────────
const THEME: Record<string, {
  idleBorder:     string;
  hoverBorder:    string;
  hoverShadow:    string;
  selectedBorder: string;
  selectedShadow: string;
  selectedRing:   string;
  badge:          string;
}> = {
  plan_free: {
    idleBorder:     'border-gray-200 dark:border-gray-700',
    hoverBorder:    'hover:border-gray-400 dark:hover:border-gray-500',
    hoverShadow:    'hover:shadow-md',
    selectedBorder: 'border-gray-500 dark:border-gray-400',
    selectedShadow: 'shadow-xl shadow-gray-200 dark:shadow-gray-900/40',
    selectedRing:   'ring-2 ring-gray-400 ring-offset-2 dark:ring-offset-gray-900',
    badge:          'bg-gray-500',
  },
  plan_pro_basic: {
    idleBorder:     'border-blue-200 dark:border-blue-900',
    hoverBorder:    'hover:border-blue-400 dark:hover:border-blue-500',
    hoverShadow:    'hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/40',
    selectedBorder: 'border-blue-500',
    selectedShadow: 'shadow-2xl shadow-blue-200 dark:shadow-blue-900/50',
    selectedRing:   'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900',
    badge:          'bg-blue-500',
  },
  plan_pro_standard: {
    idleBorder:     'border-indigo-200 dark:border-indigo-900',
    hoverBorder:    'hover:border-indigo-500 dark:hover:border-indigo-400',
    hoverShadow:    'hover:shadow-xl hover:shadow-indigo-100 dark:hover:shadow-indigo-900/40',
    selectedBorder: 'border-indigo-600',
    selectedShadow: 'shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/50',
    selectedRing:   'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900',
    badge:          'bg-indigo-600',
  },
  plan_pro_premium: {
    idleBorder:     'border-purple-200 dark:border-purple-900',
    hoverBorder:    'hover:border-purple-500 dark:hover:border-purple-400',
    hoverShadow:    'hover:shadow-xl hover:shadow-purple-100 dark:hover:shadow-purple-900/40',
    selectedBorder: 'border-purple-600',
    selectedShadow: 'shadow-2xl shadow-purple-200 dark:shadow-purple-900/50',
    selectedRing:   'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900',
    badge:          'bg-purple-600',
  },
};

export default function Subscription() {
  const { user } = useSelector((state: RootState) => state.auth);

  const [plans, setPlans]               = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [devices, setDevices]           = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [initiating, setInitiating]     = useState(false);
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

  const activePlanId = subscription?.planId ?? 'plan_free';
  const isPro        = user?.plan !== 'free';
  const hasPending   = paymentStatus === 'pending';
  const hasCompleted = paymentStatus === 'completed';

  // This device is over the plan's device limit:
  //   • user.plan === 'free' (effective plan from JWT)
  //   • BUT they have an active non-free subscription in the DB
  // → this device lost Pro access; existing authorised devices are unaffected.
  const isOverDeviceLimit =
    user?.plan === 'free' &&
    subscription?.status === 'active' &&
    subscription?.planId !== 'plan_free';

  // True when the user has a paid plan that has NOT yet expired.
  // While this is true, no other plan card can be selected.
  const hasActivePaidPlan =
    subscription?.status === 'active' &&
    subscription?.planId !== 'plan_free' &&
    (!subscription?.endDate || new Date(subscription.endDate) > new Date()) &&
    !isOverDeviceLimit; // over-limit devices may still select a higher tier

  // Block purchasing only when already subscribed AND not in over-device-limit state
  // (over-limit users should be able to upgrade to a higher-tier plan)
  const purchaseBlocked = hasCompleted && !isOverDeviceLimit;

  // Price display: monthly shows /mo rate; yearly shows total annual price
  const displayPrice = (plan: SubscriptionPlan) => {
    if (plan.price === 0) return { main: 'Free', sub: null };
    if (billingCycle === 'yearly') {
      const total = plan.yearlyPrice || Math.round(plan.price * 12 * 0.8);
      return {
        main: `$${total}`,
        sub:  `/ year  ·  $${(total / 12).toFixed(0)}/mo`,
      };
    }
    return { main: `$${plan.price}`, sub: '/month' };
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
        {isOverDeviceLimit && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 rounded-xl max-w-sm">
            <Monitor size={15} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-700 dark:text-red-400">
              <strong>Device limit reached.</strong> Your{' '}
              {subscription?.plan?.name} plan is active on other devices. Remove
              an existing device below to grant Pro access here, or upgrade to a
              higher-tier plan.
            </span>
          </div>
        )}
        {!isPro && !hasPending && !isOverDeviceLimit && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2 rounded-xl">
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Upgrade for more devices, carts, and premium features
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
              Save more
            </span>
          </button>
        </div>
      </div>

      {/* ── Plan Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const theme      = THEME[plan.id] ?? THEME.plan_free;
          const isFree     = plan.type === 'free';
          const isPopular  = plan.id === 'plan_pro_standard';

          // Both plan tier AND billing cycle must match the purchased subscription
          const isCurrent    = plan.id === activePlanId &&
                               (subscription?.billingCycle ?? 'monthly') === billingCycle;
          // Same tier but viewing the other billing cycle (e.g. bought Monthly, viewing Yearly tab)
          const isActiveTier = plan.id === activePlanId &&
                               !isFree &&
                               !isCurrent &&
                               subscription?.planId !== 'plan_free';

          const isSelected = selectedPlan?.id === plan.id;
          const price      = displayPrice(plan);
          // Clickable only when: not free, not the exact current plan, not the same tier viewed
          // in the alternate cycle, and no active paid plan forcing a lock
          const clickable  = !isFree && !isCurrent && !isActiveTier && !hasActivePaidPlan;
          const isLocked   = !isFree && !isCurrent && !isActiveTier && hasActivePaidPlan;

          return (
            <div
              key={plan.id}
              onClick={() => clickable && setSelectedPlan(isSelected ? null : plan)}
              title={isLocked ? `Available after your current plan expires on ${subscription?.endDate ? new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'renewal date'}` : undefined}
              className={[
                'relative p-5 rounded-2xl border-2 transition-all duration-200 bg-white dark:bg-gray-800',
                clickable ? 'cursor-pointer' : '',
                isLocked  ? 'cursor-not-allowed opacity-50 select-none' : '',

                // ── selected: strongest state ────────────────────────
                isSelected
                  ? `${theme.selectedBorder} ${theme.selectedShadow} ${theme.selectedRing} scale-[1.05] -translate-y-1`

                // ── current plan: indigo ring ────────────────────────
                : isCurrent
                  ? 'border-indigo-400 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30'

                // ── idle + hover ─────────────────────────────────────
                : `${theme.idleBorder} ${!isLocked ? `${theme.hoverBorder} ${theme.hoverShadow} hover:scale-[1.02] hover:-translate-y-0.5` : ''}`,
              ].join(' ')}
            >
              {/* Most Popular ribbon */}
              {isPopular && !isCurrent && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                  Most Popular
                </span>
              )}

              {/* Current / Active-other-cycle / Selected badge */}
              {isCurrent && (
                <span className="absolute top-3 right-3 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
              {isActiveTier && (
                <span className="absolute top-3 right-3 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Active ({subscription?.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'})
                </span>
              )}
              {isSelected && !isCurrent && (
                <span className={`absolute top-3 right-3 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${theme.badge}`}>
                  Selected
                </span>
              )}

              {/* Plan name */}
              <p className="font-bold text-gray-900 dark:text-white text-sm">{plan.name}</p>

              {/* Price block */}
              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {price.main}
                </span>
                {price.sub && (
                  <span className="text-xs text-gray-400 ml-1 leading-tight">
                    {price.sub}
                  </span>
                )}
              </div>

              {/* Feature list */}
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                {/* Devices */}
                <li className="flex items-center gap-2">
                  <Monitor size={11} className="shrink-0 text-gray-400" />
                  <span>
                    {plan.maxDevices} device{plan.maxDevices > 1 ? 's' : ''}
                  </span>
                </li>

                {/* Products */}
                <li className="flex items-center gap-2">
                  <Check size={11} className="shrink-0 text-green-500" />
                  <span>
                    {plan.maxProducts === -1 ? 'Unlimited products' : `${plan.maxProducts} products`}
                  </span>
                </li>

                {/* Carts — rendered from features array (first entry) */}
                {(plan.features as string[]).slice(0, 1).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <ShoppingCart size={11} className="shrink-0 text-indigo-400" />
                    <span>{f}</span>
                  </li>
                ))}

                {/* Remaining features */}
                {(plan.features as string[]).slice(1).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={11} className="shrink-0 text-green-500" />
                    <span>{f}</span>
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
              {selectedPlan.name} — {displayPrice(selectedPlan).main}
              <span className="font-normal text-gray-400 text-sm ml-1">
                {displayPrice(selectedPlan).sub}
              </span>
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
            Active Devices ({devices.length}
            {subscription?.plan?.maxDevices
              ? ` / ${subscription.plan.maxDevices}`
              : ''})
            {isOverDeviceLimit && (
              <span className="ml-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                Limit reached
              </span>
            )}
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
                ['Price',   `${displayPrice(selectedPlan).main} ${displayPrice(selectedPlan).sub ?? ''}`],
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
