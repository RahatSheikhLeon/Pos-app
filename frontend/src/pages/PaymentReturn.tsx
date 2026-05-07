import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { paymentsApi } from '../services/api';
import { fetchProfile } from '../store/slices/authSlice';
import { AppDispatch } from '../store';

type ReturnStatus = 'loading' | 'success' | 'failed' | 'error';

export default function PaymentReturn({ type }: { type: 'success' | 'failed' }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const trxId = searchParams.get('trx_id') ?? '';
  const [status, setStatus] = useState<ReturnStatus>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!trxId) { setStatus('error'); setMessage('Missing transaction ID.'); return; }

    const confirm = async () => {
      try {
        if (type === 'success') {
          await paymentsApi.confirmSuccess(trxId);
          await dispatch(fetchProfile()); // refresh JWT plan in Redux
          setStatus('success');
          setMessage('Payment confirmed! Your subscription has been activated.');
        } else {
          await paymentsApi.confirmFailed(trxId);
          setStatus('failed');
          setMessage('Payment was not completed. Your plan has not changed.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Something went wrong confirming your payment.');
      }
    };

    confirm();
  }, [trxId, type, dispatch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Confirming your payment…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={52} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <p className="text-xs text-gray-400 font-mono mb-6">TXN: {trxId}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {(status === 'failed' || status === 'error') && (
          <>
            <XCircle size={52} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {status === 'failed' ? 'Payment Failed' : 'Error'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/subscription')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Back to Subscription
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
