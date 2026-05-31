# 📧 Email OTP Setup Guide — Steve OS

Follow these steps to enable **real email OTP verification** for registration and password reset.

---

## Step 1 — Enable Gmail 2-Step Verification

1. Go to **https://myaccount.google.com/security**
2. Under *"How you sign in to Google"*, click **2-Step Verification**
3. Follow the prompts to turn it ON (required to generate App Passwords)

---

## Step 2 — Generate a Gmail App Password

1. Go to **https://myaccount.google.com/apppasswords**
2. You may be asked to sign in again
3. Under **"Select app"** → choose **Mail**
4. Under **"Select device"** → choose **Windows Computer**
5. Click **Generate**
6. Copy the **16-character password** shown (e.g. `abcd efgh ijkl mnop`)

> ⚠️ This password is shown **once only**. Copy it immediately.

---

## Step 3 — Paste into `backend/.env`

Open `backend/.env` and fill in:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.actual.email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM_EMAIL=noreply@restaurant.com
SMTP_FROM_NAME=Steve OS
```

Replace:
- `your.actual.email@gmail.com` → your Gmail address
- `abcd efgh ijkl mnop` → the 16-char App Password you just generated

---

## Step 4 — Restart the Backend

```bash
# In the backend directory:
node server.js
```

You should see:
```
SMTP email transporter initialized successfully.
```

---

## Step 5 — Test It

1. Open the web app → click **Register**
2. Fill in username, email, password
3. Click **Send OTP**
4. Check your email inbox — you should receive a Steve OS OTP email within seconds
5. Enter the 6-digit code to complete registration

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "SMTP not configured" in console | Check `.env` values are saved and server restarted |
| Email not arriving | Check spam/junk folder |
| "Invalid login" error | Make sure you used App Password, not your Gmail password |
| "Less secure apps" error | App Password bypasses this — make sure 2FA is ON |
| App Password page not visible | 2-Step Verification must be enabled first |

---

## Alternative: Use Any SMTP Provider

You can also use **SendGrid**, **Mailgun**, or **Brevo**:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key
```

---

> The OTP code is **never stored in the database** and **never returned to the browser**.  
> It lives only in server memory and expires in **5 minutes**.
