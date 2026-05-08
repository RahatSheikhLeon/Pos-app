import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { fetchProfile } from '../store/slices/authSlice';
import { stripeApi } from '../services/api';
import { AppDispatch } from '../store';

export default function PaymentReturn({ type }: { type: 'success' | 'failed' }) {
  const [searchParams] = useSearchParams();
  const navigate      = useNavigate();
  const dispatch      = useDispatch<AppDispatch>();
  const sessionId     = searchParams.get('session_id');

  const [status, setStatus] = useState<'loading' | 'done'>('loading');
  const [message, setMessage] = useState('Confirming your subscription…');

  useEffect(() => {
    const finalise = async () => {
      if (type !== 'success') {
        setStatus('done');
        return;
      }

      // ── Step 1: wait for the Stripe webhook to fire ─────────────────
      // The user is redirected here BEFORE checkout.session.completed is
      // processed. Polling the payment-status endpoint ensures we only
      // refresh the profile AFTER the webhook has updated users.plan.
      setMessage('Waiting for payment confirmation…');

      const MAX_POLLS = 12;       // up to ~18 seconds
      const POLL_INTERVAL = 1500; // ms

      for (let i = 0; i < MAX_POLLS; i++) {
        try {
          const ps = await stripeApi.getPaymentStatus();
          if (ps.status === 'completed') {
            console.log('[PaymentReturn] Payment confirmed by webhook ✅');
            break;
          }
        } catch {
          // Network error — keep trying
        }

        // If we have a session ID, also check the per-session endpoint as fallback
        if (sessionId) {
          try {
            const res = await fetch(`/api/stripe/payment-status/${sessionId}`, {
              credentials: 'include',
            });
            if (res.ok) {
              const data = await res.json();
              if (data.dbStatus === 'completed' || data.liveStatus?.startsWith('completed')) {
                console.log('[PaymentReturn] Per-session status confirmed ✅');
                break;
              }
            }
          } catch {}
        }

        if (i < MAX_POLLS - 1) {
          await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL));
        }
      }

      // ── Step 2: refresh the user profile with the new plan ──────────
      // By now the webhook has updated users.plan in the DB, so
      // fetchProfile() will return the Pro plan slug.
      setMessage('Activating your plan…');
      await dispatch(fetchProfile());

      setStatus('done');
    };

    finalise();
  }, [type, sessionId, dispatch]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="text-indigo-400 animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-8 text-center space-y-5">
        {type === 'success' ? (
          <>
            <CheckCircle2 size={56} className="text-green-400 mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-white">Subscription Active!</h2>
              <p className="text-gray-400 text-sm mt-1">
                Your Pro plan is now active. All features are unlocked.
              </p>
            </div>
            {sessionId && (
              <p className="text-xs text-gray-500 font-mono">
                Session: {sessionId.slice(0, 28)}…
              </p>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <>
            <XCircle size={56} className="text-red-400 mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-white">Payment Cancelled</h2>
              <p className="text-gray-400 text-sm mt-1">
                No charge was made. Your plan has not changed.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/subscription')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Back to Plans
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
