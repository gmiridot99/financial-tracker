# PRD: Financial Tracker — PWA + API Layer + Telegram AI Agent

## Introduzione

Estendere il Financial Life Planner con due layer:
1. **PWA** — app installabile sulla home screen mobile (niente browser bar)
2. **AI Agent via Telegram** — bot in linguaggio naturale (Claude API + tool use) per aggiungere/consultare dati finanziari

Il layer API Routes è il pezzo centrale e riusabile: qualsiasi client futuro (OpenClaw, app nativa, altro agente) può usarlo senza modifiche al core.

---

## Goals

- L'app si installa sulla home screen come app nativa (iOS Safari + Android Chrome)
- L'utente può scrivere "ho speso 45€ supermercato ieri" su Telegram e la transazione viene registrata
- L'utente può chiedere "quanto ho speso questo mese?" e ricevere un riassunto
- Le API Routes sono la fonte unica di verità, chiamabili da qualsiasi client futuro
- Zero VPS separato: tutto gira su Vercel (webhook serverless)

---

## Architettura

```
Mobile (PWA)          Telegram
     |                    |
     |              Bot Webhook
     |           /api/telegram/webhook
     |                    |
     |              Claude API
     |              (tool use)
     |                    |
     +----→  /api/v1/* (API Routes) ←----+
                          |               |
                     Supabase DB     (futuro: OpenClaw)
```

### Nuove env vars (Vercel + bot):
```
BOT_API_KEY=                    # secret random per /api/v1/* auth
SUPABASE_SERVICE_ROLE_KEY=      # per accesso server-side al DB
SUPABASE_USER_ID=               # user_id hardcoded (app personale)
TELEGRAM_BOT_TOKEN=             # da @BotFather
TELEGRAM_ALLOWED_USER_ID=       # tuo Telegram numeric user ID
ANTHROPIC_API_KEY=              # per Claude API tool use
```

---

## User Stories

### US-001: PWA — Manifest e installabilità

**Descrizione:** Come utente, voglio poter installare l'app sulla home screen del telefono così da aprirla senza dover aprire il browser.

**Acceptance Criteria:**
- [ ] Creare `public/manifest.json` con: name "Financial Planner", short_name "Finanze", display "standalone", background_color e theme_color `#F5F0E8`, start_url "/dashboard", icons 192x192 e 512x512
- [ ] Creare icone PNG 192x192 e 512x512 in `public/icons/` (design semplice con iniziale "F" su sfondo warm)
- [ ] In `src/app/layout.tsx`: aggiungere `<link rel="manifest" href="/manifest.json">`, `<meta name="theme-color" content="#F5F0E8">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<link rel="apple-touch-icon" href="/icons/icon-192.png">`
- [ ] Aprendo l'app su Chrome Android → "Aggiungi a schermata Home" appare nel menu
- [ ] Aprendo l'app su Safari iOS → "Aggiungi a schermata Home" funziona, si apre senza browser bar
- [ ] Typecheck passes

---

### US-002: API v1 — Auth middleware + Categories + Accounts

**Descrizione:** Come sviluppatore, ho bisogno di un layer API autenticato con API key che esponga categorie e saldi conti.

**Acceptance Criteria:**
- [ ] Creare `src/lib/bot-auth.ts`: funzione `getBotAuthenticatedUserId(request)` che verifica header `Authorization: Bearer <BOT_API_KEY>`, restituisce `SUPABASE_USER_ID` se valido, null altrimenti
- [ ] Creare `src/lib/supabase-admin.ts`: client Supabase con `SUPABASE_SERVICE_ROLE_KEY` per operazioni server-side
- [ ] Creare `GET /api/v1/categories/route.ts`: restituisce array `{ id, name, type }` delle categorie dell'utente. Auth via `getBotAuthenticatedUserId`. 401 se non auth
- [ ] Creare `GET /api/v1/accounts/route.ts`: restituisce `{ savings: [{ id, name, balance }], investments: [{ id, name, cash_balance }] }`. Auth via `getBotAuthenticatedUserId`
- [ ] Aggiungere a `.env.example`: `BOT_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_USER_ID`
- [ ] Typecheck passes

---

### US-003: API v1 — Transazioni (read + write)

**Descrizione:** Come bot AI, ho bisogno di leggere il riepilogo mensile e aggiungere nuove transazioni.

**Acceptance Criteria:**
- [ ] Creare `GET /api/v1/transactions/summary/route.ts`: query params `year` e `month`. Restituisce `{ income_total, expense_total, net, top_categories: [{ name, total }] }` per il mese richiesto (default: mese corrente). Auth via bot-auth
- [ ] Creare `POST /api/v1/transactions/route.ts`: body `{ type: 'income'|'expense', amount: number, category_name: string, date: string (YYYY-MM-DD), note?: string, from_savings_account_id?: string }`. Inserisce in `transactions` con `user_id` dall'env. Restituisce la transazione creata. 400 se categoria non trovata. Auth via bot-auth
- [ ] `POST` valida: amount > 0, date formato ISO valido, category_name esiste nelle categorie dell'utente
- [ ] Typecheck passes

