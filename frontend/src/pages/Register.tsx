import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';
import {
  startRegistration,
  verifyRegistration,
  resendRegistrationOtp,
  clearError,
  clearPending,
} from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';

const RESEND_COOLDOWN_S = 60;

export default function Register() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const { loading, error, user, pendingEmail } = useSelector((state: RootState) => state.auth);

  // Form fields — kept alive when switching to OTP stage
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP stage
  const [otp,          setOtp]          = useState('');
  const [cooldown,     setCooldown]     = useState(0); // seconds until resend is allowed
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Navigate away once fully authenticated
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Clean up on unmount
  useEffect(() => () => {
    dispatch(clearError());
    dispatch(clearPending());
    if (timerRef.current) clearInterval(timerRef.current);
  }, [dispatch]);

  // Focus OTP input when OTP stage appears
  useEffect(() => {
    if (pendingEmail) {
      setOtp('');
      startCooldown();
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEmail]);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_S);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(startRegistration({ name, email, password }));
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmail || otp.length !== 6) return;
    dispatch(verifyRegistration({ email: pendingEmail, otp }));
  };

  const handleResend = async () => {
    if (!pendingEmail || cooldown > 0) return;
    dispatch(clearError());
    await dispatch(resendRegistrationOtp(pendingEmail));
    startCooldown();
  };

  const handleBack = () => {
    dispatch(clearError());
    dispatch(clearPending());
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ── OTP stage ─────────────────────────────────────────────────────
  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">ShopIQ</h1>
          </div>

          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors"
            >
              <ArrowLeft size={15} />
              Back
            </button>

            <div className="flex items-center justify-center w-12 h-12 bg-indigo-500/15 rounded-xl mb-4 mx-auto">
              <Mail size={22} className="text-indigo-400" />
            </div>

            <h2 className="text-xl font-semibold text-white text-center mb-1">Check your inbox</h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              We sent a 6-digit code to{' '}
              <span className="text-white font-medium">{pendingEmail}</span>.<br />
              It expires in 10 minutes.
            </p>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Verification code
                </label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => {
                    dispatch(clearError());
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="------"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? 'Verifying…' : 'Verify & Create Account'}
              </button>
            </form>

            <div className="mt-5 text-center">
              {cooldown > 0 ? (
                <p className="text-sm text-gray-500">
                  Resend code in <span className="text-gray-300 font-medium tabular-nums">{cooldown}s</span>
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
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form stage ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ShopIQ</h1>
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
          <h2 className="text-xl font-semibold text-white mb-1">Create account</h2>
          <p className="text-gray-400 text-sm mb-6">Start with the free plan — no credit card required</p>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Shop Name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="My Shop"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Sending code…' : 'Continue with Email'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-700 space-y-1 text-xs text-gray-400">
            <p>✓ 50 products free  ✓ 5 customers free  ✓ 1 device</p>
          </div>

          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
