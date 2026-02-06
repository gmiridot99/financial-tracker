import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  category_name?: string;
  is_recurring: boolean;
  start_date: string;
  description: string | null;
  frequency: 'monthly' | 'annual' | 'one-time';
}

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
  // Selection mode props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function TransactionCard({
  transaction,
  onClick,
  selectionMode = false,
  isSelected = false,
  onToggleSelect
}: TransactionCardProps) {
  const dateObj = new Date(transaction.start_date);
  const formattedDate = format(dateObj, 'dd MMM', { locale: it });
  const isIncome = transaction.type === 'income';

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(transaction.id);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative bg-transparent border-b border-warmBg-tertiary py-3.5 px-4 hover:bg-warmBg-hover transition-all cursor-pointer
        ${transaction.is_recurring ? 'border-l-[3px] border-l-warmData-recurring pl-3' : ''}
        ${isSelected ? 'bg-warmBg-hover' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox (visible only in selection mode) */}
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}} // Handled by parent click
            className="w-5 h-5 rounded border-warmText-muted text-warmAccent-primary focus:ring-warmAccent-primary"
          />
        )}

        {/* Existing card content */}
        <div className="flex justify-between items-start flex-1">
          <div className="flex-1">
            <h4 className="font-medium text-warmText-primary text-sm mb-1">
              {transaction.description || transaction.category_name || transaction.category}
            </h4>
            <p className="text-xs text-warmText-disabled">
              {transaction.category_name || transaction.category} · {formattedDate}
              {transaction.is_recurring && ' · Ricorrente'}
            </p>
          </div>
          <div className="text-right ml-4">
            <p
              className={`text-sm font-semibold ${
                isIncome ? 'text-warmData-income' : 'text-warmData-expense'
              }`}
            >
              {isIncome ? '+' : '-'}€{transaction.amount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
