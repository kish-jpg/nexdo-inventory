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

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, var(--red) 0%, #b91c1c 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', color: '#fff', boxShadow: '0 8px 24px rgba(220,38,38,0.35)',
        }}>
          <HotelIcon />
        </div>

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
          NexDo Inventory
        </div>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          Radisson RED Auckland
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 36px' }}>
          Enter your access PIN to continue
        </p>

        {/* PIN inputs */}
        <div
          style={{
            display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24,
            animation: shake ? 'shake 0.4s ease' : undefined,
          }}
          onPaste={handlePaste}
        >
          <style>{`
            @keyframes shake {
              0%,100%{transform:translateX(0)}
              20%{transform:translateX(-8px)}
              40%{transform:translateX(8px)}
              60%{transform:translateX(-8px)}
              80%{transform:translateX(4px)}
            }
          `}</style>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={{
                width: 56, height: 64, textAlign: 'center', fontSize: 24, fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                background: 'var(--card-bg)', border: `2px solid ${d ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 12, color: 'var(--text)', outline: 'none',
                caretColor: 'transparent', transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: d ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red-soft)', border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--red)',
            marginBottom: 20, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={() => { const pin = digits.join(''); if (pin.length === PIN_LENGTH) handleSubmit(pin); }}
          disabled={loading || digits.join('').length < PIN_LENGTH}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
            background: digits.join('').length === PIN_LENGTH ? 'var(--red)' : 'var(--hover-bg)',
            color: digits.join('').length === PIN_LENGTH ? '#fff' : 'var(--text-subtle)',
            fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif',
            cursor: digits.join('').length === PIN_LENGTH ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s', letterSpacing: '0.02em',
          }}
        >
          {loading ? 'Verifying…' : 'Access System'}
        </button>

        <p style={{ color: 'var(--text-subtle)', fontSize: 11, marginTop: 24, lineHeight: 1.5 }}>
          Contact your NexDo manager if you don't have a PIN
        </p>
      </div>
    </div>
  );
}