---

### US-004: API v1 — Trasferimenti

**Descrizione:** Come bot AI, ho bisogno di poter registrare trasferimenti tra conti.

**Acceptance Criteria:**
- [ ] Creare `POST /api/v1/transfers/route.ts`: body `{ from_savings_account_id: string, to_savings_account_id?: string, to_investment_account_id?: string, amount: number, date: string, note?: string }`. Logica atomica: decrementa source, incrementa dest, inserisce record. 400 se saldo insufficiente. Auth via bot-auth
- [ ] Restituisce `{ success: true, transfer_id: string }` o `{ error: string }`
- [ ] Typecheck passes

---

### US-005: Telegram Webhook + Claude AI Agent

**Descrizione:** Come utente, voglio chattare su Telegram in italiano e ricevere conferma delle operazioni eseguite sul mio tracker finanziario.

**Acceptance Criteria:**
- [ ] Creare `POST /api/telegram/webhook/route.ts`
- [ ] Verificare `TELEGRAM_ALLOWED_USER_ID`: se il `from.id` del messaggio non corrisponde, ignorare silenziosamente
- [ ] Chiamare Claude API (`claude-haiku-4-5-20251001`) con system prompt in italiano + tool definitions per: `add_transaction`, `get_monthly_summary`, `get_account_balances`, `list_categories`, `add_transfer`
- [ ] Gestire tool use loop: tool_use → esegui tool → reinvia risultato → risposta testo finale
- [ ] Inviare risposta finale via Telegram `sendMessage` API
- [ ] Gestire errori con messaggio "Mi dispiace, si è verificato un errore. Riprova."
- [ ] Aggiungere a `.env.example`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID`, `ANTHROPIC_API_KEY`
- [ ] Typecheck passes

---

### US-006: Setup e documentazione

**Descrizione:** Come sviluppatore, ho bisogno di istruzioni chiare per configurare il bot end-to-end.

**Acceptance Criteria:**
- [ ] Creare `docs/setup-telegram-bot.md` con step-by-step: (1) crea bot su @BotFather, (2) ottieni TELEGRAM_ALLOWED_USER_ID, (3) configura env vars su Vercel, (4) registra webhook URL con `curl`
- [ ] Aggiornare `CLAUDE.md` con la nuova struttura API Routes e il pattern bot-auth

---

## Requisiti Funzionali

- FR-1: La PWA deve essere installabile su iOS Safari e Android Chrome senza plugin aggiuntivi
- FR-2: Tutte le `/api/v1/*` routes devono richiedere `Authorization: Bearer <BOT_API_KEY>`
- FR-3: L'utente Supabase è identificato da `SUPABASE_USER_ID` env var (non da token utente)
- FR-4: Il bot risponde solo a messaggi da `TELEGRAM_ALLOWED_USER_ID`
- FR-5: Claude usa tool use (non parsing regex) per interpretare i messaggi
- FR-6: Le operazioni finanziarie usano logica atomica con rollback (pattern già in uso nel progetto)
- FR-7: Il webhook Telegram risponde entro il timeout Vercel (10s hobby / 60s pro)

## Non-Goals

- Nessun supporto multi-utente
- Nessuna offline capability nella PWA (solo installabile)
- Nessuna lettura automatica di notifiche bancarie
- Nessuna integrazione PSD2/Open Banking
- Nessuna app React Native / App Store
- Comandi slash Telegram (`/saldo` ecc.) — solo linguaggio naturale

## Considerazioni Tecniche

- **Supabase service role**: usare solo lato server, mai esporre in frontend
- **Claude model**: `claude-haiku-4-5-20251001` per bassa latenza e costo
- **Telegram webhook vs polling**: webhook obbligatorio per Vercel serverless
- **No next-pwa**: solo manifest + meta tags per installabilità (nessun service worker)
- **Icons PWA**: SVG inline → PNG con sharp o canvas a build time

## File da creare/modificare

**Nuovi:**
- `public/manifest.json`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `src/lib/bot-auth.ts`
- `src/lib/supabase-admin.ts`
- `src/app/api/v1/categories/route.ts`
- `src/app/api/v1/accounts/route.ts`
- `src/app/api/v1/transactions/route.ts`
- `src/app/api/v1/transactions/summary/route.ts`
- `src/app/api/v1/transfers/route.ts`
- `src/app/api/telegram/webhook/route.ts`
- `docs/setup-telegram-bot.md`

**Modificati:**
- `src/app/layout.tsx` — PWA meta tags
- `.env.example` — nuove env vars
- `CLAUDE.md` — aggiornare struttura + pattern

## Metriche di Successo

- App installabile sulla home screen in < 2 tap
- "ho speso 45€ al supermercato" → transazione registrata in < 5 secondi
- "quanto ho speso questo mese?" → risposta con totale e top categorie
- Zero costi infrastruttura aggiuntivi (Vercel free tier sufficiente)
