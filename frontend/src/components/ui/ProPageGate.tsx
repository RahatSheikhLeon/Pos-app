import { useNavigate } from 'react-router-dom';
import { Zap, Check, Lock } from 'lucide-react';

const FEATURE_META: Record<string, { title: string; description: string }> = {
  transactions: {
    title: 'Transactions',
    description: 'View full sales history, process returns, and track partial refunds.',
  },
  reports: {
    title: 'Reports & Analytics',
    description: 'Revenue trends, payment distribution, top products, and CSV export.',
  },
};

interface Props {
  feature: string;
}

export default function ProPageGate({ feature }: Props) {
  const navigate = useNavigate();
  const meta = FEATURE_META[feature] ?? {
    title: feature,
    description: 'This feature is available on the Pro plan.',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-5">
        <Lock size={28} className="text-indigo-500" />
      </div>

      <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-2">
        Pro Feature
      </span>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {meta.title}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        {meta.description}
      </p>

      <ul className="text-left space-y-2.5 mb-8">
        {[
          'Full transaction history',
          'Return & refund management',
          'Revenue & profit reports',
          'Payment distribution charts',
          'Top product analytics',
          'Hardware integrations',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
            <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Check size={11} className="text-green-600 dark:text-green-400" />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={() => navigate('/subscription')}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/20"
      >
        <Zap size={16} />
        Upgrade to Pro
      </button>
      <p className="text-xs text-gray-400 mt-3">Activate a license key to unlock instantly</p>
    </div>
  );
}
