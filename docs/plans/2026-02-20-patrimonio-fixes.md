# Patrimonio Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Permettere di cambiare il conto principale tra i conti risparmio; (2) Fare in modo che i dati investimenti vengano caricati subito all'apertura della sezione patrimonio, senza aspettare il click sul tab.

**Architecture:**
- Fix 1: nuovo `handleSetPrimary` in `useSavingsAccounts` (op. 2-step con rollback); bottone "Rendi principale" sulla card in `SavingsAccountsList`.
- Fix 2: `InvestmentAccountsList` sempre montato in `patrimonio/page.tsx`, nascosto con `className="hidden"` quando il tab è "risparmi". Nessuna modifica ai tipi o al DB.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase client-side, react-hot-toast, Tailwind CSS, Vitest

---

## Task 1: handleSetPrimary in useSavingsAccounts

**Files:**
- Modify: `src/hooks/useSavingsAccounts.ts`

**Step 1: Aggiungere `handleSetPrimary` nella sezione "CRUD Actions"**

Inserire dopo `handleDelete` (riga ~212), prima di `handleEditBalance`:

```typescript
const handleSetPrimary = async (accountId: string) => {
  const currentPrimary = accounts.find(a => a.is_primary);
  if (!currentPrimary || currentPrimary.id === accountId) return;

  // Step 1: Rimuovi flag primary dall'account corrente
  const { error: step1Error } = await supabase
    .from('savings_accounts')
    .update({ is_primary: false })
    .eq('id', currentPrimary.id)
    .eq('user_id', userId);

  if (step1Error) {
    console.error('Error unsetting primary:', step1Error);
    toast.error('Errore nel cambio conto principale');
    return;
  }

  // Step 2: Imposta il nuovo account come primary
  const { error: step2Error } = await supabase
    .from('savings_accounts')
    .update({ is_primary: true })
    .eq('id', accountId)
    .eq('user_id', userId);

  if (step2Error) {
    console.error('Error setting primary:', step2Error);
    // ROLLBACK Step 1
    const { error: rollbackError } = await supabase
      .from('savings_accounts')
      .update({ is_primary: true })
      .eq('id', currentPrimary.id)
      .eq('user_id', userId);
    if (rollbackError) {
      console.error('CRITICAL: Rollback failed for set-primary', rollbackError);
      toast.error('ERRORE CRITICO: cambio fallito e rollback fallito. Contatta il supporto.');
    } else {
      toast.error('Cambio conto principale fallito. Ripristinato.');
    }
    return;
  }

  const newPrimaryName = accounts.find(a => a.id === accountId)?.name ?? '';
  toast.success(`"${newPrimaryName}" è ora il conto principale`);
  await loadAccounts();
  onAccountsChanged?.();
};
```

**Step 2: Esporre `handleSetPrimary` nel return del hook**

Nel blocco `return { ... }` alla fine del hook, aggiungere `handleSetPrimary` accanto a `handleDelete`:

```typescript
// Actions
handleCreate,
handleEditName,
handleDelete,
handleSetPrimary,   // <-- aggiunto
handleDeposit,
handleTransfer,
```

**Step 3: Verificare typecheck**

```bash
npm run typecheck
```
Expected: nessun errore.

**Step 4: Commit**

```bash
git add src/hooks/useSavingsAccounts.ts
git commit -m "feat: add handleSetPrimary to useSavingsAccounts with rollback"
```

---

## Task 2: Bottone "Rendi principale" nella card

**Files:**
- Modify: `src/components/SavingsAccountsList.tsx`

**Step 1: Destructurare `handleSetPrimary` dal hook**

Nel blocco di destructuring `useSavingsAccounts(...)` (intorno a riga 45-66), aggiungere:

```typescript
handleSetPrimary,
```

Risultato:

```typescript
const {
  // ...
  handleCreate,
  handleEditName,
  handleDelete,
  handleSetPrimary,   // <-- aggiunto
  handleDeposit,
  handleTransfer,
  // ...
} = useSavingsAccounts({ userId, savingsUnallocated, onAccountsChanged });
```

**Step 2: Aggiungere il bottone nella card**

Nel blocco dove appare il badge "Principale" (intorno a riga 196-213), aggiungere il bottone DOPO il badge `is_primary` e PRIMA del bottone edit-nome:

