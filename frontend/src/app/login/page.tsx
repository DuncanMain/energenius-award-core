'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join(', ')
            : result.message
        );
      router.replace('/admin');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    const response = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    setBusy(false);
    if (response.ok) {
      router.replace('/admin');
      router.refresh();
    }
  }
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">
          <ShieldCheck size={25} />
        </div>
        <p className="eyebrow">ENERGENIUS CONTROL PLANE</p>
        <h1>Administrator access</h1>
        <p className="muted">
          Sign in with your Nexus user account. Access is granted only when its
          Nexus subject is enabled in the Award System administrator register.
        </p>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Lock size={18} />}{' '}
            Secure sign in
          </button>
          {process.env.NEXT_PUBLIC_ADMIN_PREVIEW_MODE === 'true' && (
            <button type="button" onClick={preview} disabled={busy}>
              Enter local UI preview
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
