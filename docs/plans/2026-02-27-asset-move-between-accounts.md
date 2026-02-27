# Asset Move Between Investment Accounts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettere di spostare una quantità (parziale o totale) di un asset da un conto investimento a un altro, senza impatto sui cash balance (transfer in-kind al prezzo medio di carico).

**Architecture:** Transfer in-kind — INSERT sell nel conto sorgente + INSERT buy nel conto destinazione, entrambi al `avgPrice` della holding. Nessuna modifica ai `cash_balance`. Rollback atomico: se il buy fallisce, si elimina la sell già inserita.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase client-side, React hooks, Tailwind CSS, react-hot-toast, lucide-react

---

### Task 1: Stato e handler nel hook

**Files:**
- Modify: `src/hooks/useInvestmentAccounts.ts`

Il hook gestisce già pattern identici (sell, transfer). Aggiungiamo 3 state + 1 handler.

**Step 1: Aggiungere i 3 nuovi state dopo il blocco "Sell form" (riga ~132)**

Aprire `src/hooks/useInvestmentAccounts.ts`. Trovare il commento `// ── Sell form` e il blocco successivo `// ── Transaction edit/delete`. Inserire dopo `sellDestination`/`setSellDestination`:

```ts
// ── Move holding form ────────────────────────────────────────────
const [movingHolding, setMovingHolding] = useState<{ accountId: string; holding: Holding } | null>(null);
const [moveQuantity, setMoveQuantity] = useState('');
const [moveDestination, setMoveDestination] = useState<string>('');
```

**Step 2: Aggiungere `handleMoveHolding` dopo `handleSell` (riga ~846)**

Trovare la riga `// ── Transaction edit/delete` e inserire prima di essa:

```ts
const handleMoveHolding = async () => {
  if (!movingHolding) return;

  const quantity = parseEuropeanDecimal(moveQuantity);
  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantità non valida');
    return;
  }
  if (quantity > movingHolding.holding.quantity) {
    toast.error(`Quantità massima: ${movingHolding.holding.quantity}`);
    return;
  }
  if (!moveDestination) {
    toast.error('Seleziona un conto destinazione');
    return;
  }

  const destAccount = accounts.find(a => a.id === moveDestination);
  if (!destAccount) {
    toast.error('Conto destinazione non trovato');
    return;
  }

  const { holding, accountId: sourceAccountId } = movingHolding;
  const pricePerUnit = holding.avgPrice;
  const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const today = new Date().toISOString().split('T')[0];

  // Step 1: INSERT sell in source account (no cash impact)
  const { data: sellData, error: step1Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: userId,
      investment_account_id: sourceAccountId,
      asset_symbol: holding.symbol,
      asset_name: holding.name,
      asset_type: holding.type,
      transaction_type: 'sell',
      quantity,
      price_per_unit: pricePerUnit,
      total_amount: totalAmount,
      currency: 'EUR',
      transaction_date: today,
    })
    .select('id')
    .single();

  if (step1Error || !sellData) {
    console.error('Error inserting move-sell transaction:', step1Error);
    toast.error('Errore nel trasferimento asset');
    return;
  }

  // Step 2: INSERT buy in destination account (no cash impact)
  const { error: step2Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: userId,
      investment_account_id: moveDestination,
      asset_symbol: holding.symbol,
      asset_name: holding.name,
      asset_type: holding.type,
      transaction_type: 'buy',
      quantity,
      price_per_unit: pricePerUnit,
      total_amount: totalAmount,
      currency: 'EUR',
      transaction_date: today,
    });

  if (step2Error) {
    console.error('Error inserting move-buy transaction:', step2Error);
    // ROLLBACK: delete the sell we just inserted
    await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', sellData.id)
      .eq('user_id', userId);
    toast.error('Trasferimento fallito. Operazione annullata.');
    return;
  }

  const qtyStr = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(6);
  toast.success(`Spostati ${qtyStr} ${holding.symbol} in ${destAccount.name}`);
  setMovingHolding(null);
  setMoveQuantity('');
  setMoveDestination('');
  await loadAccounts();
  onAccountsChanged?.();
};
```

**Step 3: Esportare i nuovi state e handler nel return object**

Trovare il blocco `// Sell form` nel `return { ... }` (riga ~1178) e aggiungere dopo `sellDestination, setSellDestination,`:

```ts
// Move holding form
movingHolding, setMovingHolding,
moveQuantity, setMoveQuantity,
moveDestination, setMoveDestination,
handleMoveHolding,
```

**Step 4: Verificare il typecheck**

```bash
cd "c:/dev/1. Financial tracker/financial-tracker"
npm run typecheck
```

Expected: zero errori TypeScript.

**Step 5: Commit**

```bash
git add src/hooks/useInvestmentAccounts.ts
git commit -m "feat: add handleMoveHolding to useInvestmentAccounts"
```

---

### Task 2: Bottone "Sposta" nella riga holding

**Files:**
- Modify: `src/components/InvestmentAccountsList.tsx`

Il bottone appare nell'expanded holding section, accanto al bottone "Vendi" esistente.

**Step 1: Aggiungere il bottone "Sposta" dopo il bottone "Vendi"**

Trovare il blocco del bottone "Vendi" (riga ~725-736):

