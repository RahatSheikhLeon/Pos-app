import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Monitor, Trash2, Plus, Zap, AlertTriangle,
  RefreshCw, Clock, Shield, ChevronRight,
} from 'lucide-react';
import { devicesApi, stripeApi } from '../services/api';
import { recheckDeviceLimit } from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';
import { getDeviceId } from '../utils/deviceId';

interface DeviceRow {
  id:        string;
  name:      string;
  lastSeen:  string;
  isCurrent: boolean;
}

interface LimitInfo {
  devices:       DeviceRow[];
  count:         number;
  baseLimit:     number;
  extraDevices:  number;
  effectiveLimit: number;
  limitReached:  boolean;
  endDate:       string | null;
  planName:      string;
  billingCycle:  string;
}

interface SlotPrice {
  priceUsd:     number;
  remainingDays: number;
  dailyRate:    number;
  currentLimit: number;
  newLimit:     number;
  endDate:      string;
  billingCycle: string;
}

function timeAgo(iso: string) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DeviceLimitReached() {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useSelector((state: RootState) => state.auth);

  const [info,       setInfo]       = useState<LimitInfo | null>(null);
  const [slotPrice,  setSlotPrice]  = useState<SlotPrice | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [removing,   setRemoving]   = useState<string | null>(null);
  const [buying,     setBuying]     = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fingerprint = getDeviceId();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoData, priceData] = await Promise.allSettled([
        devicesApi.limitInfo(fingerprint),
        stripeApi.deviceSlotPrice(),
      ]);
      if (infoData.status  === 'fulfilled') setInfo(infoData.value);
      if (priceData.status === 'fulfilled') setSlotPrice(priceData.value);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load device info');
    } finally {
      setLoading(false);
    }
  }, [fingerprint]);

  const handleRecheck = useCallback(async () => {
    setRechecking(true);
    setError(null);
    try {
      const result = await dispatch(recheckDeviceLimit(fingerprint)).unwrap();
      if (!result.deviceLimitReached) {
        navigate('/dashboard', { replace: true });
      } else {
        await loadData();
      }
    } catch {
      setError('Still over device limit. Remove a device or purchase an extra slot.');
    } finally {
      setRechecking(false);
    }
  }, [dispatch, fingerprint, loadData, navigate]);

  // On mount: load data, then re-check if coming from payment success
  useEffect(() => {
    loadData().then(() => {
      if (new URLSearchParams(location.search).get('refresh') === 'true') {
        handleRecheck();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemove = async (deviceId: string) => {
    setRemoving(deviceId);
    setError(null);
    try {
      await devicesApi.remove(deviceId);
      // Optimistic UI update
      setInfo((prev) =>
        prev ? { ...prev, devices: prev.devices.filter((d) => d.id !== deviceId), count: prev.count - 1 } : prev,
      );
      await handleRecheck();
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove device');
    } finally {
      setRemoving(null);
    }
  };

  const handleBuySlot = async () => {
    setBuying(true);
    setError(null);
    try {
      const { sessionUrl } = await stripeApi.deviceSlotCheckout();
      window.location.href = sessionUrl;
    } catch (e: any) {
      setError(e.message ?? 'Failed to start checkout');
      setBuying(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading device info…</p>
        </div>
      </div>
    );
  }

  const devices       = info?.devices ?? [];
  const count         = info?.count ?? 0;
  const effectiveLimit = info?.effectiveLimit ?? 1;
  const isPaidPlan    = !!slotPrice;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-semibold text-white">ShopIQ</span>
        </div>
        {user && (
          <span className="text-sm text-gray-400">{user.email}</span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Warning banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white mb-1">Device limit reached</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Your <span className="text-white font-medium">{info?.planName ?? 'current'}</span> plan
                allows <span className="text-white font-medium">{effectiveLimit} device{effectiveLimit !== 1 ? 's' : ''}</span>.
                You've registered <span className="text-white font-medium">{count}</span>.
                This browser isn't authorised yet — remove an existing device or purchase an extra slot.
              </p>
            </div>
          </div>

          {/* Device usage bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Devices used</span>
              <span className="text-white font-medium">{count} / {effectiveLimit}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${Math.min((count / effectiveLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Registered devices list */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-gray-400" />
              <h2 className="font-medium text-white text-sm">Registered Devices</h2>
            </div>
            <span className="text-xs text-gray-500">{count} of {effectiveLimit} slots used</span>
          </div>

          {devices.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">No devices registered</div>
          ) : (
            <ul className="divide-y divide-gray-700/60">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    device.isCurrent ? 'bg-indigo-500/20' : 'bg-gray-700'
                  }`}>
                    <Monitor size={16} className={device.isCurrent ? 'text-indigo-400' : 'text-gray-400'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{device.name}</span>
                      {device.isCurrent && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={11} className="text-gray-500" />
                      <span className="text-xs text-gray-500">Last seen {timeAgo(device.lastSeen)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(device.id)}
                    disabled={!!removing || rechecking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent
                      hover:border-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {removing === device.id
                      ? <span className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      : <Trash2 size={13} />
                    }
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Re-check button (after manual removal the recheck is auto, but also show a manual trigger) */}
        <button
          onClick={handleRecheck}
          disabled={rechecking || !!removing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-700
            text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={rechecking ? 'animate-spin' : ''} />
          {rechecking ? 'Checking…' : 'Re-check access'}
        </button>

        {/* Extra slot purchase — only for paid plan users */}
        {isPaidPlan && slotPrice && (
          <div className="bg-gray-800 rounded-2xl border border-indigo-500/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2">
              <Shield size={16} className="text-indigo-400" />
              <h2 className="font-medium text-white text-sm">Add Extra Device Slot</h2>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Pricing breakdown */}
              <div className="bg-gray-700/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Current limit</span>
                  <span className="text-white">{slotPrice.currentLimit} device{slotPrice.currentLimit !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>New limit after purchase</span>
                  <span className="text-indigo-300 font-medium">{slotPrice.newLimit} devices</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Days remaining in billing period</span>
                  <span className="text-white">{slotPrice.remainingDays} days</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Daily rate per device slot</span>
                  <span className="text-white">${slotPrice.dailyRate.toFixed(2)}/day</span>
                </div>
                <div className="pt-2 border-t border-gray-600 flex justify-between font-semibold">
                  <span className="text-white">Prorated total</span>
                  <span className="text-indigo-300 text-base">${slotPrice.priceUsd.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                One-time charge for the remaining {slotPrice.remainingDays} days of your{' '}
                {slotPrice.billingCycle} billing period. The extra slot expires with your subscription.
              </p>

              <button
                onClick={handleBuySlot}
                disabled={buying || rechecking}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl
                  font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {buying
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                  : <><Plus size={15} /> Buy Extra Slot — ${slotPrice.priceUsd.toFixed(2)}<ChevronRight size={14} /></>
                }
              </button>
            </div>
          </div>
        )}

        {/* Free plan users — show upgrade nudge instead */}
        {!isPaidPlan && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 px-5 py-5 text-center">
            <p className="text-sm text-gray-400 mb-3">
              Extra device slots are only available on paid plans.
            </p>
            <a
              href="/subscription"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500
                text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Zap size={14} /> Upgrade to Pro
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