```tsx
{account.is_primary && (
  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmData-savings bg-opacity-15 text-warmData-savings text-xs font-medium">
    Principale
  </span>
)}
{!account.is_primary && (
  <button
    onClick={() => handleSetPrimary(account.id)}
    className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmBg-tertiary text-warmText-tertiary text-xs font-medium hover:bg-warmData-savings hover:bg-opacity-15 hover:text-warmData-savings transition-colors"
  >
    Rendi principale
  </button>
)}
```

Il blocco completo della sezione nome+badge diventa:

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-semibold text-warmText-primary truncate">
    {account.name}
  </span>
  {account.is_primary && (
    <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmData-savings bg-opacity-15 text-warmData-savings text-xs font-medium">
      Principale
    </span>
  )}
  {!account.is_primary && (
    <button
      onClick={() => handleSetPrimary(account.id)}
      className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmBg-tertiary text-warmText-tertiary text-xs font-medium hover:bg-warmData-savings hover:bg-opacity-15 hover:text-warmData-savings transition-colors"
    >
      Rendi principale
    </button>
  )}
  <button
    onClick={() => {
      setEditingId(account.id);
      setEditingName(account.name);
    }}
    className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary hover:bg-warmBg-tertiary rounded-lg transition-colors flex-shrink-0"
  >
    <Pencil className="w-3.5 h-3.5" />
  </button>
</div>
```

**Step 3: Verificare typecheck**

```bash
npm run typecheck
```
Expected: nessun errore.

**Step 4: Commit**

```bash
git add src/components/SavingsAccountsList.tsx
git commit -m "feat: add 'Rendi principale' button on non-primary savings accounts"
```

---

## Task 3: Fix lazy loading investimenti (sempre montato)

**Files:**
- Modify: `src/app/dashboard/patrimonio/page.tsx`

**Step 1: Sostituire il render condizionale dell'accounts list**

Trovare il blocco nella colonna sinistra (intorno a riga 395-408):

```tsx
{/* LEFT COLUMN continued: accounts list */}
<div className="lg:col-span-3 space-y-2">
  {activeTab === 'risparmi' ? (
    <SavingsAccountsList userId={user.id} savingsUnallocated={0} onAccountsChanged={loadAccountTotals} />
  ) : (
    <InvestmentAccountsList
      userId={user.id}
      investmentsUnallocated={0}
      onAccountsChanged={loadAccountTotals}
      onTotalMarketValue={handleMarketValueUpdate}
      onPricesLoadingChange={setPricesLoading}
      onDistributionData={handleDistributionData}
    />
  )}
</div>
```

Sostituire con (entrambi sempre montati, uno nascosto):

```tsx
{/* LEFT COLUMN continued: accounts list */}
<div className="lg:col-span-3 space-y-2">
  <div className={activeTab === 'risparmi' ? '' : 'hidden'}>
    <SavingsAccountsList userId={user.id} savingsUnallocated={0} onAccountsChanged={loadAccountTotals} />
  </div>
  <div className={activeTab === 'investimenti' ? '' : 'hidden'}>
    <InvestmentAccountsList
      userId={user.id}
      investmentsUnallocated={0}
      onAccountsChanged={loadAccountTotals}
      onTotalMarketValue={handleMarketValueUpdate}
      onPricesLoadingChange={setPricesLoading}
      onDistributionData={handleDistributionData}
    />
  </div>
</div>
```

**Step 2: Verificare typecheck**

```bash
npm run typecheck
```
Expected: nessun errore.

**Step 3: Verificare build**

```bash
npm run build
```
Expected: build green senza errori.

**Step 4: Commit**

```bash
git add src/app/dashboard/patrimonio/page.tsx
git commit -m "fix: always mount InvestmentAccountsList so investment data loads on page open"
```

---

## Verifica finale

```bash
npm run check
```
Expected: typecheck + tests tutti green.

Verificare manualmente nel browser:
1. Aprire `/dashboard/patrimonio` — il `NetWorthCard` deve mostrare valori investimenti corretti (non 0) già sul tab risparmi
2. Su un conto non-principale → bottone "Rendi principale" visibile → click → badge si sposta, toast conferma
3. Il conto precedentemente principale perde il badge e mostra "Rendi principale"
4. Il conto principale non mostra "Rendi principale" e non è eliminabile
