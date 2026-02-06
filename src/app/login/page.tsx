'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(formData);
      await signIn(validated.email, validated.password);
      toast.success('Accesso effettuato!');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Credenziali non valide. Riprova.');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errors[e.target.name as keyof LoginFormData]) {
      setErrors({
        ...errors,
        [e.target.name]: undefined,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warmBg-primary px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-warmAccent-primary rounded-2xl mb-4">
            <LogIn className="w-8 h-8 text-warmBg-primary" />
          </div>
          <h2 className="text-3xl font-bold text-warmText-primary mb-2">
            Bentornato
          </h2>
          <p className="text-sm text-warmText-tertiary">
            Accedi per gestire le tue finanze
          </p>
        </div>

        <div className="bg-warmBg-secondary rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-warmText-secondary mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary transition-colors"
                placeholder="tua@email.com"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-warmData-expense">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-warmText-secondary mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary transition-colors"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-2 text-sm text-warmData-expense">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-warmAccent-primary text-warmBg-primary font-semibold rounded-xl hover:bg-warmAccent-hover focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-offset-2 focus:ring-offset-warmBg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-warmText-tertiary">
              Non hai un account?{' '}
              <Link href="/register" className="font-semibold text-warmAccent-primary hover:text-warmAccent-hover transition-colors">
                Registrati
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
