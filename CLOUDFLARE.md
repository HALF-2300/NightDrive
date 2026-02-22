# Cloudflare — nightdrive.store

Your domain **nightdrive.store** is on Cloudflare. Use it for **DNS + proxy** (and optional rules). The **app itself** runs on Railway, Render, or your server — Cloudflare sits in front.

---

## 1. Log in

- **Dashboard:** [dash.cloudflare.com](https://dash.cloudflare.com)
- Open the **nightdrive.store** zone.

---

## 2. DNS — point the domain to your app

After you deploy (e.g. Railway gives you `something.up.railway.app`):

1. Go to **DNS** → **Records**.
2. **Root domain (nightdrive.store):**
   - **Type:** `CNAME`
   - **Name:** `@`
   - **Target:** your app hostname (e.g. `autoelite-production-xxxx.up.railway.app`)
   - **Proxy status:** **Proxied** (orange cloud) — recommended (DDoS, SSL, cache).
3. **Optional (www):**
   - **Type:** `CNAME`
   - **Name:** `www`
   - **Target:** same hostname as above (or `nightdrive.store`)
   - **Proxy status:** Proxied.

Save. DNS can take a few minutes to update.

---

## 3. SSL/TLS

- **SSL/TLS** → **Overview:** use **Full** or **Full (strict)** so Cloudflare uses HTTPS to your origin.
- With **Proxied** (orange cloud), Cloudflare serves HTTPS to visitors automatically.

---

## 4. Optional: redirect www → root

If you want **https://www.nightdrive.store** to redirect to **https://nightdrive.store**:

- **Rules** → **Redirect Rules** → **Create rule**
- **Name:** `www to root`
- **When:** Hostname equals `www.nightdrive.store`
- **Then:** Dynamic redirect → URL: `https://nightdrive.store/${uri.path}`, status 301.

---

## 5. App env (reminder)

On Railway/Render, set:

- `ALLOWED_ORIGINS` = `https://nightdrive.store`
- `TRUST_PROXY` = `1` (so the app sees the real visitor IP via `CF-Connecting-IP`)

---

**Summary:** Cloudflare = DNS + proxy for nightdrive.store. The Node app runs on Railway (or Render/VPS); Cloudflare forwards traffic to it.
