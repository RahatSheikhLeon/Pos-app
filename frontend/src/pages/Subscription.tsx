import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Check, Zap, Monitor, ShieldCheck, Loader2,
  Clock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RootState, AppDispatch } from '../store';
import { fetchProfile } from '../store/slices/authSlice';
import {
  subscriptionPlansApi,
  userSubscriptionsApi,
  paymentsApi,
  devicesApi,
} from '../services/api';
import { SubscriptionPlan, UserSubscription } from '../types';
import Modal from '../components/ui/Modal';

const PLAN_BORDER: Record<string, string> = {
  plan_free:         'border-gray-200 dark:border-gray-700',
  plan_pro_basic:    'border-blue-400',
  plan_pro_standard: 'border-indigo-500',
  plan_pro_premium:  'border-purple-500',
};

const SELECTED_PLAN_KEY = 'shopiq_selected_plan_id';

export default function Subscription() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const [plans, setPlans]               = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription]  = useState<UserSubscription | null>(null);
  const [payments, setPayments]          = useState<{ status: string; planId: string }[]>([]);
  const [devices, setDevices]            = useState<any[]>([]);
  const [loading, setLoading]            = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_PLAN_KEY)
  );
  const [showConfirm, setShowConfirm]    = useState(false);
  const [initiating, setInitiating]      = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, s, pay, d] = await Promise.all([
        subscriptionPlansApi.getAll(),
        userSubscriptionsApi.getMy(),
        paymentsApi.getMine(), // only used for pending-payment guard
        devicesApi.list(),
      ]);
      setPlans(p);
      setSubscription(s);
      setPayments(pay);
      setDevices(d);
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const activePlanId     = subscription?.planId ?? 'plan_free';
  const isPro            = user?.plan !== 'free';
  const selectedPlan     = plans.find((p) => p.id === selectedPlanId) ?? null;

  // Single-subscription guards
  const pendingPayment    = payments.find((p) => p.status === 'pending') ?? null;
  const pendingPlanId     = pendingPayment?.planId ?? null;
  const hasPendingPayment = !!pendingPayment;
  const hasActivePro      = isPro && subscription?.status === 'active' &&
    (!subscription?.expiresAt || new Date(subscription.expiresAt) > new Date());
  const purchaseBlocked   = hasPendingPayment || hasActivePro;

  const blockReason = hasPendingPayment
    ? 'You have a pending payment request. Wait for it to process or contact support.'
    : hasActivePro
      ? 'You already have an active Pro subscription. Purchase again after it expires.'
      : null;

  const selectPlan = (plan: SubscriptionPlan | null) => {
    const id = plan?.id ?? null;
    setSelectedPlanId(id);
    if (id) localStorage.setItem(SELECTED_PLAN_KEY, id);
    else     localStorage.removeItem(SELECTED_PLAN_KEY);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPlan) return;
    setInitiating(true);
    try {
      const result = await paymentsApi.initiate(selectedPlan.id);
      await loadAll();

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl; // real gateway redirect
      } else {
        setShowConfirm(false);
        selectPlan(null);
        toast.success(
          `Payment request created (TXN: ${result.trxId}). Admin will activate your plan after payment.`,
          { duration: 6000 }
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate payment');
    } finally {
      setInitiating(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      await devicesApi.remove(id);
      setDevices((d) => d.filter((dev) => dev.id !== id));
      toast.success('Device removed');
    } catch { toast.error('Failed to remove device'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 text-gray-400">
        <Loader2 size={28} className="animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">

      {/* Current plan banner */}
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <ShieldCheck size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Active Plan</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {subscription?.plan?.name ?? 'Free Plan'}
            </p>
            <p className="text-xs text-gray-400">
              Status: <span className="text-green-500 capitalize">{subscription?.status ?? 'active'}</span>
              {subscription?.expiresAt &&
                ` · Expires ${new Date(subscription.expiresAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        {!isPro && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full font-medium">
            Upgrade to unlock full features
          </span>
        )}
      </div>

      {/* Plan selection grid */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Choose a Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isActive          = plan.id === activePlanId;
            const isSelected        = selectedPlan?.id === plan.id;
            const isFree            = plan.type === 'free';
            const hasPendingHere    = plan.id === pendingPlanId;
            // Pro card is locked when purchase is blocked AND it's not the one with pending
            const isLockedPro       = !isFree && !isActive && purchaseBlocked && !hasPendingHere;
            const clickable         = !isActive && !isFree && !purchaseBlocked;

            return (
              <div
                key={plan.id}
                onClick={() => clickable && selectPlan(isSelected ? null : plan)}
                className={[
                  'relative p-5 rounded-xl border-2 transition-all duration-150',
                  clickable ? 'cursor-pointer' : '',
                  isLockedPro ? 'opacity-50 cursor-not-allowed' : '',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                    : hasPendingHere
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                      : isActive
                        ? 'ring-2 ring-indigo-500 border-indigo-400 bg-white dark:bg-gray-800'
                        : `${PLAN_BORDER[plan.id] ?? ''} bg-white dark:bg-gray-800 ${clickable ? 'hover:border-gray-300 dark:hover:border-gray-600' : ''}`,
                ].join(' ')}
              >
                {/* Top-right badge — priority: Current > Pending > Selected */}
                {isActive && (
                  <span className="absolute top-3 right-3 text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                    Current
                  </span>
                )}
                {hasPendingHere && !isActive && (
                  <span className="absolute top-3 right-3 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Clock size={9} />
                    Pending
                  </span>
                )}
                {isSelected && !isActive && !hasPendingHere && (
                  <span className="absolute top-3 right-3 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                    Selected
                  </span>
                )}
                {plan.id === 'plan_pro_standard' && !isActive && !isSelected && !hasPendingHere && !isLockedPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Popular
                  </span>
                )}

                <p className="font-bold text-gray-900 dark:text-white text-sm">{plan.name}</p>
                <p className="mt-1 mb-3">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-xs text-gray-400 ml-1">/month</span>}
                </p>

                <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <li className="flex items-center gap-1.5">
                    <Monitor size={11} />
                    {plan.maxDevices} device{plan.maxDevices > 1 ? 's' : ''}
                  </li>
                  {(plan.features as string[]).map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check size={11} className="text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Purchase blocked banner */}
      {purchaseBlocked && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{blockReason}</span>
        </div>
      )}

      {/* Buy Plan CTA */}
      {selectedPlan && (
        <div className="card p-5 flex items-center justify-between gap-4 flex-wrap bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedPlan.name} — ${selectedPlan.price}/month
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {purchaseBlocked ? blockReason : 'Confirm details and proceed to payment.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => selectPlan(null)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Deselect
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={purchaseBlocked}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} />
              Buy Plan
            </button>
          </div>
        </div>
      )}

      {/* Active devices */}
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

      {/* Confirm purchase modal */}
      <Modal
        open={showConfirm}
        onClose={() => { if (!initiating) setShowConfirm(false); }}
        title="Confirm Purchase"
        size="sm"
      >
        {selectedPlan && (
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2.5">
              {[
                ['Plan',     selectedPlan.name],
                ['Price',    `$${selectedPlan.price}/month`],
                ['Duration', '30 days'],
                ['Devices',  String(selectedPlan.maxDevices)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Includes</p>
              <ul className="space-y-1.5">
                {(selectedPlan.features as string[]).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={12} className="text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Your plan activates only after successful payment confirmation.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={initiating}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                disabled={initiating}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {initiating
                  ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                  : <><Zap size={14} /> Confirm & Pay</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
