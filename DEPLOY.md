# Deploy NightDrive / AutoElite

The site is configured for **nightdrive.store** (canonicals, sitemap, robots).

---

## Cars not loading on Cloudflare Pages?

The frontend (Pages) must call your **Node backend** (Render or Railway). In **`public/config.js`** set:

```js
window.ND_API_BASE = 'https://YOUR-BACKEND-URL';  // no trailing slash
```

Use the exact URL Render or Railway gives you (e.g. `https://nightdrive.onrender.com` or `https://xxx.up.railway.app`). Then run `npm run deploy:web` again and ensure your backend has `ALLOWED_ORIGINS` including `https://nightdrive.store` and `https://nightdrive-795.pages.dev`.

---

## Usual production deploy: Cloudflare Pages

Deploy the **frontend** (static `public/` folder) to Cloudflare Pages:

```bash
npm run deploy:web
```

This runs **`wrangler pages deploy public --project-name=nightdrive`**. You must be logged in to Wrangler (`npx wrangler login`) or have `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.

**For real cars and full layout on Cloudflare Pages:** The Node API must run elsewhere (e.g. Railway). Then:
1. Deploy the Node app to **Railway** (or Render), set env vars and **ALLOWED_ORIGINS** = `https://nightdrive-795.pages.dev` and `https://nightdrive.store`.
2. In **`public/config.js`** set `window.ND_API_BASE = 'https://YOUR-RAILWAY-URL.up.railway.app';` (no trailing slash).
3. Run **`npm run deploy:web`** again so Pages serves the updated frontend. The site will then load real data, all rails, and contact/newsletter will work.

See **DEPLOY-FROM-AGENT.md** for why agent deploy can fail and how to enable it with tokens.

---

## Custom domain: nightdrive.store (Cloudflare)

Your domain is on **Cloudflare**. After you deploy (Railway, Render, or VPS), point the domain to your app:

### 1. Set production env vars for nightdrive.store

In your host’s **Environment** / **Variables**, set:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `MARKETCHECK_API_KEY` | (your key) |
| `ADMIN_TOKEN` | (strong random string) |
| `ALLOWED_ORIGINS` | `https://nightdrive.store` (or `https://nightdrive.store,https://www.nightdrive.store` if you use www) |
| `TRUST_PROXY` | `1` (so rate limiting uses real visitor IP behind Cloudflare) |
| `CANONICAL_HOST` | `nightdrive.store` |
| `PUBLIC_BASE_URL` | `https://nightdrive.store` |

Optional: `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET` if you use a webhook for leads.

### 2. Point nightdrive.store to your deployment in Cloudflare

- **Railway / Render (hosted URL):**  
  In **Cloudflare Dashboard** → **DNS** for nightdrive.store:
  - **Type:** CNAME  
  - **Name:** `@` (root) or `www` if you use www  
  - **Target:** your app’s hostname (e.g. `autoelite-production-xxxx.up.railway.app` or `autoelite.onrender.com`)  
  - **Proxy status:** Proxied (orange cloud) recommended for DDoS and SSL

- **Your own server (IP):**  
  - **Type:** A  
  - **Name:** `@`  
  - **IPv4 address:** your server IP  
  - **Proxy status:** Proxied (orange cloud) recommended

### 3. SSL

With Cloudflare proxy (orange cloud), Cloudflare handles HTTPS to visitors. If your app is on Railway/Render, they usually provide HTTPS to the origin; no extra step. If you use a VPS, you can use “Full (strict)” in Cloudflare SSL/TLS and an origin certificate, or “Full” with a self-signed or Let’s Encrypt cert on the server.

### 4. Optional: redirect www → root

In Cloudflare **Rules** → **Page Rules** (or **Redirect Rules**): redirect `https://www.nightdrive.store/*` to `https://nightdrive.store/$1` (301). Then keep `ALLOWED_ORIGINS` as `https://nightdrive.store` only, or include both if you keep www.

---

## Option A: Railway (easiest — free tier)

1. Go to **[railway.app](https://railway.app)** and sign in with **GitHub**.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select **HALF-2300/autoelite** (authorize Railway if asked).
4. Railway will detect Node and run `npm install` + `npm start`. Click **Deploy**.
5. After deploy, open **Settings** → **Variables** and add:
   - `NODE_ENV` = `production`
   - `MARKETCHECK_API_KEY` = (your key)
   - `ADMIN_TOKEN` = (strong random string)
   - `ALLOWED_ORIGINS` = `https://YOUR-APP.up.railway.app` (Railway will show the URL; use that, or your custom domain later)
6. Under **Settings** → **Networking** → **Generate Domain** to get a public URL.

**Serverless note:** Railway has persistent disk on paid plans. For free tier, set **LEAD_WEBHOOK_URL** (e.g. Zapier webhook) so you don’t lose leads.

---

## Option B: Render

### Required flow (Render) — port must come from Render

1. **Local (do not deploy before GitHub)**  
   - This app is **Node** (`server.js`), not Next.js.  
   - `package.json` has `"start": "node server.js"`. **Do not change** to `next start` — there is no Next.js app.  
   - The server already binds to `process.env.PORT` (see `server/env.js`). No code change needed for port.

2. **Commit and push** to GitHub (`main`/`master`).

3. **In Render**  
   - Service is connected to your GitHub repo and branch.  
   - **Start command:** `npm start` (default). Do **not** override with a custom port (e.g. no `next start -p 6036`).  
   - **Do not** set `PORT` in Environment — Render injects it (e.g. 10000).  
   - Trigger deploy (or let auto-deploy run after push).

**Goal:** Render detects the open port (usually 10000) and deployment turns green.

---

1. Go to **[render.com](https://render.com)** and sign in with **GitHub**.
2. **New** → **Web Service**.
3. Connect **HALF-2300/autoelite**.
4. **Build command:** `npm install`  
   **Start command:** `npm start` (do not override; the app binds to `PORT` from the environment)  
   **Instance type:** Free (or paid for persistent disk).
5. **Environment** → Add: `NODE_ENV`, `MARKETCHECK_API_KEY`, `ADMIN_TOKEN`, `ALLOWED_ORIGINS` (use the Render URL they give you, e.g. `https://autoelite.onrender.com`).  
   **Do not set `PORT`** — Render injects it automatically (e.g. 10000). The app uses `process.env.PORT`.
6. Click **Create Web Service**.

---

## Option C: Your own server (VPS)

```bash
# On the server (Ubuntu example)
git clone https://github.com/HALF-2300/autoelite.git
cd autoelite
cp .env.example .env
# Edit .env: NODE_ENV=production, MARKETCHECK_API_KEY, ADMIN_TOKEN, ALLOWED_ORIGINS
npm install
npm run pm2:start
```

Put Nginx or Caddy in front for HTTPS and set `TRUST_PROXY=1` in `.env`.

---

## Env vars you must set in production

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `MARKETCHECK_API_KEY` | Yes | (from MarketCheck) |
| `ADMIN_TOKEN` | Yes | (strong random string) |
| `ALLOWED_ORIGINS` | Yes | `https://nightdrive.store` (your domain on Cloudflare) |
| `LEAD_WEBHOOK_URL` | If serverless | (Zapier/Make webhook) |
| `LEAD_WEBHOOK_SECRET` | If using webhook | (shared secret) |

After deploy, open the URL and confirm the homepage and inventory load.
