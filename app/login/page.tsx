'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';

const HotelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const PIN_LENGTH = 4;

export default function LoginPage() {
  const { login, role } = useAuth();
  const router = useRouter();

  const [digits, setDigits]     = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);
  const inputRefs               = useRef<(HTMLInputElement | null)[]>([]);

  // If already logged in, redirect
  useEffect(() => {
    if (role) router.replace('/');
  }, [role, router]);

  async function handleSubmit(pin: string) {
    setLoading(true);
    setError('');
    const result = await login(pin);
    setLoading(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.error ?? 'Invalid PIN');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setDigits(Array(PIN_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  }

  function handleDigit(index: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = v;
    setDigits(newDigits);
    setError('');

    if (v && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (v && index === PIN_LENGTH - 1) {
      const pin = [...newDigits.slice(0, -1), v].join('');
      if (pin.length === PIN_LENGTH) handleSubmit(pin);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const pin = digits.join('');
      if (pin.length === PIN_LENGTH) handleSubmit(pin);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (pasted.length === PIN_LENGTH) {
      setDigits(pasted.split(''));
      handleSubmit(pasted);
    }
  }

  const pinFull = digits.join('').length === PIN_LENGTH;

  return (
    <div className="login-wrap">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo"><HotelIcon /></div>

        <div className="login-eyebrow">NexDo Inventory</div>
        <h1 className="login-title">Radisson RED Auckland</h1>
        <p className="login-sub">Enter your access PIN to continue</p>

        {/* PIN inputs */}
        <div
          className={`login-pin-row${shake ? ' is-shaking' : ''}`}
          onPaste={handlePaste}
          aria-label="PIN entry"
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              aria-label={`PIN digit ${i + 1}`}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`login-pin-input${d ? ' has-digit' : ''}`}
            />
          ))}
        </div>

        {/* Error */}
        {error && <div className="login-error" role="alert">{error}</div>}

        {/* Submit button */}
        <button
          onClick={() => { if (pinFull) handleSubmit(digits.join('')); }}
          disabled={loading || !pinFull}
          className={`login-btn${pinFull ? ' is-ready' : ' not-ready'}`}
        >
          {loading ? 'Verifying…' : 'Access System'}
        </button>

        <p className="login-hint">
          Contact your NexDo manager if you don&apos;t have a PIN
        </p>
      </div>
    </div>
  );
}
