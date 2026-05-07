import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap, Check } from 'lucide-react';

interface Props {
  locked: boolean;
  feature: string;
  fullPage?: boolean;
  children: React.ReactNode;
}

const FEATURE_COPY: Record<string, { title: string; body: string }> = {
  transactions: {
    title: 'Transactions',
    body: 'Full sales history, return management, and partial refund tracking.',
  },
  reports: {
    title: 'Reports & Analytics',
    body: 'Revenue trends, payment distribution, top products, and PDF export.',
  },
  settings_hardware: {
    title: 'Hardware Integrations',
    body: 'Configure receipt printers, cash drawers, and barcode scanners.',
  },
};

const PRO_PERKS = [
  'Unlimited products & customers',
  'Full transaction history',
  'Analytics & reports',
  'Hardware device support',
];

export default function ProBlurGate({ locked, feature, fullPage = false, children }: Props) {
  const navigate = useNavigate();
  const copy = FEATURE_COPY[feature] ?? { title: feature, body: 'This feature requires Pro.' };

  // Lock body scroll while the gate is active
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  return (
    <div
      className="relative"
      style={fullPage && !locked ? undefined : fullPage ? { minHeight: 'calc(100vh - 10rem)' } : undefined}
    >
      {/* ── Content layer — blurred & non-interactive when locked ── */}
      <div
        aria-hidden={locked}
        style={
          locked
            ? { filter: 'blur(3px)', opacity: 0.3, pointerEvents: 'none', userSelect: 'none' }
            : undefined
        }
      >
        {children}
      </div>

      {/* ── Upgrade overlay — fixed so it never scrolls out of view ── */}
      {locked && (
        <>
          {/* Subtle tint layer — absolute, covers only the content area */}
          <div className="absolute inset-0 z-30 rounded-xl bg-white/5 dark:bg-gray-950/20 pointer-events-none" />

          {/* Card — fixed to viewport, always centred regardless of scroll position */}
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none"
            aria-modal="true"
            role="dialog"
          >
            <div className="pointer-events-auto w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xl p-7 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4">
                <Lock size={26} className="text-indigo-500" />
              </div>

              <span className="text-[11px] font-bold tracking-widest text-indigo-500 uppercase mb-1">
                Pro Feature
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
                {copy.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                {copy.body}
              </p>

              <ul className="w-full text-left space-y-2 mb-6">
                {PRO_PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-green-600 dark:text-green-400" />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/subscription')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <Zap size={15} />
                Go to Pro — Upgrade Now
              </button>
              <p className="text-xs text-gray-400 mt-3">
                Already have a license key? Activate it on the Subscription page.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
