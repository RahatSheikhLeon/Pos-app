import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Mail, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react';
import { authApi } from '../services/api';

type Stage = 'email' | 'otp' | 'reset' | 'done';

const RESEND_COOLDOWN_S = 60;

function timeAgo(s: number) {
  return `${s}s`;
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage]             = useState<Stage>('email');
  const [email, setEmail]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef     = useRef<HTMLInputElement>(null);
  const newPwRef   = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_S);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(timerRef.current!); return 0; } return c - 1; });
    }, 1000);
  }

  // ── Stage 1: submit email ─────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setOtp('');
      setStage('otp');
      startCooldown();
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ── Stage 2: verify OTP ───────────────────────────────────────────
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const { resetToken: token } = await authApi.verifyResetOtp(email, otp);
      setResetToken(token);
      setStage('reset');
      setTimeout(() => newPwRef.current?.focus(), 80);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setOtp('');
      startCooldown();
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err: any) {
      setError(err.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  // ── Stage 3: set new password ─────────────────────────────────────
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPw) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(email, resetToken, newPassword);
      setStage('done');
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared shell ──────────────────────────────────────────────────
  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ShopIQ</h1>
        </div>
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
          {content}
        </div>
      </div>
    </div>
  );

  // ── Stage: email ──────────────────────────────────────────────────
  if (stage === 'email') return shell(
    <>
      <Link
        to="/login"
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Back to login
      </Link>

      <div className="flex items-center justify-center w-12 h-12 bg-indigo-500/15 rounded-xl mb-4 mx-auto">
        <KeyRound size={22} className="text-indigo-400" />
      </div>

      <h2 className="text-xl font-semibold text-white text-center mb-1">Forgot password?</h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        Enter your email address and we'll send you a reset code.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {loading ? 'Sending code…' : 'Send Reset Code'}
        </button>
      </form>
    </>
  );

  // ── Stage: otp ────────────────────────────────────────────────────
  if (stage === 'otp') return shell(
    <>
      <button
        onClick={() => { setStage('email'); setError(null); setOtp(''); }}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-center justify-center w-12 h-12 bg-amber-500/15 rounded-xl mb-4 mx-auto">
        <Mail size={22} className="text-amber-400" />
      </div>

      <h2 className="text-xl font-semibold text-white text-center mb-1">Check your inbox</h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        We sent a 6-digit reset code to{' '}
        <span className="text-white font-medium">{email}</span>.
        <br />It expires in 10 minutes.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleOtpSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Reset code</label>
          <input
            ref={otpRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => { setError(null); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
            className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="------"
          />
        </div>
        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {loading ? 'Verifying…' : 'Verify Code'}
        </button>
      </form>

      <div className="mt-5 text-center">
        {cooldown > 0 ? (
          <p className="text-sm text-gray-500">
            Resend in <span className="text-gray-300 font-medium tabular-nums">{timeAgo(cooldown)}</span>
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            Resend code
          </button>
        )}
      </div>
    </>
  );

  // ── Stage: reset ──────────────────────────────────────────────────
  if (stage === 'reset') return shell(
    <>
      <div className="flex items-center justify-center w-12 h-12 bg-green-500/15 rounded-xl mb-4 mx-auto">
        <KeyRound size={22} className="text-green-400" />
      </div>

      <h2 className="text-xl font-semibold text-white text-center mb-1">Set new password</h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        Choose a strong password. It must be at least 6 characters.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleResetSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">New password</label>
          <div className="relative">
            <input
              ref={newPwRef}
              type={showNew ? 'text' : 'password'}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
              placeholder="Min. 6 characters"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setError(null); }}
              placeholder="Repeat new password"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !newPassword || !confirmPw}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {loading ? 'Saving…' : 'Save New Password'}
        </button>
      </form>
    </>
  );

  // ── Stage: done ───────────────────────────────────────────────────
  return shell(
    <div className="text-center space-y-5">
      <div className="flex items-center justify-center w-14 h-14 bg-green-500/15 rounded-2xl mx-auto">
        <CheckCircle size={28} className="text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Password updated</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Your password has been reset successfully.
          You can now sign in with your new password.
        </p>
      </div>
      <button
        onClick={() => navigate('/login', { replace: true })}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
      >
        Go to Login
      </button>
    </div>
  );
}
