# Sama Alostoura - Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign in or create an account
3. Click "New Project"
4. Fill in details:
   - Project Name: `sama-alostoura`
   - Database Password: (generate secure password)
   - Region: Select closest to Dubai (e.g., `eu-west-1` or `ap-southeast-1`)
5. Click "Create new project" and wait for setup (takes 2-3 minutes)

## Step 2: Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key**: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key**: This is your `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Create Rate Library Table

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire contents of `supabase-schema.sql` from your project root
4. Click "Run"
5. You should see the table created with sample rates

## Step 4: Update Environment Variables

1. Open `.env.local` in your project
2. Replace the placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Save the file

## Step 5: Test the Connection

1. Restart your development server (if running)
2. Go to the Estimation page
3. Create a new estimation
4. Upload a drawing
5. The AI should use rates from Supabase (not the JSON file)

## Managing Rates

Once Supabase is set up:

- **Add Rate**: POST `/api/rates` with rate details
- **Update Rate**: PUT `/api/rates?id=<rate-id>`
- **Delete Rate**: DELETE `/api/rates?id=<rate-id>`
- **Get All Rates**: GET `/api/rates`
- **Get by Category**: GET `/api/rates?category=<category-name>`

## Fallback to File Storage

If Supabase is not configured or there''s an error:
- The app automatically falls back to `.rates-data.json` (file-based storage)
- This allows local development without Supabase

## Important Notes

- Supabase is free tier includes 500MB storage and plenty of API calls for small projects
- Your data is secure - enable Row-Level Security policies in Supabase for production
- Sample rates are provided in the schema - customize them for your Dubai market rates

## Troubleshooting

### "Supabase not configured" error
- Check that `NEXT_PUBLIC_SUPABASE_URL` doesn''t contain "your-project"
- Verify all environment variables are set correctly
- Restart the development server

### Upload still failing
- The file upload issue was fixed - make sure you''re running the latest code
- Check browser console for detailed error messages
- Ensure upload directory permissions are correct

For more help, see: https://supabase.com/docs/guides/api