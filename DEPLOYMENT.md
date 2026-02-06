# Guida Deployment in Produzione

Questa guida ti aiuterà a deployare Financial Life Planner in produzione.

## 🚀 Deploy su Vercel (Raccomandato)

Vercel è la piattaforma ideale per Next.js (creata dagli stessi sviluppatori).

### Prerequisiti
- Account GitHub (per connettere il repository)
- Account Vercel (gratuito): https://vercel.com
- Progetto Supabase configurato (vedi [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))

### Step-by-Step

#### 1. Prepara il Repository

```bash
# Inizializza git se non l'hai già fatto
git init

# Aggiungi tutti i file
git add .

# Crea il primo commit
git commit -m "Initial commit - Financial Life Planner MVP"

# Crea un repository su GitHub e connettilo
git remote add origin https://github.com/tuo-username/financial-life-planner.git
git push -u origin master
```

#### 2. Deploy su Vercel

**Opzione A: Via Dashboard Vercel**

1. Vai su https://vercel.com
2. Clicca **"Add New Project"**
3. Seleziona **"Import Git Repository"**
4. Scegli il tuo repository `financial-life-planner`
5. Configura il progetto:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (lascia default)
   - **Build Command**: `npm run build` (auto)
   - **Output Directory**: `.next` (auto)

6. **Environment Variables** - Aggiungi:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
   ```

7. Clicca **"Deploy"**
8. Attendi 1-2 minuti per il build
9. 🎉 La tua app è live!

**Opzione B: Via Vercel CLI**

```bash
# Installa Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Segui le istruzioni interattive
# Quando richiesto, inserisci le environment variables
```

#### 3. Configura il Dominio Custom (Opzionale)

1. Nella dashboard Vercel del tuo progetto
2. Vai su **Settings** > **Domains**
3. Aggiungi il tuo dominio personalizzato
4. Segui le istruzioni per configurare i DNS

### 🔄 Auto-Deploy su Git Push

Vercel configura automaticamente:
- ✅ Deploy automatico su ogni push a `master`/`main`
- ✅ Preview deploy per ogni Pull Request
- ✅ Rollback istantaneo alle versioni precedenti

## 📦 Deploy su Netlify

### Step-by-Step

1. Vai su https://netlify.com
2. Clicca **"Add new site"** > **"Import an existing project"**
3. Connetti GitHub e seleziona il repository
4. Configurazione build:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
5. Environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
6. Deploy!

## 🐳 Deploy con Docker

### Dockerfile

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Build e Run

```bash
# Build
docker build -t financial-life-planner .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  financial-life-planner
```

## ☁️ Deploy su Cloud Providers

### Railway

1. Vai su https://railway.app
2. **New Project** > **Deploy from GitHub**
3. Seleziona il repository
4. Aggiungi environment variables
5. Deploy automatico!

### Render

1. Vai su https://render.com
2. **New** > **Web Service**
3. Connetti GitHub
4. Build command: `npm run build`
5. Start command: `npm start`
6. Aggiungi environment variables
7. Deploy!

## ✅ Checklist Pre-Deployment

Prima di andare in produzione, verifica:

- [ ] **Environment Variables** configurate correttamente
- [ ] **Supabase** progetto in produzione (non development)
- [ ] **Database migrations** applicate al database di produzione
- [ ] **Tests** passano (`npm run check`)
- [ ] **Build** locale funziona (`npm run build`)
- [ ] **HTTPS** abilitato (automatico su Vercel/Netlify)
- [ ] **.gitignore** include `.env.local`
- [ ] **Error logging** configurato (opzionale)

## 🔐 Sicurezza in Produzione

### Supabase Production Setup

1. **Usa un progetto separato per produzione**
   - Non usare lo stesso database di sviluppo!

2. **Row Level Security (RLS)**
   - Le migrations includono già le policy RLS
   - Verifica in Supabase > Authentication > Policies

3. **API Keys**
   - Usa solo `anon/public` key nel frontend
   - Mai usare `service_role` key nel codice client!

4. **Rate Limiting**
   - Supabase include rate limiting di default
   - Per protezione extra, considera Vercel Edge Config

### Environment Variables

**IMPORTANTE**: Mai committare `.env.local`!

```bash
# ✅ Corretto
.env.example  # Template da committare
.env.local    # Valori reali - NON committare

# ❌ Errato
.env          # Non committare mai!
```

## 📊 Monitoring

### Vercel Analytics (Incluso nel piano free)

1. Vercel Dashboard > **Analytics**
2. Vedi: page views, user metrics, performance

### Supabase Monitoring

1. Supabase Dashboard > **Database** > **Logs**
2. Monitor query performance
3. Verifica autenticazione in **Auth** > **Users**

### Error Tracking (Opzionale)

Per produzione seria, considera:
- [Sentry](https://sentry.io) - Error tracking
- [LogRocket](https://logrocket.com) - Session replay
- [PostHog](https://posthog.com) - Analytics

## 🔄 Aggiornamenti e Manutenzione

### Deploy Aggiornamenti

```bash
# Sviluppo
git add .
git commit -m "feat: nuova funzionalità"
git push origin main

# Vercel/Netlify deployano automaticamente!
```

### Database Migrations in Produzione

1. Testa le migrations in development
2. Applica via Supabase SQL Editor in produzione
3. Oppure usa Supabase CLI:
   ```bash
   supabase link --project-ref prod-project-id
   supabase db push
   ```

### Rollback

Su Vercel:
1. Dashboard > **Deployments**
2. Trova la versione precedente
3. Clicca **"Promote to Production"**

## 💰 Costi Stimati

### Piano Free (per iniziare)

- **Vercel**: Free
  - 100GB bandwidth/mese
  - Illimitati deploy
  - HTTPS automatico

- **Supabase**: Free
  - 500MB database
  - 50K users/mese
  - 2GB bandwidth

**Totale**: €0/mese (perfetto per MVP e piccoli progetti!)

### Scalabilità

Quando cresci:
- Vercel Pro: $20/mese (team features)
- Supabase Pro: $25/mese (più storage, backup)

## 🆘 Troubleshooting

### Build Fallisce

```bash
# Testa il build localmente
npm run build

# Controlla errori TypeScript
npm run typecheck

# Verifica i test
npm test
```

### Environment Variables non Funzionano

- Riavvia il deployment dopo aver aggiunto variables
- Verifica che inizino con `NEXT_PUBLIC_` (per variabili client-side)
- Controlla i typo nei nomi delle variabili

### Database Connection Error

- Verifica che le credenziali Supabase siano corrette
- Controlla che il progetto Supabase sia attivo
- Verifica la region/latency se lento

## 📚 Risorse

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Production Guide](https://supabase.com/docs/guides/platform/going-into-prod)

---

🎉 **La tua app è live!** Condividi il link con il mondo!
