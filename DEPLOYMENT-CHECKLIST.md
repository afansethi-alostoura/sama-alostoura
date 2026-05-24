# Estimation Engineer Module - Deployment Checklist

## Pre-Deployment

- [x] All API routes created and tested
- [x] Frontend pages created (dashboard, upload, editor)
- [x] Data stores configured (rates-store, boq-store)
- [x] Types added (BOQ, BOQItem, RateLibraryItem)
- [x] Sidebar updated to enable Estimation (phase: 1)
- [x] Dependencies added to package.json
- [x] Rate library seed endpoint created with 60+ standard rates
- [x] Documentation created (ESTIMATION-MODULE-GUIDE.md)

## Local Development (Before Deployment)

### 1. Install Dependencies
```bash
cd sama-alostoura
npm install
```

Wait for:
- pdfkit
- pdf-parse
- dxf
- sharp

### 2. Initialize Rate Library
```bash
# Start dev server
npm run dev

# In another terminal, seed rates (one-time)
curl -X POST http://localhost:3000/api/rates/seed

# Verify
curl http://localhost:3000/api/rates
# Should return 60+ items
```

### 3. Test Upload Flow (Manual)
1. Navigate to `http://localhost:3000/estimation`
2. Click "Upload Drawing"
3. Select a sample PDF or JPG drawing
4. Fill in project details:
   - Project Name: "Test Villa"
   - Plot Size: "500"
   - Floors: "G+1"
   - Rooms: "6"
5. Click "Upload & Extract"
6. Wait for AI processing (2-3 minutes)
7. Review extracted BOQ items
8. Click "Save & Continue"
9. Verify BOQ editor loads with items
10. Edit a quantity/rate to verify auto-calculation
11. Click "Export PDF"
12. Verify PDF downloads with company branding

### 4. Test API Endpoints

```bash
# Test rate library endpoints
curl http://localhost:3000/api/rates

curl "http://localhost:3000/api/rates?category=Excavation%20and%20Backfilling"

curl -X POST http://localhost:3000/api/rates \
  -H "Content-Type: application/json" \
  -d '{
    "description": "TEST ITEM",
    "unit": "M3",
    "unitRate": 999,
    "category": "Test Category"
  }'

# List BOQs
curl http://localhost:3000/api/boqs

# Create BOQ (requires boq items from extraction)
curl -X POST http://localhost:3000/api/boqs \
  -H "Content-Type: application/json" \
  -d '...'
```

### 5. Check File Permissions
- [ ] `.uploads/` directory can be created by Node.js
- [ ] `.rates-data.json` can be written by Node.js
- [ ] `.boq-data.json` can be written by Node.js
- [ ] Temp files are cleaned up after processing

## GitHub Push

### 1. Stage & Commit
```bash
git add .
git status  # Verify all files staged

git commit -m "feat: Add Estimation Engineer module Phase 1

- AI-powered BOQ generation from architectural drawings
- Support for PDF, JPG, PNG, DWG, DXF uploads
- Claude Vision API for dimension extraction
- Manual BOQ editor with auto-calculating totals
- Professional PDF export with company branding
- Rate library management (60+ standard rates)
- File-based storage (.rates-data.json, .boq-data.json)

Features:
- Upload drawing page with project context
- AI extraction of dimensions and BOQ items
- Review & edit interface for all line items
- Export to PDF with Sama Alostoura branding
- Sidebar enabled (phase: 1)

Endpoints:
- GET/POST/PUT/DELETE /api/rates
- GET/POST/PUT/DELETE /api/boqs
- POST/PUT/DELETE /api/boqs/items
- POST /api/estimations/upload
- POST /api/agents/estimation-engineer
- GET /api/boqs/export-pdf
- POST /api/rates/seed

Dependencies added:
- pdfkit (PDF generation)
- pdf-parse (PDF extraction)
- dxf (AutoCAD parsing)
- sharp (Image processing)"
```

### 2. Push to GitHub
```bash
git push origin main
```

Wait for:
- Commit appears in GitHub
- Verify all files are there

## Vercel Deployment

### 1. Set Environment Variables

In Vercel Dashboard (sama-alostoura project):
1. Settings → Environment Variables
2. Add/verify:
   - `SAMA_AI_KEY` = your-anthropic-api-key
   - `NEXT_PUBLIC_DEMO_MODE` = true (existing)
   - `NEXT_PUBLIC_SITE_URL` = https://sama-alostoura.vercel.app (for local rate checks)

### 2. Trigger Deployment

Option A: Auto-deploy on push
- Vercel auto-deploys on `git push` to main
- Check Vercel dashboard for build progress

Option B: Manual redeploy
```bash
vercel deploy --prod
```

### 3. Wait for Build
- Build takes 2-5 minutes
- Vercel runs: `next build && next start`
- Check for errors in Vercel logs

### 4. Post-Deployment Setup

