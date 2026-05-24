# Adding Your Company Logo

## How to Add Your Logo

1. **Prepare your logo image:**
   - Format: PNG, JPG, or SVG
   - Recommended dimensions: 200px wide × 80px tall (or similar aspect ratio)
   - Transparent background recommended
   - File size: under 500KB

2. **Upload your logo:**
   - Place your logo file in this folder (`public/`)
   - Name it: `logo.png` (or `logo.jpg`/`logo.svg`)
   - Commit and push to GitHub

3. **Deployment:**
   - Vercel will automatically deploy the changes
   - Your logo will appear on the login page within minutes

## Logo Display

- The logo displays at `h-16` (64px height) with auto width to maintain aspect ratio
- If you need a different size, update the `h-16` class in `app/login/page.tsx` to `h-20`, `h-24`, etc.
- If the logo file is not found, it gracefully hides and shows just the company name

## Current Status

- No logo uploaded yet
- Login page displays company name "Sama Alostoura" in place of logo
- Once you upload your logo, it will automatically appear
