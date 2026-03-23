# Mail Blast

Mail Blast is an installable web app (PWA) for generating and sending personalized job-application emails in bulk.

It uses:
- React + Vite for the frontend UI
- Express + Nodemailer for backend email sending
- Gmail SMTP App Password authentication
- XLSX parsing for company list upload
- PWA service worker + manifest for install on desktop/mobile

## Tech Stack

Frontend:
- React 18
- Vite 6
- vite-plugin-pwa
- xlsx

Backend:
- Node.js
- Express
- Nodemailer
- CORS

DevOps / Tooling:
- Dockerfile
- GitHub Actions CI (`.github/workflows/ci.yml`)

## Project Flow

1. User fills profile details (name, links, about, phone).
2. User sets sender Gmail + App Password in Step 2 and tests SMTP.
3. User uploads Excel or adds target company rows manually.
4. App generates per-company personalized email subject/body.
5. User reviews/edits email preview.
6. App sends each email through backend `/api/send` using Gmail SMTP.
7. UI tracks statuses: Pending, Ready, Sending, Sent, Failed.

## Folder Structure

- `src/App.jsx`: main multi-step application UI and logic
- `src/main.jsx`: React entry point
- `src/index.css`: global styles
- `server.js`: Express API server (`/api/send`, `/api/test-connection`)
- `vite.config.js`: Vite + PWA configuration
- `public/`: app icons and favicon

## Installation

Prerequisites:
- Node.js 18+
- npm 9+
- Gmail account with 2-Step Verification enabled

Install dependencies:

```bash
npm install
```

## Run (Development)

Use two terminals.

Terminal 1 (backend):

```bash
npm start
```

Terminal 2 (frontend):

```bash
npm run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

(Vite proxies `/api` requests to backend.)

## Run (Production Build)

```bash
npm run build
npm start
```

Open:
- `http://localhost:3000`

## How To Use The App

### Step 1: Profile
- Fill your personal information.
- Optional: upload resume PDF (attached to outgoing emails).

### Step 2: Email Setup (Important)
- Enter sender Gmail address.
- Enter Gmail App Password (NOT your normal Gmail password).
- Click **Test Connection**.

Google Account Center navigation to create App Password:

1. Open `https://myaccount.google.com/`
2. Go to **Security**
3. Under **How you sign in to Google**, open **2-Step Verification** and enable it
4. Return to **Security** page
5. Open **App passwords**
6. In **Select app**, choose **Mail** (or **Other (custom name)** and type Mail Blast)
7. Click **Generate**
8. Copy the 16-character app password
9. Paste it in Step 2 in Mail Blast

Notes:
- If you do not see **App passwords**, confirm 2-Step Verification is ON and account policy allows app passwords.
- Remove spaces if authentication fails.

### Step 3: Companies
- Upload `.xlsx/.xls/.csv` file or add rows manually.
- Required fields: company, contact, email, designation.

### Step 4: Generate & Send
- Click **Generate All Emails**.
- Review previews and edit if needed.
- Click **Send All** or send one by one.

## Excel Template Columns

Recommended headers:
- `company`
- `contact`
- `email`
- `designation`
- `industry` (optional)

## API Endpoints

- `POST /api/test-connection`
  - Body: `senderEmail`, `appPassword`
  - Purpose: verify Gmail SMTP credentials

- `POST /api/send`
  - Body: `senderEmail`, `appPassword`, `to`, `subject`, `body`, optional attachment fields
  - Purpose: send one email

## PWA Install

Desktop (Chrome/Edge):
- Open app URL
- Click install icon in address bar
- Confirm install

Mobile:
- Open app in browser
- Use **Add to Home Screen**

## Security Notes

- Never commit real credentials.
- Use App Passwords only.
- `.env` is ignored by git.
- For production, run behind HTTPS and add rate limiting/auth on backend if exposing publicly.

## Docker

Build and run:

```bash
docker build -t mail-blast:latest .
docker run -p 3000:3000 mail-blast:latest
```

## CI

CI workflow builds the project on push/PR to main:
- `.github/workflows/ci.yml`

## Troubleshooting

1. SMTP auth error:
- Ensure App Password is correct
- Ensure 2-Step Verification is enabled

2. Emails not visible:
- Check Spam/Promotions tabs
- Verify recipient address spelling

3. Backend unreachable:
- Ensure `npm start` is running on port 3000

## License

MIT (see `LICENSE`).