Once deployed to production URL (https://...vercel.app):

```bash
# Initialize rate library on production
curl -X POST https://sama-alostoura.vercel.app/api/rates/seed

# Verify
curl https://sama-alostoura.vercel.app/api/rates
```

Note: Rate library persists in Vercel's /tmp for duration of deployment, but will be lost on redeploy. For persistent storage, consider Supabase migration.

### 5. Test Production Endpoints

1. Navigate to: `https://sama-alostoura.vercel.app/estimation`
2. Verify sidebar shows Estimation (enabled)
3. Click "Upload Drawing"
4. Upload test file and verify extraction works
5. Test PDF export
6. Verify rate library endpoints:
   - `GET https://sama-alostoura.vercel.app/api/rates`
   - `GET https://sama-alostoura.vercel.app/api/rates?category=Excavation`

## Verification Checklist

After deployment, verify:

### Functionality
- [ ] Estimation appears in sidebar (phase: 1, clickable)
- [ ] Upload page loads
- [ ] File upload accepts PDF/JPG/PNG/DWG/DXF (validates type)
- [ ] File upload rejects files >50MB
- [ ] Project details form validates (required fields)
- [ ] AI extraction processes drawing (check browser network tab)
- [ ] Extracted BOQ shows 40+ items
- [ ] BOQ editor loads with full table
- [ ] Quantity edit updates amount auto
- [ ] Rate edit updates amount auto
- [ ] Add new item works
- [ ] Delete item works
- [ ] PDF export downloads with correct filename
- [ ] PDF shows company branding (Sama Alostoura header)
- [ ] PDF shows correct totals

### API Endpoints
- [ ] GET /api/rates returns rate library
- [ ] GET /api/rates?category=X filters correctly
- [ ] POST /api/rates adds new rate
- [ ] PUT /api/rates updates rate
- [ ] DELETE /api/rates removes rate
- [ ] GET /api/boqs lists BOQs
- [ ] POST /api/boqs creates BOQ
- [ ] GET /api/boqs?id=X retrieves specific BOQ
- [ ] PUT /api/boqs updates BOQ
- [ ] DELETE /api/boqs removes BOQ
- [ ] GET /api/boqs/export-pdf generates PDF

### Data
- [ ] `.rates-data.json` exists and contains 60+ items
- [ ] `.boq-data.json` exists after creating first BOQ
- [ ] `.uploads/` directory created on first upload
- [ ] Uploaded files are cleaned up after processing
- [ ] BOQ IDs are unique
- [ ] Rate IDs are unique

### Performance
- [ ] Page load time < 3 seconds
- [ ] AI extraction completes in < 5 minutes
- [ ] PDF export completes in < 10 seconds
- [ ] No console errors or warnings

### User Experience
- [ ] Error messages are clear and actionable
- [ ] Loading states show progress
- [ ] Success notifications appear
- [ ] Form validation prevents invalid submission
- [ ] Navigation links work correctly
- [ ] Back buttons work as expected

## Rollback Plan

If deployment has critical issues:

```bash
# Revert last commit
git revert HEAD --no-edit
git push origin main

# Wait for Vercel auto-redeploy to previous version
# Check Vercel dashboard for deployment status
```

If file-based storage gets corrupted:
```bash
# Manual recovery (requires file access)
rm .rates-data.json .boq-data.json
# Trigger new deployment to reinitialize
# OR manually call POST /api/rates/seed
```

## Known Issues & Workarounds

### Issue: "File not found" after upload
**Cause**: File path not accessible in API route
**Fix**: Check file upload handler creates files in correct directory

### Issue: AI extraction returns empty BOQ
**Cause**: Drawing file is not legible or in unsupported format
**Fix**: Test with clear, high-res drawings (JPG at 1080p+)

### Issue: PDF export fails
**Cause**: pdfkit dependency not installed
**Fix**: Run `npm install pdfkit` on server

### Issue: Rate library persists after redeployment
**Cause**: File-based storage lost on Vercel redeploy
**Fix**: Migrate to Supabase, or re-seed after each deploy

## Next Steps (Phase 2)

After Phase 1 is live:

1. **Supabase Migration**
   - Move `.rates-data.json` to `rate_library` table
   - Move `.boq-data.json` to `boqs` + `boq_items` tables
   - Update stores to use Supabase client

2. **Enhanced Features**
   - Multi-drawing support (plan + section + elevation)
   - Approval workflow (Draft → Reviewed → Approved)
   - Rate versioning (track historical rates)
   - Project integration (link BOQ to projects, track vs actuals)
   - Export to Excel/CSV

3. **Performance**
   - Caching layer for rate library
   - Image compression before sending to Claude
   - BOQ generation background jobs

4. **Mobile**
   - Mobile-responsive uploads
   - On-site drawing capture
   - Offline mode

## Support Contact

If issues arise during/after deployment:
1. Check Vercel logs: https://vercel.com/dashboard
2. Check API responses with curl (as shown above)
3. Review ESTIMATION-MODULE-GUIDE.md for API reference
4. Check rate library is initialized: GET /api/rates
5. Verify .env.local has SAMA_AI_KEY

---

**Deployment Date**: [To be filled]  
**Deployed By**: [To be filled]  
**Production URL**: https://sama-alostoura.vercel.app  
**Status**: Ready for deployment
