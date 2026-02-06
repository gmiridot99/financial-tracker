# Guida Setup Supabase

Questa guida ti aiuterà a configurare Supabase per il progetto Financial Life Planner.

## 📋 Prerequisiti

- Account Supabase (gratuito): https://supabase.com
- Node.js installato (v18+)

## 🚀 Setup Passo-Passo

### 1. Crea un Nuovo Progetto Supabase

1. Vai su https://app.supabase.com
2. Clicca su **"New Project"**
3. Compila i dettagli:
   - **Name**: `financial-life-planner` (o un nome a tua scelta)
   - **Database Password**: Scegli una password sicura (salvala!)
   - **Region**: Scegli la regione più vicina a te
   - **Pricing Plan**: Free (sufficiente per l'MVP)
4. Clicca **"Create new project"**
5. Attendi 1-2 minuti per la creazione del database

### 2. Ottieni le Credenziali

1. Nel tuo progetto Supabase, vai su **Settings** (icona ingranaggio)
2. Clicca su **API** nel menu laterale
3. Troverai:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: Una lunga stringa alfanumerica

### 3. Configura il File .env.local

1. Nella root del progetto, copia il file di esempio:
   ```bash
   cp .env.example .env.local
   ```

2. Apri `.env.local` e inserisci le tue credenziali:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...tua-chiave-completa
   ```

### 4. Applica le Migrations del Database

Hai due opzioni:

#### Opzione A: Via Dashboard Supabase (Raccomandata)

1. Vai su **SQL Editor** nel menu laterale di Supabase
2. Clicca **"New Query"**
3. Copia e incolla il contenuto dei file migration nell'ordine:

**Migration 1 - Users e Settings:**
```sql
-- Copia il contenuto di: supabase/migrations/20260129000001_create_users_and_settings.sql
```

4. Clicca **"Run"** (o premi Ctrl+Enter)
5. Ripeti per le altre migrations nell'ordine:
   - `20260129000002_create_categories.sql`
   - `20260129000003_create_transactions.sql`
   - `20260129000004_create_investments.sql`

#### Opzione B: Via Supabase CLI

1. Installa Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Fai login:
   ```bash
   supabase login
   ```

3. Link al tuo progetto:
   ```bash
   supabase link --project-ref your-project-id
   ```

4. Applica le migrations:
   ```bash
   supabase db push
   ```

### 5. Configura Authentication

1. Vai su **Authentication** > **Providers** in Supabase
2. Assicurati che **Email** sia abilitato (dovrebbe esserlo di default)
3. **Opzionale**: Configura le impostazioni email:
   - Vai su **Authentication** > **Email Templates**
   - Personalizza i template di conferma email (opzionale per sviluppo)

### 6. Verifica il Setup

1. Vai su **Table Editor** in Supabase
2. Dovresti vedere le tabelle:
   - `users`
   - `user_settings`
   - `categories` (con dati seed)
   - `transactions`
   - `investment_categories` (con dati seed)
   - `investment_allocations`

3. Clicca su `categories` - dovresti vedere:
   - 5 categorie income (Stipendio, Freelance, etc.)
   - 10 categorie expense (Affitto/Mutuo, Utenze, etc.)

4. Clicca su `investment_categories` - dovresti vedere:
   - Azioni (7%)
   - Obbligazioni (3%)
   - Liquidità (1%)

### 7. Avvia l'Applicazione

```bash
npm run dev
```

Apri http://localhost:3000

### 8. Testa il Setup

1. Clicca **"Registrati"**
2. Crea un account con email e password
3. Dovresti essere reindirizzato alla dashboard
4. Prova ad aggiungere una transazione!

## 🔍 Verifica dei Dati nel Database

Dopo aver creato un account e aggiunto transazioni:

1. Vai su **Table Editor** in Supabase
2. Clicca su `users` - dovresti vedere il tuo utente
3. Clicca su `user_settings` - dovresti vedere le impostazioni default (40/60)
4. Clicca su `transactions` - dovresti vedere le tue transazioni

## ⚠️ Troubleshooting

### Errore: "Missing Supabase environment variables"
- Verifica che `.env.local` esista e contenga le credenziali corrette
- Riavvia il server di sviluppo (`npm run dev`)

### Errore di autenticazione
- Verifica che la SUPABASE_ANON_KEY sia corretta
- Controlla che l'authentication sia abilitata in Supabase

### Tabelle mancanti
- Assicurati di aver eseguito tutte le 4 migrations nell'ordine corretto
- Verifica in **Table Editor** che le tabelle esistano

### Le categorie non appaiono
- Controlla che le migrations con i seed siano state eseguite
- Verifica in **Table Editor** > `categories` che ci siano righe

## 🔐 Sicurezza

**IMPORTANTE**:
- ✅ `.env.local` è già in `.gitignore` - NON committare mai questo file!
- ✅ Usa solo la `anon/public` key nel frontend (mai la `service_role` key!)
- ✅ Le Row Level Security (RLS) policies sono gestite nelle migrations

## 📚 Risorse Utili

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

## 💡 Tips per Sviluppo

1. **Resetta il Database**: Se vuoi ricominciare da capo:
   - Vai su **Database** > **Backups**
   - Oppure elimina e ricrea il progetto

2. **Visualizza Query SQL**:
   - Vai su **SQL Editor** per eseguire query personalizzate
   - Utile per debug e ispezione dati

3. **Monitor**:
   - **Database** > **Logs** per vedere le query eseguite
   - **Auth** > **Users** per gestire gli utenti

4. **Limiti Piano Free**:
   - 500MB database storage
   - 50,000 monthly active users
   - 2GB bandwidth
   - Più che sufficiente per sviluppo e testing!

---

✅ Setup completato! Ora puoi iniziare a usare l'applicazione!
