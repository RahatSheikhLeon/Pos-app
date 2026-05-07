import { useNavigate } from 'react-router-dom';
import { Zap, X, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function UpgradeModal({ open, onClose, featureName = 'This feature' }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-7 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center mb-4">
            <Zap size={24} className="text-indigo-600 dark:text-indigo-400" />
          </div>

          <span className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-1">
            Pro Feature
          </span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {featureName} requires Pro
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
            Upgrade your plan to unlock hardware integrations, advanced exports, and unlimited access across your POS.
          </p>

          <ul className="w-full text-left space-y-2 mb-6">
            {['Unlimited products & customers', 'Multi-device access', 'Hardware integrations', 'Priority support'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Check size={14} className="text-green-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="w-full space-y-2">
            <button
              onClick={() => { navigate('/subscription'); onClose(); }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={15} />
              Upgrade to Pro
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
