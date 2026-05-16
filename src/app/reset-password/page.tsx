'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const resetSchema = z.object({
  password: z.string().min(6, 'Password minimo 6 caratteri'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Le password non coincidono',
  path: ['confirmPassword'],
});

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsValidSession(!!session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setChecking(false);
      } else if (event === 'SIGNED_IN' && session) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const validated = resetSchema.parse({ password, confirmPassword });
      const { error } = await supabase.auth.updateUser({ password: validated.password });
      if (error) throw error;
      toast.success('Password aggiornata!');
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        toast.error('Errore aggiornamento password. Riprova.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        <p className="text-warmText-secondary">Verifica sessione...</p>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <p className="text-warmText-secondary mb-4">Link non valido o scaduto.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-warmAccent-primary text-warmBg-primary font-medium rounded-xl hover:bg-warmAccent-hover transition-colors"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warmBg-primary px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-warmAccent-primary rounded-2xl mb-4">
            <KeyRound className="w-8 h-8 text-warmBg-primary" />
          </div>
          <h2 className="text-3xl font-bold text-warmText-primary mb-2">Nuova Password</h2>
          <p className="text-sm text-warmText-tertiary">Scegli una nuova password per il tuo account</p>
        </div>

        <div className="bg-warmBg-secondary rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-warmText-secondary mb-2">
                Nuova password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
                className="w-full px-4 py-3 bg-warmBg-primary border border-warmText-muted rounded-xl text-base md:text-sm text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warmText-secondary mb-2">
                Conferma password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                required
                className="w-full px-4 py-3 bg-warmBg-primary border border-warmText-muted rounded-xl text-base md:text-sm text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-warmData-expense">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-warmAccent-primary text-warmBg-primary font-semibold rounded-xl hover:bg-warmAccent-hover disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Aggiornamento...' : 'Aggiorna password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
