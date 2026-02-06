'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { upsertWealthSnapshot } from '@/lib/wealth';

// Zod schema for wealth form validation
const wealthSchema = z.object({
  investments: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num >= 0;
    },
    { message: 'Investimenti deve essere un numero >= 0' }
  ),
  savings: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num >= 0;
    },
    { message: 'Risparmi deve essere un numero >= 0' }
  ),
});

interface WealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  year: number;
  month: number;
  initialData?: { investments: number; savings: number };
}

export default function WealthModal({
  isOpen,
  onClose,
  onSuccess,
  year,
  month,
  initialData,
}: WealthModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    investments: '',
    savings: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form with initial data when modal opens or data changes
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        investments: initialData.investments.toFixed(2).replace('.', ','),
        savings: initialData.savings.toFixed(2).replace('.', ','),
      });
    } else if (isOpen && !initialData) {
      // Reset form if no initial data
      setFormData({
        investments: '0',
        savings: '0',
      });
    }
    setErrors({});
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Devi essere autenticato');
      return;
    }

    // Validate form data
    const result = wealthSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse values (handle comma decimal separator)
      const investments = parseFloat(formData.investments.replace(',', '.'));
      const savings = parseFloat(formData.savings.replace(',', '.'));

      // Upsert wealth snapshot
      const success = await upsertWealthSnapshot(user.id, year, month, investments, savings);

      if (success) {
        toast.success('Patrimonio aggiornato!');
        onSuccess();
        onClose();
      } else {
        toast.error('Errore durante il salvataggio');
      }
    } catch (error) {
      console.error('Error saving wealth:', error);
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = initialData && (initialData.investments > 0 || initialData.savings > 0);
  const modalTitle = isEditing ? 'Modifica Patrimonio' : 'Imposta Patrimonio';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-warmBg-secondary rounded-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-warmText-primary">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-warmText-tertiary hover:text-warmText-primary transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Investments Input */}
          <div>
            <label htmlFor="investments" className="block text-sm font-medium text-warmText-secondary mb-2">
              Investimenti totali (€)
            </label>
            <input
              id="investments"
              type="text"
              value={formData.investments}
              onChange={(e) => setFormData({ ...formData, investments: e.target.value })}
              placeholder="0,00"
              className={`w-full px-4 py-3 bg-warmBg-primary border ${
                errors.investments ? 'border-warmData-expense' : 'border-warmBorder'
              } rounded-xl text-warmText-primary placeholder-warmText-tertiary focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:border-transparent`}
            />
            {errors.investments && (
              <p className="mt-1 text-xs text-warmData-expense">{errors.investments}</p>
            )}
          </div>

          {/* Savings Input */}
          <div>
            <label htmlFor="savings" className="block text-sm font-medium text-warmText-secondary mb-2">
              Risparmi totali (€)
            </label>
            <input
              id="savings"
              type="text"
              value={formData.savings}
              onChange={(e) => setFormData({ ...formData, savings: e.target.value })}
              placeholder="0,00"
              className={`w-full px-4 py-3 bg-warmBg-primary border ${
                errors.savings ? 'border-warmData-expense' : 'border-warmBorder'
              } rounded-xl text-warmText-primary placeholder-warmText-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.savings && (
              <p className="mt-1 text-xs text-warmData-expense">{errors.savings}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-warmBg-primary text-warmText-secondary rounded-full font-semibold hover:bg-warmBorder transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-warmData-investment text-white rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
