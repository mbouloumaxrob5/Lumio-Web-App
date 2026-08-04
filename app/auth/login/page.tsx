'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password
    } as any);
    setLoading(false);
    if (res?.ok) {
      // Redirect to home
      window.location.href = '/';
    } else {
      setError((res as any)?.error || 'Invalid credentials');
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Se connecter</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black text-white py-2"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
        {error && <p className="text-red-600">{error}</p>}
      </form>

      <div className="mt-6">
        <p className="text-sm">Ou se connecter via</p>
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => signIn('google')}
            className="rounded border px-3 py-2"
          >
            Google
          </button>
          <button
            onClick={() => signIn('github')}
            className="rounded border px-3 py-2"
          >
            GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
