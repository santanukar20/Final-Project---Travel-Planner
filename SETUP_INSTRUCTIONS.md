# Email PDF Feature - Setup Instructions

**Status**: 85% Complete - Ready for n8n configuration and testing

---

## What's Included ✅

### Backend (Ready to Deploy)
- `src/services/emailItinerary.ts` - Calls n8n webhook
- `src/routes/email-itinerary.ts` - POST /email-itinerary endpoint
- `server.ts` - Route registered
- `.env` - N8N_WEBHOOK_URL configured
- ✅ Compiles without errors

### Frontend (Partial)
- `src/services/api.ts` - emailItinerary() method implemented
- ✅ Compiles without errors
- ⏳ UI component needed (template provided)

### Documentation
- `n8n/README.md` - Complete 308-line setup guide
- `QUICK_START_EMAIL_PDF.md` - Quick reference guide
- `EMAIL_PDF_FEATURE_STATUS.md` - Implementation tracker
- `EMAIL_FEATURE_CONFIG_CHECKLIST.md` - Verification checklist
- `test-email-endpoint.js` - Testing script

---

## 10-Minute Quick Setup

### Step 1: Install n8n (3 min)
```bash
npm install -g n8n
n8n
# Opens http://localhost:5678
```

### Step 2: Import Workflow (2 min)
1. Go to n8n Workflows → Import
2. Upload `backend/n8n/send-itinerary-workflow.json`
3. Click Import

### Step 3: Configure Gmail (3 min)
1. In workflow, click Gmail node
2. Click Add Credentials → Click "Connect my account"
3. Complete Google OAuth
4. Save as `gmail_oauth`

### Step 4: Configure PDFShift (2 min)
1. Sign up free at https://pdfshift.io
2. Get API key
3. In n8n, click PDF Generator node
4. Add HTTP Basic Auth credential:
   - Username: `api`
   - Password: `YOUR_KEY`
   - Save as `pdfshift_credential`

### Done! ✅
- Backend running: `cd backend && npm run dev`
- Frontend running: `cd frontend && npm run dev`
- Test: Create itinerary, email it

---

## Detailed Instructions

### Prerequisites
- Node.js 16+ installed
- npm installed
- Gmail account
- PDFShift free account (100 free conversions/month)

### 1. Start n8n

**Option A: Local (Recommended)**
```bash
npm install -g n8n
n8n
# Opens http://localhost:5678
```

**Option B: Docker**
```bash
docker run -it -p 5678:5678 n8nio/n8n
```