```tsx
{/* Sell button */}
<button
  onClick={(e) => {
    e.stopPropagation();
    inv.setSellingHolding({ accountId: account.id, holding });
    inv.setSellQuantity('');
    inv.setSellPrice(isManual ? '' : (price ? String(price.priceEur).replace('.', ',') : ''));
  }}
  className="w-full h-9 bg-warmData-expense/10 text-warmData-expense rounded-lg text-xs font-medium hover:bg-warmData-expense/20 transition-colors flex items-center justify-center gap-1.5"
>
  <DollarSign className="w-3.5 h-3.5" />
  Vendi
</button>
```

Aggiungere immediatamente dopo, solo se ci sono almeno 2 conti:

```tsx
{/* Move button — solo visibile se ci sono altri conti */}
{inv.accounts.length > 1 && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      inv.setMovingHolding({ accountId: account.id, holding });
      inv.setMoveQuantity('');
      inv.setMoveDestination('');
    }}
    className="w-full h-9 bg-warmData-investment/10 text-warmData-investment rounded-lg text-xs font-medium hover:bg-warmData-investment/20 transition-colors flex items-center justify-center gap-1.5"
  >
    <ArrowRightLeft className="w-3.5 h-3.5" />
    Sposta
  </button>
)}
```

**Step 2: Verificare il typecheck**

```bash
npm run typecheck
```

Expected: zero errori.

**Step 3: Commit**

```bash
git add src/components/InvestmentAccountsList.tsx
git commit -m "feat: add move holding button in expanded holding row"
```

---

### Task 3: Modal "Sposta asset"

**Files:**
- Modify: `src/components/InvestmentAccountsList.tsx`

Il modal segue il pattern del "Sell Modal" (riga ~830-886): `fixed inset-0 z-50`, bottom-sheet mobile, centered desktop.

**Step 1: Aggiungere il Move Modal dopo il Sell Modal**

Trovare la riga `{/* Sell Modal */}` (riga ~829) e il successivo `{/* Edit Transaction Modal */}`. Inserire tra i due:

```tsx
{/* Move Holding Modal */}
{inv.movingHolding && (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
    <div className="w-full sm:max-w-md bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-sheetSlideUp sm:animate-cardEnter">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-warmText-primary">
          Sposta {inv.movingHolding.holding.symbol}
        </h3>
        <button
          onClick={() => { inv.setMovingHolding(null); inv.setMoveQuantity(''); inv.setMoveDestination(''); }}
          className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label className="text-xs text-warmText-tertiary mb-1 block">
          Quantità (max: {inv.movingHolding.holding.quantity})
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={inv.moveQuantity}
          onChange={(e) => inv.setMoveQuantity(e.target.value)}
          placeholder="Quantità"
          className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-warmText-tertiary mb-1 block">Conto destinazione</label>
        <select
          value={inv.moveDestination}
          onChange={(e) => inv.setMoveDestination(e.target.value)}
          className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50 appearance-none"
        >
          <option value="">Seleziona conto</option>
          {inv.accounts
            .filter(a => a.id !== inv.movingHolding!.accountId)
            .map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
        </select>
      </div>

      <div className="text-xs text-warmText-tertiary">
        Prezzo medio: <span className="font-semibold text-warmText-secondary">
          {formatCurrency(inv.movingHolding.holding.avgPrice)}
        </span>
        {inv.moveQuantity && !isNaN(parseEuropeanDecimal(inv.moveQuantity)) && parseEuropeanDecimal(inv.moveQuantity) > 0 && (
          <span className="ml-2">
            → Valore: <span className="font-semibold text-warmText-primary">
              {formatCurrency(Math.round(parseEuropeanDecimal(inv.moveQuantity) * inv.movingHolding.holding.avgPrice * 100) / 100)}
            </span>
          </span>
        )}
      </div>

      <button
        onClick={inv.handleMoveHolding}
        className="w-full h-11 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <ArrowRightLeft className="w-4 h-4" />
        Sposta asset
      </button>
    </div>
  </div>
)}
```

**Step 2: Verificare il typecheck**

```bash
npm run typecheck
```

Expected: zero errori.

**Step 3: Commit**

```bash
git add src/components/InvestmentAccountsList.tsx
git commit -m "feat: add move holding modal with atomic transfer in-kind"
```

---

### Task 4: Verifica finale

**Step 1: Build completo**

```bash
npm run build
```

Expected: build completed successfully, zero errori TypeScript o di compilazione.

**Step 2: Test manuale**

1. Aprire `localhost:3000/dashboard/patrimonio`
2. Creare (o avere) almeno 2 conti investimento
3. Espandere una holding in un conto
4. Verificare che il bottone "Sposta" appaia (solo se ci sono ≥ 2 conti)
5. Click "Sposta" → modal si apre con symbol corretto
6. Selezionare quantità parziale (es. 5 su 10), selezionare conto destinazione
7. Click "Sposta asset"
8. Verificare:
   - Toast success con symbol e nome conto destinazione
   - La holding nel conto sorgente si è ridotta della quantità spostata
   - La holding nel conto destinazione è aumentata (o è apparsa se non c'era)
   - I `cash_balance` di entrambi i conti sono invariati
9. Ripetere con quantità totale (tutta la holding) → la holding nel sorgente scompare

**Step 3: Commit finale**

```bash
git add -A
git commit -m "feat: asset transfer in-kind between investment accounts"
```
