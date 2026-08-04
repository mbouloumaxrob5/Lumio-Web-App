'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, username })
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Erreur lors de l\'inscription');
        setLoading(false);
        return;
      }

      // Auto sign-in after registration
      const signInRes = await signIn('credentials', { redirect: false, email, password } as any);
      if (signInRes?.ok) {
        window.location.href = '/';
      } else {
        setError('Inscription réussie — impossible de se connecter automatiquement.');
      }
    } catch (err) {
      console.error(err);
      setError('Erreur interne');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Créer un compte</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nom d'utilisateur</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>
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
          <button type="submit" disabled={loading} className="w-full rounded bg-black text-white py-2">
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </div>
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  );
}