**Option C: Cloud** (https://n8n.cloud)
- Sign up and create workspace
- Workflows managed in cloud dashboard

### 2. Import Workflow

**In n8n Dashboard**:
1. Click Workflows (top left)
2. Click Import → Select File
3. Choose `backend/n8n/send-itinerary-workflow.json`
4. Click Import

**You should see**:
- Workflow named "Send Itinerary PDF via Gmail"
- 6 nodes connected: Webhook → Build HTML → PDF Generator → Gmail → Response (Success/Error)

### 3. Create Gmail OAuth Credential

**In n8n**:
1. Click Credentials (bottom left sidebar)
2. Click Create New
3. Search for "Gmail"
4. Select Google OAuth2
5. Click "Connect my account"
6. Sign in to your Google account
7. Review and approve permissions
8. Save credential with name: `gmail_oauth`

**Verify**: In Gmail node, you should see the Gmail credential selected.

### 4. Create PDFShift API Credential

**First, get API key**:
1. Go to https://pdfshift.io
2. Sign up (free: 100 conversions/month)
3. Go to Dashboard → API Key
4. Copy your API key

**In n8n**:
1. Click Credentials
2. Click Create New
3. Search for "HTTP Basic Auth"
4. Select HTTP Basic Auth
5. Fill in:
   - Username: `api` (literal string)
   - Password: `YOUR_PDFSHIFT_API_KEY` (paste your key)
6. Save with name: `pdfshift_credential`

**Verify**: In PDF Generator node, check the credential is selected.

### 5. Activate Workflow

**In n8n**:
1. Open the workflow
2. Click "Active" toggle (top right) to turn it ON
3. Status should show green "Active"

### 6. Test Webhook

**In n8n**:
1. Click "Test" button
2. Workflow page shows: 
   ```
   Webhook waiting for POST to:
   http://localhost:5678/webhook/send-itinerary
   ```
3. Copy this URL (should match `N8N_WEBHOOK_URL` in backend .env)

---

## Backend Configuration

### Environment Variables

**File**: `backend/.env`
```
GROQ_API_KEY=gsk_8auwGKc4...
GROQ_MODEL=llama-3.1-8b-instant
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary
```

**For Production**:
```
N8N_WEBHOOK_URL=https://your-n8n-cloud-instance.n8n.cloud/webhook/send-itinerary
```

### Build & Run

```bash
cd backend
npm install    # if needed
npm run build  # compile TypeScript
npm run dev    # start Express server on port 3001
```

**Expected output**:
```
Travel Planner Backend listening on http://localhost:3001
```

---

## Frontend Setup

### Build

```bash
cd frontend
npm install    # if needed
npm run build  # compile
npm run dev    # start Vite dev server on port 5174
```

**Expected output**:
```
VITE v7.3.1 ready in 402 ms
Local:   http://localhost:5174/
```

### Add Email UI (Next Step)

In `frontend/src/App.tsx`, add this before itinerary section:

```jsx
const [emailInput, setEmailInput] = useState('');
const [isEmailLoading, setIsEmailLoading] = useState(false);
const [emailSuccess, setEmailSuccess] = useState('');
const [emailError, setEmailError] = useState('');

const handleEmailItinerary = async () => {
  if (!emailInput.trim() || !sessionId) return;
  setIsEmailLoading(true);
  setEmailSuccess('');
  setEmailError('');
  try {
    const result = await api.emailItinerary(sessionId, emailInput);
    if (result.ok) {
      setEmailSuccess(`✅ Sent to ${emailInput}`);
      setEmailInput('');
    } else {
      setEmailError(`❌ ${result.error}`);
    }
  } catch (err) {
    setEmailError(`❌ ${(err as any).message}`);
  } finally {
    setIsEmailLoading(false);
  }
};

// In JSX (above itinerary):
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

---

## Testing

### Option 1: Test Without Frontend (Fastest)

**Use the test script**:
```bash
cd backend
# Edit test-email-endpoint.js: set TEST_SESSION_ID and TEST_EMAIL
node test-email-endpoint.js
```

**How to get SESSION_ID**:
1. Open http://localhost:5174
2. Create itinerary: "Plan a trip to Jaipur"
3. Open DevTools (F12) → Network tab
4. Find /plan response → copy sessionId from body

### Option 2: Full E2E Test (With UI)

1. Start all 3 services:
   ```bash
   # Terminal 1
   n8n

   # Terminal 2
   cd backend && npm run dev

   # Terminal 3
   cd frontend && npm run dev
   ```

2. In browser (http://localhost:5174):
   - Create itinerary: "Plan a trip to Jaipur"
   - Scroll down to Email Itinerary section
   - Enter email address
   - Click "Email PDF"
   - See success message
   - Check email inbox

### Expected Results

**Success**:
- UI shows: "✅ Sent to user@email.com"
- Email arrives within 1-2 minutes
- Subject: "Your Trip to Jaipur Itinerary"
- PDF attachment: itinerary.pdf
- PDF contains: City, day blocks, POI details, sources

**Error**:
- UI shows: "❌ Invalid email address" (validation error)
- OR: "❌ Failed to send email" (n8n error)
- Check backend console logs for details

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to webhook" | n8n not running; start with `n8n` command |
| "Gmail auth failed" | Reconnect Gmail in n8n; OAuth tokens may expire |
| "PDF generation failed" | Check PDFShift credentials; verify API key |
| "Email not received" | Check spam folder; verify recipient email is correct |
| "Backend error 404" | Verify N8N_WEBHOOK_URL in backend .env |
| "Frontend build fails" | Run `npm install` first; check TypeScript errors |

---

## File Locations

```
project-root/
├── backend/
│   ├── n8n/
│   │   ├── send-itinerary-workflow.json   (workflow)
│   │   └── README.md                      (detailed setup)
│   ├── src/
│   │   ├── services/
│   │   │   └── emailItinerary.ts         (n8n client)
│   │   ├── routes/
│   │   │   └── email-itinerary.ts        (API endpoint)
│   │   └── server.ts                      (route registered)
│   ├── .env                               (N8N_WEBHOOK_URL)
│   ├── test-email-endpoint.js            (test script)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts                    (emailItinerary method)
│   │   └── App.tsx                        (add UI component)
│   └── package.json
│
├── shared/
│   └── types.ts                           (EmailItinerary types)
│
└── Documentation files
    ├── SETUP_INSTRUCTIONS.md              (this file)
    ├── QUICK_START_EMAIL_PDF.md           (quick reference)
    ├── EMAIL_PDF_FEATURE_STATUS.md        (status tracker)
    └── EMAIL_FEATURE_CONFIG_CHECKLIST.md  (verification)
```

---

## Next Steps

1. ✅ Backend configuration complete
2. ⏳ **[You are here]** - Set up n8n workflow + credentials
3. ⏳ Add email input UI to frontend
4. ⏳ Test end-to-end
5. ⏳ Deploy to production

---

## Support

- **n8n Docs**: https://docs.n8n.io
- **Gmail API**: https://developers.google.com/gmail/api
- **PDFShift Docs**: https://pdfshift.io/documentation

---

**Status**: Configuration phase - all infrastructure ready, awaiting n8n setup ✨
