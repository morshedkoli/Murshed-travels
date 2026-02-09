# Murshed Travels - Deployment Guide

## Vercel Deployment Instructions

### 1. Prerequisites
- Vercel account (sign up at https://vercel.com)
- MongoDB Atlas account (or any MongoDB provider)
- GitHub/GitLab/Bitbucket repository

### 2. Environment Variables Setup

Add the following environment variables in your Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://username:password@cluster.mongodb.net/dbname` |
| `JWT_SECRET` | Secret key for JWT tokens | Generate a random string (32+ characters) |

#### Generate JWT Secret:
```bash
# Run this in terminal to generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. MongoDB Atlas Setup (if not done)

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Create a database user
4. Whitelist your IP or allow access from anywhere (0.0.0.0/0) for Vercel
5. Get the connection string and replace password

### 4. Deployment Steps

#### Option A: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/dashboard
3. Click "New Project"
4. Import your repository
5. Configure:
   - Framework Preset: Next.js
   - Root Directory: ./ (default)
   - Build Command: `npm run build` (default)
   - Output Directory: .next (default)
6. Add Environment Variables (from step 2)
7. Click "Deploy"

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

### 5. Post-Deployment Setup

#### Create Admin User

After first deployment, you need to create an admin user in MongoDB:

```javascript
// Connect to MongoDB and run:
db.users.insertOne({
  email: "admin@murshedtravels.com",
  password: "$2a$10$YourHashedPasswordHere", // bcrypt hashed
  role: "admin",
  createdAt: new Date()
})
```

Or use the seed script locally:
```bash
npm run seed
```

### 6. Build Verification

To verify the build works locally before deploying:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Check for errors
# If successful, the .next folder will be created
```

### 7. Common Issues & Solutions

#### Issue: MongoDB connection timeout
**Solution**: Whitelist Vercel IPs or use 0.0.0.0/0 in MongoDB Atlas Network Access

#### Issue: JWT errors
**Solution**: Ensure JWT_SECRET is set and is at least 32 characters long

#### Issue: Build fails
**Solution**: 
- Check all imports are correct
- Ensure no syntax errors
- Run `npm run lint` to check for issues

### 8. Performance Optimization

The app is already optimized with:
- Next.js 16 with Turbopack
- Server-side rendering for dynamic pages
- Static generation where possible
- Optimized images and fonts

### 9. Monitoring

After deployment:
1. Check Vercel Analytics for performance metrics
2. Monitor MongoDB Atlas for database performance
3. Set up Vercel Alerts for build failures

### 10. Custom Domain (Optional)

1. Go to Vercel Dashboard → Project Settings → Domains
2. Add your custom domain (e.g., murshedtravels.com)
3. Follow DNS configuration instructions

## Environment Variables Template

Create a `.env.local` file locally (DO NOT commit this):

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

## Support

For issues:
1. Check Vercel deployment logs
2. Check MongoDB Atlas logs
3. Review application error logs in Vercel

---

**Note**: Never commit `.env.local` or any sensitive credentials to git!
