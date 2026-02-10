# Email PDF Feature - Configuration Checklist ✅

## Backend Configuration (DONE ✅)

### Environment Variables
- ✅ `backend/.env` updated with `N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary`
- ✅ GROQ_API_KEY and GROQ_MODEL already configured
- ✅ Backend builds successfully (`npm run build`)

### Files Ready
- ✅ `src/services/emailItinerary.ts` - n8n client service
- ✅ `src/routes/email-itinerary.ts` - POST /email-itinerary endpoint
- ✅ `server.ts` - Route registered at `/email-itinerary`
- ✅ `n8n/send-itinerary-workflow.json` - Workflow ready to import

### API Contract Ready
- ✅ Types in `shared/types.ts` (EmailItineraryRequest, EmailItineraryResponse)
- ✅ Endpoint accepts: `{ sessionId, toEmail }`
- ✅ Returns: `{ ok, messageId, sentTo, error }`

---

## Frontend Configuration (DONE ✅)

### Code Ready
- ✅ `src/services/api.ts` - `api.emailItinerary(sessionId, toEmail)` method added
- ✅ Frontend builds successfully (`npm run build`)
- ✅ No TypeScript errors

### Still Needed (UI Only)
- ⏳ Email input field in `App.tsx` (template provided in QUICK_START_EMAIL_PDF.md)
- ⏳ Email submission handler
- ⏳ Success/error feedback display

---

## n8n Configuration (SETUP REQUIRED)

### Prerequisites
- [ ] n8n installed (`npm install -g n8n`)
- [ ] n8n running on port 5678 (`n8n` command)
- [ ] Open http://localhost:5678 in browser

### Workflow Setup
- [ ] Import workflow: `backend/n8n/send-itinerary-workflow.json`
- [ ] Workflow appears in n8n with name "Send Itinerary PDF via Gmail"

### Gmail Credentials
- [ ] In n8n, create Gmail credential (OAuth2)
- [ ] Click "Connect my account" → Google OAuth flow
- [ ] Approve permissions
- [ ] Save as credential name `gmail_oauth`

### PDFShift Setup
- [ ] Sign up at https://pdfshift.io (free tier: 100 conversions/month)
- [ ] Get API key from dashboard
- [ ] In n8n, create HTTP Basic Auth credential:
  - Username: `api` (literal)
  - Password: `YOUR_PDFSHIFT_API_KEY`
  - Save as: `pdfshift_credential`

### Verify Workflow
- [ ] Click "Test" button on workflow
- [ ] Should show webhook URL: `http://localhost:5678/webhook/send-itinerary`
- [ ] Copy this URL (matches N8N_WEBHOOK_URL in backend .env)

---

## Pre-Test Checklist

### Verify Files Exist
```
✅ backend/n8n/send-itinerary-workflow.json (workflow)
✅ backend/n8n/README.md (setup guide)
✅ backend/src/services/emailItinerary.ts
✅ backend/src/routes/email-itinerary.ts
✅ shared/types.ts (has EmailItinerary types)
✅ frontend/src/services/api.ts (has emailItinerary method)
```

### Verify Environment
```
✅ backend/.env has N8N_WEBHOOK_URL
✅ backend/.env has GROQ_API_KEY
✅ backend compiles (npm run build)
✅ frontend compiles (npm run build)
```

### Verify n8n
```
⏳ n8n running on localhost:5678
⏳ Workflow imported
⏳ Gmail credentials configured
⏳ PDFShift credentials configured
```

---

## Testing Strategy

### Phase 1: Backend Only (No Frontend)
1. Start n8n: `n8n`
2. Start backend: `cd backend && npm run dev`
3. Test with cURL:
   ```bash
   curl -X POST http://localhost:3001/email-itinerary \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"test-123","toEmail":"your@email.com"}'
   ```
4. Expected: `{ "ok": true, "messageId": "...", "sentTo": "..." }`
5. Check email inbox for PDF

### Phase 2: Full Stack (With Frontend UI)
1. Start n8n: `n8n`
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`
4. In browser (http://localhost:5174):
   - Create itinerary: "Plan a trip to Jaipur"
   - Enter email address
   - Click "Email PDF" button
   - See success message
   - Check email inbox

### Phase 3: Production Test
1. Deploy backend to Render.com (set N8N_WEBHOOK_URL env var)
2. Deploy frontend to Vercel
3. Deploy n8n to n8n.cloud
4. Update N8N_WEBHOOK_URL to point to n8n.cloud instance
5. Test end-to-end

---

## Commands Reference

### Backend
```bash
cd backend
npm install           # if needed
npm run build         # compile TypeScript
npm run dev          # start dev server with auto-reload
```

### Frontend
```bash
cd frontend
npm install           # if needed
npm run build         # compile & bundle
npm run dev          # start Vite dev server
```

### n8n
```bash
npm install -g n8n
n8n                  # starts on http://localhost:5678
```

---

## Deployment URLs

### Local Testing
- Backend: http://localhost:3001
- Frontend: http://localhost:5174
- n8n: http://localhost:5678

### Production (Example)
- Backend: https://travel-planner-backend.onrender.com
- Frontend: https://travel-planner-frontend.vercel.app
- n8n: https://your-instance.n8n.cloud

Update N8N_WEBHOOK_URL in production backend to point to n8n cloud instance.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check .env has N8N_WEBHOOK_URL; run `npm run build` first |
| Frontend won't build | Check for unused imports; run `npm run build` again |
| n8n webhook 404 | Verify N8N_WEBHOOK_URL matches n8n webhook path |
| Gmail auth failed | Reconnect Gmail in n8n (OAuth tokens may have expired) |
| Email not received | Check spam folder; verify recipient email is correct |

---

## Status Summary

✅ **Backend**: Ready to deploy - all files compiled, .env configured
✅ **n8n**: Workflow file ready - awaiting credential configuration
✅ **Frontend API**: Ready - emailItinerary() method implemented
⏳ **Frontend UI**: Pending - add email input component to App.tsx

**Next Step**: Configure n8n credentials, then test backend with cURL. Add frontend UI after verification.

---

**Updated**: 2026-02-10
**Status**: 75% Complete - Infrastructure ready, awaiting n8n config + frontend UI
