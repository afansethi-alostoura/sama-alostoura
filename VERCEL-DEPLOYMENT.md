# Vercel Deployment Guide for Sama Alostoura

## Quick Start: Deploy to Vercel in 5 Minutes

### Prerequisites
- GitHub account with repository access
- Vercel account (free tier is sufficient)
- Your existing website: `sabcconstruction.com`

### Step 1: Prepare Your Repository (2 minutes)

```bash
# Navigate to project directory
cd C:\Users\pc\Documents\sama-alostoura

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Sama Alostoura AI Construction OS with authentication"

# Add GitHub remote (replace USERNAME/REPO with your repo)
git remote add origin https://github.com/YOUR_USERNAME/sama-alostoura.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 2: Import Project into Vercel (1 minute)

1. Go to https://vercel.com/new
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Search for `sama-alostoura` repository
5. Click "Import"
6. Click "Continue" (use default settings)

### Step 3: Add Environment Variables (1 minute)

In the Vercel import dialog, before clicking "Deploy", add these variables:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key-here
SAMA_AI_KEY = sk-ant-your-api-key-here
QUICKBOOKS_CLIENT_ID = your-quickbooks-client-id
QUICKBOOKS_CLIENT_SECRET = your-quickbooks-client-secret
QUICKBOOKS_REDIRECT_URI = https://app.sabcconstruction.com/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT = production
NEXT_PUBLIC_DEMO_MODE = true
```

**Copy these values from your `.env.local` file.**

### Step 4: Deploy (1 minute)

1. Click "Deploy"
2. Wait for deployment to complete (~2-3 minutes)
3. You'll get a Vercel URL like: `https://sama-alostoura-abc123.vercel.app`
4. Test the app at that URL

### Step 5: Configure Custom Domain (Optional - 5 minutes)

**You need to own `sabcconstruction.com` and have DNS access.**

#### Option A: Use Vercel DNS (Recommended)
1. In Vercel dashboard → Settings → Domains
2. Enter: `app.sabcconstruction.com`
3. Click "Add"
4. Vercel will give you a nameserver: `cname.vercel-dns.com`
5. Go to your domain registrar (GoDaddy, Namecheap, etc.)
6. Update nameservers to Vercel's nameservers (or add CNAME record)
7. Wait 24-48 hours for DNS propagation
8. Vercel will auto-issue SSL certificate

#### Option B: Use CNAME Record (Faster)
1. In Vercel dashboard → Settings → Domains
2. Enter: `app.sabcconstruction.com`
3. Choose "External DNS"
4. Vercel will show CNAME record to add
5. Go to your domain registrar
6. Add CNAME record: `app` → `cname.vercel-dns.com`
7. Wait ~30 minutes for DNS propagation
8. Vercel will auto-issue SSL certificate

### Step 6: Update Environment Variables for Custom Domain

1. In Vercel dashboard → Settings → Environment Variables
2. Update `QUICKBOOKS_REDIRECT_URI` to:
   ```
   https://app.sabcconstruction.com/api/quickbooks/callback
   ```
3. Click "Save"
4. Vercel will auto-redeploy

### Step 7: Test Production Login

1. Go to `https://app.sabcconstruction.com`
2. You should see the login page
3. Login with:
   - Username: `Samaalostoura`
   - Password: `Iqbalsethi8585@`
4. You should access the dashboard
5. Test the "Logout" button in the sidebar
6. Test accessing projects, accounting, etc.

## Common Issues & Solutions

### Issue: "Invalid or missing credentials" on QuickBooks
**Solution**: Verify `QUICKBOOKS_REDIRECT_URI` is exactly:
```
https://app.sabcconstruction.com/api/quickbooks/callback
```

### Issue: Domain not connecting after DNS update
**Solution**: 
1. Wait 24-48 hours for DNS propagation
2. Clear browser cache
3. Test with: `nslookup app.sabcconstruction.com` (on Windows)
4. Vercel shows DNS status in dashboard

### Issue: SSL certificate not auto-issued
**Solution**:
1. Verify domain DNS is correctly configured
2. Wait 30 minutes
3. In Vercel dashboard, force SSL: Settings → Domains → Force HTTPS (enabled by default)

### Issue: Deployment failed
**Solution**:
1. Check build logs in Vercel dashboard
2. Common causes:
   - Missing environment variables
   - TypeScript errors (unlikely - we tested)
   - Missing dependencies in `package.json`
3. Go to Deployments tab to see error details

## Continuous Deployment

After initial setup, Vercel automatically deploys when you push to GitHub:

```bash
# Make changes locally
# Edit files...

# Commit and push
git add .
git commit -m "Add new feature"
git push origin main

# Vercel automatically deploys within seconds
# Check status in Vercel dashboard
```

## Monitoring & Logs

### View Deployment Logs
1. Vercel dashboard → Deployments
2. Click on deployment
3. Scroll to "Logs" section

### View Function Logs (API Routes)
1. Vercel dashboard → Functions
2. View real-time logs for `/api/auth/login`, `/api/agents/project-manager`, etc.

### View Application Errors
1. Check browser console (F12)
2. Check Vercel Function logs for server errors

## Scaling Considerations

### Current Setup
- Free tier supports ~100 concurrent users
- Suitable for single-admin use case

### Future Scaling (Phase 2)
- Switch to Supabase Auth for multi-user support
- Implement database-backed sessions
- Add rate limiting for API routes
- Use Vercel's edge caching for static assets

## Rollback to Previous Deployment

If you need to revert a bad deployment:

1. Vercel dashboard → Deployments
2. Find the good deployment
3. Click "Redeploy"
4. Vercel rebuilds and deploys that version

## Cleanup

If you want to remove the app from Vercel:

1. Vercel dashboard → Settings → Danger Zone
2. Click "Delete Project"
3. Remove GitHub connection if desired

---

## Checklist Before Going Live

- [ ] All environment variables added
- [ ] Custom domain DNS configured
- [ ] Tested login with correct credentials
- [ ] Tested logout
- [ ] Tested QuickBooks connection (if applicable)
- [ ] Verified HTTPS is enabled
- [ ] Checked browser console for errors
- [ ] Verified on mobile device
- [ ] Set up monitoring/error tracking (optional)

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Vercel Community**: https://github.com/vercel/next.js/discussions

## What to Do After Deployment

1. **Inform your team**: Share `app.sabcconstruction.com` with team members
2. **Set up monitoring**: Optional - add error tracking (Sentry, LogRocket)
3. **Plan Phase 2**: Multi-user support, more features
4. **Collect feedback**: Use the app, suggest improvements

---

**Deployment takes ~5-10 minutes total. You're now in production! 🚀**
