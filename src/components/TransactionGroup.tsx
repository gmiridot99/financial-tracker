import TransactionCard from '@/components/TransactionCard';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  category_name?: string;
  is_recurring: boolean;
  frequency: 'monthly' | 'annual' | 'one-time';
  start_date: string;
  description: string | null;
}

/** Tema cromatico del gruppo, mappato ai token warmData del design system. */
type ColorScheme = 'investment' | 'income' | 'expense';

/** Intensita visiva: 'primary' = sfondo pieno, 'secondary' = sfondo attenuato. */
type Variant = 'primary' | 'secondary';

/**
 * Props per TransactionGroup.
 *
 * @prop title - Intestazione del gruppo (es. "Entrate ricorrenti")
 * @prop transactions - Lista transazioni da renderizzare
 * @prop total - Totale gia calcolato dal parent
 * @prop totalPrefix - Prefisso opzionale davanti al totale (es. "-" per le spese)
 * @prop colorScheme - Tema cromatico: 'investment' | 'income' | 'expense'
 * @prop variant - Intensita visiva: 'primary' (default) | 'secondary'
 * @prop onEditTransaction - Callback al click su una transazione
 * @prop selectionMode - Se true, mostra checkbox di selezione multipla
 * @prop selectedIds - Set di ID attualmente selezionati
 * @prop onToggleSelect - Callback per toggle selezione di una transazione
 */
interface TransactionGroupProps {
  title: string;
  transactions: Transaction[];
  total: number;
  totalPrefix?: string;
  colorScheme: ColorScheme;
  variant?: Variant;
  onEditTransaction: (transaction: Transaction) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

interface GroupStyles {
  container: string;
  headerBorder: string;
  text: string;
}

const STYLE_MAP: Record<ColorScheme, Record<Variant, GroupStyles>> = {
  investment: {
    primary: {
      container: 'bg-warmData-investment bg-opacity-10 border-warmData-investment',
      headerBorder: 'border-warmData-investment border-opacity-20',
      text: 'text-warmData-investment',
    },
    secondary: {
      container: 'bg-warmData-investment bg-opacity-5 border-warmData-investment border-opacity-20',
      headerBorder: 'border-warmData-investment border-opacity-10',
      text: 'text-warmData-investment',
    },
  },
  income: {
    primary: {
      container: 'bg-warmData-income bg-opacity-10 border-warmData-income border-opacity-30',
      headerBorder: 'border-warmData-income border-opacity-20',
      text: 'text-warmData-income',
    },
    secondary: {
      container: 'bg-warmData-income bg-opacity-5 border-warmData-income border-opacity-20',
      headerBorder: 'border-warmData-income border-opacity-10',
      text: 'text-warmData-income',
    },
  },
  expense: {
    primary: {
      container: 'bg-warmData-expense bg-opacity-10 border-warmData-expense border-opacity-30',
      headerBorder: 'border-warmData-expense border-opacity-20',
      text: 'text-warmData-expense',
    },
    secondary: {
      container: 'bg-warmData-expense bg-opacity-5 border-warmData-expense border-opacity-20',
      headerBorder: 'border-warmData-expense border-opacity-10',
      text: 'text-warmData-expense',
    },
  },
};

export type { Transaction as TransactionGroupTransaction };

/**
 * Gruppo riutilizzabile di transazioni con header colorato, totale e supporto selezione multipla.
 *
 * Combina `colorScheme` e `variant` per generare stili coerenti tramite la mappa `STYLE_MAP`.
 * Non renderizza nulla se `transactions` e vuoto.
 */
export default function TransactionGroup({
  title,
  transactions,
  total,
  totalPrefix = '',
  colorScheme,
  variant = 'primary',
  onEditTransaction,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: TransactionGroupProps) {
  if (transactions.length === 0) return null;

  const styles = STYLE_MAP[colorScheme][variant];

  return (
    <div className={`${styles.container} rounded-2xl overflow-hidden border`}>
      <div className={`px-4 py-3 border-b ${styles.headerBorder}`}>
        <div className="flex justify-between items-center">
          <h3 className={`text-sm font-medium ${styles.text}`}>
            {title}
          </h3>
          <span className={`text-xs font-semibold ${styles.text}`}>
            Tot: {totalPrefix}€{total.toFixed(2)}
          </span>
        </div>
      </div>
      <div>
        {transactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            onClick={() => onEditTransaction(transaction)}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(transaction.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
