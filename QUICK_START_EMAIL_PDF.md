# Email PDF Feature - Quick Start Guide

## What's Ready ✅

- **Backend API**: POST `/email-itinerary` fully functional
- **n8n Workflow**: Ready to import and configure
- **Email Service**: Calls n8n webhook with proper timeout/logging
- **Documentation**: Complete setup guide in `backend/n8n/README.md`

## What's Needed ⏳

Only the **Frontend UI** to send emails is pending (2-3 hours of work).

## 3-Step Local Test

### 1. Start n8n (5 min)
```bash
npm install -g n8n
n8n
# Opens http://localhost:5678
```

### 2. Configure n8n (20 min)
1. Import workflow: `backend/n8n/send-itinerary-workflow.json`
2. Connect Gmail OAuth2 credentials
3. Set up PDFShift API (free tier: 100 conversions/month)
4. Copy webhook URL: `http://localhost:5678/webhook/send-itinerary`

### 3. Configure Backend (5 min)
```bash
# backend/.env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary

# Rebuild backend
cd backend
npm run build
npm run dev
```

## Test Without Frontend UI

### Using cURL
```bash
curl -X POST http://localhost:3001/email-itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "toEmail": "your-email@gmail.com"
  }'
```

**Note**: Must have a valid session with an itinerary first.

### Using Postman
1. Create POST request to `http://localhost:3001/email-itinerary`
2. Body (JSON):
   ```json
   {
     "sessionId": "existing-session-id",
     "toEmail": "recipient@example.com"
   }
   ```
3. Click Send
4. Should receive `{ "ok": true, "messageId": "..." }`

## Frontend UI Implementation (Next Step)

**Location**: `frontend/src/App.tsx`

Add this section above the itinerary:

```jsx
{hasItinerary && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <h3 className="text-sm font-semibold mb-2">Share Itinerary</h3>
    <div className="flex gap-2">
      <input
        type="email"
        placeholder="your@email.com"
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        className="flex-1 px-3 py-2 border rounded text-sm"
        disabled={isEmailLoading}
      />
      <button
        onClick={handleEmailItinerary}
        disabled={!emailInput.trim() || isEmailLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isEmailLoading ? 'Sending...' : 'Email PDF'}
      </button>
    </div>
    {emailSuccess && <p className="text-green-600 text-sm mt-2">{emailSuccess}</p>}
    {emailError && <p className="text-red-600 text-sm mt-2">{emailError}</p>}
  </div>
)}
```

## Architecture Overview

```
User Input      Backend              n8n                    Gmail
┌────────────┐  ┌─────────────────┐  ┌──────────────────┐   ┌─────┐
│ Email Input│  │ POST /email-    │  │ Webhook Trigger  │   │Send │
│ + Button   ├─→│ itinerary       ├─→│ Build HTML       ├──→│Email│
└────────────┘  │ Validate        │  │ Render PDF       │   │with │
                │ Call n8n        │  │ Attach to Email  │   │PDF  │
                └─────────────────┘  └──────────────────┘   └─────┘
                        ↑                                         ↓
                        └─────────── Response JSON ──────────────┘
                              ok + messageId
```

## Files Modified/Created

### Backend
- ✅ `src/services/emailItinerary.ts` - n8n client
- ✅ `src/routes/email-itinerary.ts` - API endpoint
- ✅ `server.ts` - Route registration
- ✅ `n8n/send-itinerary-workflow.json` - Workflow

### Shared
- ✅ `types.ts` - EmailItineraryRequest/Response

### Frontend
- ✅ `services/api.ts` - emailItinerary() method
- ⏳ `App.tsx` - UI input + handler (TODO)

## Env Variables Required

```bash
# backend/.env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary

# n8n Credentials (in n8n UI, not .env)
- Gmail OAuth2
- PDFShift API Key (username: "api", password: your key)
```

## Success Criteria

✅ User clicks "Email PDF"
✅ Email received with PDF attachment  
✅ PDF contains city, numDays, daily blocks with POIs
✅ Success message shown in UI
✅ All events logged in Debug tab

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 404 webhook error | Verify N8N_WEBHOOK_URL in backend .env |
| Gmail auth failed | Reconnect Gmail in n8n (OAuth may have expired) |
| PDF blank/invalid | Check PDFShift credentials; verify HTML in n8n logs |
| Email not arriving | Check spam folder; verify recipient email is correct |
| Timeout error | Increase timeout in emailItinerary.ts; check network |

## Next Commands

```bash
# Terminal 1: n8n
n8n

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev

# Terminal 4: Test with curl (after generating itinerary)
curl -X POST http://localhost:3001/email-itinerary \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID","toEmail":"your@email.com"}'
```

## Deployment

**Development**: Localhost (above commands)

**Production**:
- Backend: Deploy to Render.com
- Frontend: Deploy to Vercel  
- n8n: Use n8n.cloud (webhook URLs provided)

## Questions?

- n8n setup: https://docs.n8n.io
- Email API details: Check `backend/n8n/README.md`
- Frontend integration: Check this file + API contract above

---

**Ready to build the UI?** Edit `frontend/src/App.tsx` and add the email input component above! ✨
