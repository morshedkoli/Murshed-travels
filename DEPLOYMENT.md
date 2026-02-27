# Murshed Travels - Deployment Guide

## Vercel Deployment (Next.js + Prisma + MongoDB)

### 1. Prerequisites
- Vercel account: https://vercel.com
- MongoDB database (Atlas or self-hosted)
- GitHub/GitLab/Bitbucket repository

### 2. Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MongoDB connection string used by Prisma |
| `JWT_SECRET` | Session signing key (32+ characters) |

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy on Vercel

#### Option A: Vercel Dashboard

1. Push code to your git provider.
2. Go to https://vercel.com/dashboard.
3. Click "New Project" and import this repository.
4. Keep framework preset as Next.js.
5. Add environment variables from step 2.
6. Deploy.

#### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

### 4. Post-Deployment Data Setup

Seed admin user and default accounts against the same database used by Vercel:

```bash
npm run seed
```

Default admin credentials:
- Email: `admin@bizledger.local`
- Password: `admin`

### 5. Local Build Verification

```bash
npm install
npm run build
```

### 6. Common Issues

- `PrismaClientInitializationError`: check `DATABASE_URL` format and database network access.
- Login/session errors in production: set `JWT_SECRET` to at least 32 characters.
- Build failures after schema changes: ensure Prisma client generation runs (`postinstall` already runs `prisma generate`).

### 7. Local `.env.local` Template

```env
DATABASE_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/<database>"
JWT_SECRET="replace-with-32-plus-char-secret"
```

Never commit `.env.local` or real secrets.
