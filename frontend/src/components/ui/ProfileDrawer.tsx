import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  X, User, KeyRound, Mail, Eye, EyeOff,
  Loader2, CheckCircle, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import { RootState } from '../../store';
import { authApi } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────
type ActiveTab  = 'change' | 'reset';
type ResetStage = 'send' | 'otp' | 'newpw';

interface ProfileDrawerProps {
  open:              boolean;
  onClose:           () => void;
  onPasswordChanged: () => void; // called after any successful password update
}

const RESEND_COOLDOWN = 60;

// ── Small helpers ──────────────────────────────────────────────────────
function PwInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="w-full px-3 py-2.5 pr-9 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-xs px-3 py-2.5 rounded-lg">
      {msg}
    </div>
  );
}

function SuccessCard({ message, note }: { message: string; note?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-6">
      <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle size={28} className="text-green-500" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{message}</p>
        {note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────
export default function ProfileDrawer({ open, onClose, onPasswordChanged }: ProfileDrawerProps) {
  const { user } = useSelector((state: RootState) => state.auth);

  const [activeTab, setActiveTab] = useState<ActiveTab>('change');

  // ── Change-password state ────────────────────────────────────────
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [chgLoading, setChgLoading] = useState(false);
  const [chgError,   setChgError]   = useState<string | null>(null);
  const [chgDone,    setChgDone]    = useState(false);

  // ── OTP-reset state ──────────────────────────────────────────────
  const [resetStage,  setResetStage]  = useState<ResetStage>('send');
  const [otp,         setOtp]         = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [resetNewPw,  setResetNewPw]  = useState('');
  const [resetConPw,  setResetConPw]  = useState('');
  const [rstLoading,  setRstLoading]  = useState(false);
  const [rstError,    setRstError]    = useState<string | null>(null);
  const [rstDone,     setRstDone]     = useState(false);
  const [cooldown,    setCooldown]    = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef    = useRef<HTMLInputElement>(null);

  const email = user?.email ?? '';

  // Escape key closes the drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-redirect after success
  useEffect(() => {
    if (chgDone || rstDone) {
      const t = setTimeout(onPasswordChanged, 2000);
      return () => clearTimeout(t);
    }
  }, [chgDone, rstDone, onPasswordChanged]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Reset internal state when drawer closes so next open is clean
  useEffect(() => {
    if (!open) {
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setChgLoading(false); setChgError(null); setChgDone(false);
      setOtp(''); setResetToken(''); setResetNewPw(''); setResetConPw('');
      setRstLoading(false); setRstError(null); setRstDone(false);
      setResetStage('send'); setCooldown(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(timerRef.current!); return 0; } return c - 1; });
    }, 1000);
  }

  // ── Change-password submit ─────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { setChgError('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setChgError('New passwords do not match'); return; }
    setChgLoading(true); setChgError(null);
    try {
      await authApi.changePassword(curPw, newPw);
      setChgDone(true);
    } catch (err: any) {
      setChgError(err.message || 'Password change failed');
    } finally {
      setChgLoading(false);
    }
  };

  // ── OTP-reset: send OTP ────────────────────────────────────────────
  const handleSendOtp = async () => {
    setRstLoading(true); setRstError(null);
    try {
      await authApi.forgotPassword(email);
      setResetStage('otp');
      setOtp('');
      startCooldown();
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err: any) {
      setRstError(err.message || 'Failed to send code');
    } finally {
      setRstLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setRstLoading(true); setRstError(null);
    try {
      await authApi.forgotPassword(email);
      setOtp('');
      startCooldown();
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err: any) {
      setRstError(err.message || 'Resend failed');
    } finally {
      setRstLoading(false);
    }
  };

  // ── OTP-reset: verify OTP ─────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setRstLoading(true); setRstError(null);
    try {
      const { resetToken: token } = await authApi.verifyResetOtp(email, otp);
      setResetToken(token);
      setResetStage('newpw');
    } catch (err: any) {
      setRstError(err.message || 'Invalid code');
    } finally {
      setRstLoading(false);
    }
  };

  // ── OTP-reset: set new password ───────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPw.length < 6) { setRstError('Password must be at least 6 characters'); return; }
    if (resetNewPw !== resetConPw) { setRstError('Passwords do not match'); return; }
    setRstLoading(true); setRstError(null);
    try {
      await authApi.resetPassword(email, resetToken, resetNewPw);
      setRstDone(true);
    } catch (err: any) {
      setRstError(err.message || 'Password reset failed');
    } finally {
      setRstLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Drawer header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Account Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* User info card */}
          <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                {user?.name
                  ? <span className="text-base font-bold text-indigo-600 dark:text-indigo-300">{initials}</span>
                  : <User size={20} className="text-indigo-500" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                <span className="inline-block mt-0.5 text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full capitalize">
                  {user?.plan === 'free' ? 'Free' : user?.plan?.replace('_', ' ') ?? 'Free'} Plan
                </span>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 px-5 flex-shrink-0">
            {(['change', 'reset'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'change' ? <><KeyRound size={13} /> Change Password</> : <><Mail size={13} /> Reset via OTP</>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-5 py-5">

            {/* ════ CHANGE PASSWORD TAB ════ */}
            {activeTab === 'change' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={15} className="text-indigo-500" />
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                    Update Password
                  </p>
                </div>

                {chgDone ? (
                  <SuccessCard
                    message="Password changed!"
                    note="All sessions have been signed out. You'll be redirected to login…"
                  />
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <ErrorBanner msg={chgError} />

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Current password
                      </label>
                      <PwInput
                        value={curPw}
                        onChange={(v) => { setCurPw(v); setChgError(null); }}
                        placeholder="Current password"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        New password
                      </label>
                      <PwInput
                        value={newPw}
                        onChange={(v) => { setNewPw(v); setChgError(null); }}
                        placeholder="Min. 6 characters"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Confirm new password
                      </label>
                      <PwInput
                        value={confirmPw}
                        onChange={(v) => { setConfirmPw(v); setChgError(null); }}
                        placeholder="Repeat new password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={chgLoading || !curPw || !newPw || !confirmPw}
                      className="w-full py-2.5 mt-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {chgLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Updating…</>
                        : <><KeyRound size={13} /> Save New Password</>}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ════ RESET VIA OTP TAB ════ */}
            {activeTab === 'reset' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={15} className="text-amber-500" />
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                    Reset via Email OTP
                  </p>
                </div>

                {/* DONE */}
                {rstDone && (
                  <SuccessCard
                    message="Password reset!"
                    note="All sessions have been signed out. You'll be redirected to login…"
                  />
                )}

                {/* STAGE: send */}
                {!rstDone && resetStage === 'send' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      We'll send a 6-digit reset code to your registered email address.
                    </p>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Mail size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{email}</span>
                    </div>

                    <ErrorBanner msg={rstError} />

                    <button
                      onClick={handleSendOtp}
                      disabled={rstLoading}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {rstLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                        : <><Mail size={13} /> Send Reset Code</>}
                    </button>
                  </div>
                )}

                {/* STAGE: otp */}
                {!rstDone && resetStage === 'otp' && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => { setResetStage('send'); setRstError(null); setOtp(''); }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <ArrowLeft size={13} /> Back
                    </button>

                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      Enter the 6-digit code sent to{' '}
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{email}</span>.
                      It expires in 10 minutes.
                    </p>

                    <ErrorBanner msg={rstError} />

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Reset code
                      </label>
                      <input
                        ref={otpRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => { setRstError(null); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                        placeholder="------"
                        className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-center text-xl font-mono tracking-[0.5em] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={rstLoading || otp.length !== 6}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {rstLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Verifying…</>
                        : 'Verify Code'}
                    </button>

                    <div className="text-center">
                      {cooldown > 0 ? (
                        <p className="text-xs text-gray-500">
                          Resend in <span className="text-gray-300 font-medium tabular-nums">{cooldown}s</span>
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={rstLoading}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* STAGE: new password */}
                {!rstDone && resetStage === 'newpw' && (
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      Identity verified. Choose a new password for your account.
                    </p>

                    <ErrorBanner msg={rstError} />

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        New password
                      </label>
                      <PwInput
                        value={resetNewPw}
                        onChange={(v) => { setResetNewPw(v); setRstError(null); }}
                        placeholder="Min. 6 characters"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Confirm password
                      </label>
                      <PwInput
                        value={resetConPw}
                        onChange={(v) => { setResetConPw(v); setRstError(null); }}
                        placeholder="Repeat new password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={rstLoading || !resetNewPw || !resetConPw}
                      className="w-full py-2.5 mt-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {rstLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                        : <><KeyRound size={13} /> Save Password</>}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
