# Authentication System Setup Guide

## Overview
The Sama Alostoura application now has a secure authentication system with hardcoded admin credentials. All routes except `/login`, `/terms`, `/privacy`, and API routes require authentication.

## What Has Been Implemented

### 1. Login Endpoint (`/api/auth/login`)
- **Location**: `app/api/auth/login/route.ts`
- **Method**: POST
- **Request Body**:
  ```json
  {
    "username": "Samaalostoura",
    "password": "Iqbalsethi8585@"
  }
  ```
- **Response on Success** (200):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "sessionToken": "hex-token"
  }
  ```
- **Response on Failure** (401):
  ```json
  {
    "error": "Invalid username or password"
  }
  ```
- **Security Features**:
  - Timing-safe comparison using `crypto.timingSafeEqual()` to prevent timing attacks
  - Secure httpOnly cookies (immune to XSS attacks)
  - 7-day session expiration
  - Secure flag enabled in production (HTTPS only)
  - SameSite=Lax protection against CSRF

### 2. Logout Endpoint (`/api/auth/logout`)
- **Location**: `app/api/auth/logout/route.ts`
- **Method**: POST
- **Response** (200):
  ```json
  {
    "success": true,
    "message": "Logout successful"
  }
  ```
- **Action**: Clears the `sama-session` cookie

### 3. Authentication Middleware
- **Location**: `middleware.ts` (root of project)
- **Protection Pattern**:
  - Checks for `sama-session` cookie on every request
  - Public routes allowed without authentication:
    - `/login` - Login page
    - `/terms` - Terms of Service
    - `/privacy` - Privacy Policy
    - `/api/auth/*` - Authentication API endpoints
  - All other routes redirect to `/login` if no valid session

### 4. Login Page (`/app/login/page.tsx`)
- **Features**:
  - Professional branded design with Sama Alostoura branding
  - HardHat icon + "Sama Alostoura" + "AI Construction OS" header
  - Username and password input fields
  - Loading states and error handling
  - Dark gradient background (slate-900 → brand-900)
  - Responsive design

### 5. Logout Button in Sidebar
- **Location**: `components/layout/sidebar.tsx`
- **Feature**: "Logout" button at the bottom of the sidebar
- **Action**: Calls `/api/auth/logout` and redirects to `/login`

## Admin Credentials

**Username**: `Samaalostoura`
**Password**: `Iqbalsethi8585@`

⚠️ **IMPORTANT**: These are hardcoded in `app/api/auth/login/route.ts`. For production, consider:
- Using environment variables for credentials
- Implementing bcryptjs for password hashing
- Moving to a proper user management system (Supabase Auth, Firebase, etc.)

## Testing the Authentication Flow

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Access the Application
- Navigate to `http://localhost:3000`
- You will be redirected to `/login`

### 3. Login
- Enter username: `Samaalostoura`
- Enter password: `Iqbalsethi8585@`
- Click "Sign In"
- On success, you'll be redirected to the dashboard

### 4. Logout
- Click the "Logout" button in the sidebar
- You'll be redirected to `/login`

## Deployment to Vercel

### Prerequisites
1. Vercel account (https://vercel.com)
2. GitHub repository with your code
3. Custom domain `app.sabcconstruction.com` (optional)

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add authentication system"
git push origin main
```

### Step 2: Import Project in Vercel
1. Go to https://vercel.com/new
2. Connect your GitHub account
3. Select the `sama-alostoura` repository
4. Click "Import"

### Step 3: Configure Environment Variables
In Vercel dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SAMA_AI_KEY=sk-ant-your-api-key-here
QUICKBOOKS_CLIENT_ID=your-quickbooks-client-id
QUICKBOOKS_CLIENT_SECRET=your-quickbooks-client-secret
QUICKBOOKS_REDIRECT_URI=https://app.sabcconstruction.com/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=production
NEXT_PUBLIC_DEMO_MODE=true
```

### Step 4: Configure Custom Domain (Optional)
1. In Vercel dashboard → Settings → Domains
2. Add your custom domain: `app.sabcconstruction.com`
3. Follow instructions to add CNAME record to your DNS provider
4. Update `QUICKBOOKS_REDIRECT_URI` to use `https://app.sabcconstruction.com/api/quickbooks/callback`

### Step 5: Deploy
1. Click "Deploy" button
2. Vercel will automatically build and deploy on every push to `main`

## Security Considerations

### Current Implementation
✅ Timing-safe password comparison
✅ httpOnly secure cookies
✅ Session-based authentication
✅ Route middleware protection

### Recommended Improvements for Production
1. **Password Hashing**: Use bcryptjs or Argon2 instead of plaintext comparison
2. **Database-Backed Users**: Move credentials to Supabase
3. **Multi-Factor Authentication**: Implement 2FA for admin accounts
4. **Session Management**: Consider session validation in database
5. **Audit Logging**: Track login/logout events
6. **Rate Limiting**: Prevent brute force attacks on `/api/auth/login`
7. **HTTPS Only**: Ensure production uses HTTPS (Vercel handles this by default)

## Troubleshooting

### Issue: Redirects to login on every page
- Check if `NEXT_PUBLIC_DEMO_MODE=true` is set in environment
- Verify middleware.ts is at project root, not in app directory
- Clear browser cookies

### Issue: Cannot login
- Verify username is exactly `Samaalostoura` (case-sensitive)
- Verify password is exactly `Iqbalsethi8585@` (case-sensitive)
- Check browser console for error messages

### Issue: Logout doesn't work
- Verify `/api/auth/logout` endpoint is accessible
- Check browser console for fetch errors
- Verify cookies are enabled in browser

## Files Modified/Created

### New Files
- `app/api/auth/login/route.ts` - Login endpoint
- `app/api/auth/logout/route.ts` - Logout endpoint
- `middleware.ts` - Authentication middleware
- `AUTH-SETUP.md` - This documentation

### Modified Files
- `app/login/page.tsx` - Login page (already created)
- `components/layout/sidebar.tsx` - Added logout button

### Existing Files (No Changes)
- `app/globals.css` - Tailwind CSS config
- `.env.local` - Environment variables (add as needed)
- All project pages and components

## Next Steps

1. ✅ Authentication system implemented
2. ⏳ Deploy to Vercel (see Deployment section above)
3. ⏳ Configure custom domain `app.sabcconstruction.com`
4. ⏳ Test authentication flow on production
5. ⏳ Consider upgrading to Supabase Auth for multi-user support

## Support
For issues or questions about the authentication system, refer to:
- Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
- Vercel Deployment: https://vercel.com/docs/deployments/overview
