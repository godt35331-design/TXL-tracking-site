# 🚀 Deployment Guide: TXL Express Logistics Portal

This guide provides step-by-step instructions for deploying the **Backend to Render** and the **Frontend to Cloudflare Pages**.

---

## 1. Deploying the Backend (Render)

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   - **Name**: `txl-express-backend`
   - **Runtime**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
5. **Add Environment Variables** in Render:
   | Key | Value | Example |
   | :--- | :--- | :--- |
   | `PORT` | `5000` | `5000` |
   | `MONGODB_URI` | Your MongoDB Atlas Connection String | `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/txl_portal?retryWrites=true&w=majority` |
   | `ADMIN_EMAIL` | `admin@txlglobaltracking.com` | `admin@txlglobaltracking.com` |
   | `ADMIN_PASSWORD` | `admin123` | `admin123` |
   | `PORTAL_DOMAIN` | `txlglobaltracking.com` | `txlglobaltracking.com` |
   | `FROM_EMAIL` | `TXL Express Support <support@txlglobaltracking.com>` | `TXL Express Support <support@txlglobaltracking.com>` |
   | `RESEND_API_KEY` | `your_resend_api_key_here` | *(optional for live emails)* |

6. Click **Deploy Web Service**.
7. Once deployed, copy your Render URL (e.g., `https://txl-express-backend.onrender.com`).

---

## 2. Deploying the Frontend (Cloudflare Pages)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) &rarr; **Workers & Pages**.
2. Click **Create application** &rarr; Select the **Pages** tab &rarr; **Connect to Git**.
3. Select your repository.
4. Configure Project Settings:
   - **Framework Preset**: `React (Vite)`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
5. **Add Environment Variables** in Cloudflare Pages:
   | Key | Value | Example |
   | :--- | :--- | :--- |
   | `VITE_API_BASE` | `<Your-Render-URL>/api` | `https://txl-express-backend.onrender.com/api` |
   | `VITE_WS_BASE` | `wss://<Your-Render-Hostname>` | `wss://txl-express-backend.onrender.com` |

6. Click **Save and Deploy**.
7. Your frontend will be live on Cloudflare Pages with zero security flags and lightning fast edge loading!

---

## 3. Post-Deployment Checklist

1. **MongoDB Atlas IP Whitelist**:
   - In MongoDB Atlas &rarr; **Network Access**, ensure `0.0.0.0/0` is whitelisted so Render can connect.
2. **Custom Domain**:
   - In Cloudflare Pages &rarr; **Custom domains**, connect your new TXL domain.
3. **Resend Inbound Webhook**:
   - In Resend &rarr; Webhooks, point to `https://<Your-Render-URL>/api/inbound-email` for real-time customer reply tracking.
