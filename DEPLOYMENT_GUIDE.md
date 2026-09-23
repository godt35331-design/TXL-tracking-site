# 🚀 Deployment Guide: TXL Express Logistics Portal

This guide provides step-by-step instructions for deploying the **Backend to Render** and the **Frontend to Vercel**.

---

## 1. Deploying the Backend (Render)

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Connect your GitHub repository (`dhl-shipping-express`).
4. Configure the Web Service settings:
   - **Name**: `txl-express-backend`
   - **Runtime**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
5. **Add Environment Variables** in Render:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `PORT` | `5000` | Optional, Render assigns port automatically |
   | `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster0.onvwer6.mongodb.net/txl_portal?retryWrites=true&w=majority` | Your live MongoDB Atlas cluster connection string |
   | `ADMIN_EMAIL` | `admin@txlglobaltracking.com` | Primary admin username |
   | `ADMIN_PASSWORD` | `admin123` | Your admin password |
   | `PORTAL_DOMAIN` | `txlglobaltracking.com` | Your live custom domain |
   | `FROM_EMAIL` | `TXL Express Support <support@txlglobaltracking.com>` | Verified sender address |
   | `RESEND_API_KEY` | `your_resend_api_key_here` | Your verified Resend API Key |

6. Click **Deploy Web Service**.
7. Once deployed, copy your Render URL (e.g. `https://txl-express-backend.onrender.com`).

---

## 2. Deploying the Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your GitHub repository (`dhl-shipping-express`).
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (or leave default `./` since root `vercel.json` is preconfigured)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Add Environment Variables** in Vercel:
   | Key | Value | Example |
   | :--- | :--- | :--- |
   | `VITE_API_BASE` | `https://<your-render-backend-url>/api` | `https://txl-express-backend.onrender.com/api` |
   | `VITE_WS_BASE` | `wss://<your-render-backend-hostname>` | `wss://txl-express-backend.onrender.com` |

5. Click **Deploy**.
6. **Connect Custom Domain in Vercel**:
   - In your Vercel Project &rarr; **Settings** &rarr; **Domains**.
   - Enter `txlglobaltracking.com` (and `www.txlglobaltracking.com`).
   - In your Cloudflare DNS, add a `CNAME` record pointing `@` and `www` to `cname.vercel-dns.com` (set Proxy status to DNS only / grey cloud).
   - Vercel will automatically provision free SSL certificates!

---

## 3. Connecting Inbound Emails to the App's Messages Tab

To receive customer replies directly into the app's **Email Messages** tab (`#messages`):

1. Go to your [Resend Dashboard](https://resend.com/webhooks).
2. Click **Add Webhook**:
   - **Endpoint URL**: `https://<your-render-backend-url>/api/inbound-email`
   - **Events**: Select `email.received`
3. Click **Add**.
4. **Result**: Whenever any customer replies to an email from their phone or computer, Resend automatically pushes the reply into your website's **Email Messages** tab in real-time, and you can reply to them directly from the portal!
