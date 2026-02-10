# Email Itinerary PDF Feature - Setup Guide

This guide explains how to set up the "Email Itinerary PDF" feature using n8n, backend, and frontend.

## Architecture

- **Frontend**: User enters email → clicks "Email PDF" button
- **Backend**: POST `/email-itinerary` validates session, calls n8n webhook
- **n8n**: Webhook receives data → renders HTML → generates PDF → sends via Gmail
- **Response**: Success/error returned to UI

## Prerequisites

1. **n8n** (local or cloud)
   - Self-hosted: `npm install -g n8n && n8n`
   - Cloud: https://n8n.cloud

2. **Gmail OAuth2 Setup**
   - Google Cloud Project with OAuth 2.0 credentials
   - Gmail API enabled

3. **PDF Generation API**
   - PDFShift (https://pdfshift.io) - Free tier available
   - Alternative: Puppeteer (if using self-hosted n8n with Puppeteer node)

## Step 1: Set Up n8n

### Option A: Local n8n (Recommended for Testing)

```bash
# Install n8n globally
npm install -g n8n

# Start n8n
n8n

# Open http://localhost:5678
```

### Option B: n8n Cloud

1. Go to https://n8n.cloud
2. Sign up / log in
3. Create a new workspace

## Step 2: Import Workflow

1. In n8n, go to **Workflows** → **Import**
2. Upload `send-itinerary-workflow.json` from this directory
3. The workflow `Send Itinerary PDF via Gmail` will be imported

## Step 3: Configure Credentials

### A. Set Up Gmail OAuth2

1. In n8n, go to **Credentials** → **Create New**
2. Select **Gmail**
3. Click **Connect my account** (redirects to Google OAuth)
4. Approve permissions
5. Save as `gmail_oauth`

**Important**: The Gmail account must be the one sending emails. Make sure it's configured in n8n's Gmail node.

### B. Set Up PDFShift (If Using PDFShift API)

1. Sign up at https://pdfshift.io (free tier: 100 conversions/month)
2. Get your API key
3. In n8n, go to **Credentials** → **Create New**
4. Select **HTTP Basic Auth**
5. Set:
   - Username: `api` (literal string)
   - Password: `YOUR_PDFSHIFT_API_KEY`
6. Save as `pdfshift_credential`

**Note**: The workflow uses PDFShift via HTTP Request. Credentials must match the node's authentication setting.

### Alternative: Use Puppeteer (Self-Hosted Only)

If self-hosting n8n and want free PDF generation:

1. Install Puppeteer node in n8n
2. Replace the "PDF Generator (PDFShift)" node with a Puppeteer node
3. Configure Puppeteer to print HTML to PDF
4. Output binary PDF to `pdf` property

## Step 4: Test the n8n Workflow

1. Open the workflow in n8n
2. Click **Test** (play button)
3. The webhook trigger will show its endpoint URL:
   ```
   http://localhost:5678/webhook/send-itinerary
   ```
4. Copy this URL for the backend configuration

## Step 5: Configure Backend Environment

1. Create/update `.env` in the backend root:
   ```
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary
   ```

2. For production (e.g., Render):
   ```
   N8N_WEBHOOK_URL=https://your-n8n-cloud-instance.n8n.cloud/webhook/send-itinerary
   ```

3. Rebuild backend:
   ```bash
   cd backend
   npm run build
   npm run dev
   ```

## Step 6: Build Frontend

```bash
cd frontend
npm run build  # or npm run dev for development
```

## Step 7: End-to-End Test

### Test Locally

1. **Start all services**:
   ```bash
   # Terminal 1: n8n
   n8n

   # Terminal 2: Backend
   cd backend && npm run dev

   # Terminal 3: Frontend
   cd frontend && npm run dev
   ```

2. **In the browser** (http://localhost:5174):
   - Create an itinerary: Say **"Plan a trip to Jaipur"**
   - Once itinerary loads, scroll to **Email Itinerary** section
   - Enter your email address (e.g., `test@gmail.com`)
   - Click **Email PDF** button

3. **Check results**:
   - **Success**: Inbox receives email with PDF attachment
   - **UI Feedback**: Green success message showing messageId
   - **Logs**: Backend console shows `[/email-itinerary] Success: { duration, messageId }`
   - **n8n Logs**: Workflow execution visible in n8n Executions tab

### Test Error Scenarios

1. **Invalid email**: Enter `invalid-email` → Should show validation error
2. **No session**: Send request without sessionId → 404 error
3. **No itinerary**: Create session but don't generate itinerary → 400 error
4. **n8n down**: Stop n8n, try to email → Timeout error

## Deployment

### Render.com (Backend)

1. Push code to GitHub
2. Create new Web Service on Render
3. Set environment variables:
   ```
   N8N_WEBHOOK_URL=https://your-n8n-url/webhook/send-itinerary
   ```
4. Deploy

### Vercel (Frontend)

```bash
npm i -g vercel
cd frontend
vercel --prod
```

Set environment variable:
```
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

### n8n Cloud or Self-Hosted Deployment

- **n8n Cloud**: Workflows are auto-saved; webhook URLs are stable
- **Self-Hosted**: Use your domain (e.g., `https://n8n.youromain.com`)

## Architecture Diagram

```
Frontend (React)                Backend (Express/TS)            n8n Workflow
┌─────────────────┐         ┌──────────────────┐          ┌──────────────────┐
│ Email Input +   │         │ POST /email-     │          │ Webhook Trigger  │
│ "Email PDF"     │────────→│ itinerary        │─────────→│ (receive data)   │
│ Button          │  JSON   │                  │  Fetch   │                  │
└─────────────────┘         │ Validate session │  POST    │ ┌──────────────┐ │
         │                  │ Build payload    │          │ │ Build HTML   │ │
         │                  │ Call n8n         │          │ └──────────────┘ │
         │                  │                  │          │        ↓         │
         │                  └──────────────────┘          │ ┌──────────────┐ │
         │                         ↑                      │ │ PDF Generator│ │
         │                         │                      │ └──────────────┘ │
         │                    Response JSON              │        ↓         │
         └─────────────────────────────────┐             │ ┌──────────────┐ │
                                           │             │ │ Gmail Send   │ │
                                 Toast/UI  │             │ └──────────────┘ │
                                 Feedback  │             │        ↓         │
                                           └─────────────│ Webhook Response │
                                                         └──────────────────┘
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 Not Found (webhook) | Check N8N_WEBHOOK_URL env var; ensure n8n is running |
| Gmail auth failed | Reconnect Gmail credentials in n8n; check app permissions |
| PDF not attached | Verify PDFShift credentials; check n8n PDF node configuration |
| Email timeout | Increase timeout in emailItinerary.ts; check network |
| CORS error (frontend) | Verify VITE_API_BASE_URL; backend CORS enabled |

## File Structure

```
backend/
├── n8n/
│   ├── README.md (this file)
│   └── send-itinerary-workflow.json
├── src/
│   ├── services/
│   │   └── emailItinerary.ts (n8n client)
│   ├── routes/
│   │   └── email-itinerary.ts (POST endpoint)
│   └── server.ts (route registration)
└── .env (N8N_WEBHOOK_URL)

frontend/
├── src/
│   └── services/
│       └── api.ts (emailItinerary() method)
└── .env.local (VITE_API_BASE_URL)

shared/
└── types.ts (EmailItineraryRequest/Response)
```

## API Contract

### Request
```json
POST /email-itinerary
{
  "sessionId": "session-123",
  "toEmail": "user@example.com"
}
```

### Response (Success)
```json
{
  "ok": true,
  "messageId": "18c1e2a10f1234567",
  "sentTo": "user@example.com"
}
```

### Response (Error)
```json
{
  "ok": false,
  "error": "Invalid email address"
}
```

## PDF Template

The n8n workflow generates an HTML PDF with:

- **Header**: City, NumDays
- **Summary**: Pace, Interests, MaxDailyHours
- **Days**: Morning/Afternoon/Evening blocks with:
  - POI name
  - Duration
  - Travel time (in minutes)
  - Notes
- **Sources**: List of POIs (name, sourceType)
- **Footer**: Generation timestamp, SessionId

Styled with:
- Blue accent colors (#1e40af, #0284c7)
- Readable fonts (Segoe UI)
- Page breaks for multi-day itineraries
- Mobile-friendly layout

## Next Steps

1. ✅ Set up n8n (local or cloud)
2. ✅ Import workflow
3. ✅ Configure Gmail OAuth2
4. ✅ Configure PDFShift (or alternative)
5. ✅ Add N8N_WEBHOOK_URL to backend .env
6. ✅ Test locally
7. ✅ Deploy to Render + Vercel
8. ✅ Share itinerary PDFs! 🎉

---

**Questions?** Check n8n docs: https://docs.n8n.io
