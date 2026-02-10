# Murshed Travels - Deployment Guide

## Vercel Deployment Instructions (Supabase)

### 1. Prerequisites
- Vercel account (https://vercel.com)
- Supabase project (https://supabase.com)
- GitHub/GitLab/Bitbucket repository

### 2. Environment Variables Setup

Add these variables in Vercel Project Settings -> Environment Variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key |
| `JWT_SECRET` | Secret key for app JWT session |

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Supabase Setup

1. Create a new Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql` from this repository.
4. Copy URL and anon key from Supabase -> Settings -> API.

### 4. Deployment Steps

#### Option A: Deploy via Vercel Dashboard

1. Push code to your git provider.
2. Open https://vercel.com/dashboard.
3. Click "New Project" and import repository.
4. Confirm Next.js settings.
5. Add environment variables from step 2.
6. Deploy.

#### Option B: Deploy via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

### 5. Post-Deployment Setup

Create initial admin and default accounts:

```bash
npm run seed
```

Default admin credentials:
- Email: `admin@bizledger.local`
- Password: `admin`

### 6. Build Verification

```bash
npm install
npm run build
```

### 7. Common Issues

- Missing Supabase variables: ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- Login/session issues: verify `JWT_SECRET` is present and at least 32 characters.
- Build failures: run `npm run lint` and fix TypeScript/ESLint issues.

### 8. Local `.env.local` Template

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

---

Never commit `.env.local` or secrets to git.
