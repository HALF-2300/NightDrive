# Deploy from this environment (agent / Cursor)

**For the agent:** Deploy from here will **fail** unless a deploy token and (for some hosts) a linked project exist. This doc explains why and what the **human** must do once so the agent can run deploy commands successfully.

---

## Why deploy fails from here

| Try | Result |
|-----|--------|
| **Vercel** `npx vercel --yes` | *"The specified token is not valid. Use `vercel login` to generate a new token."* |
| **Netlify** `npx netlify deploy --prod` | Interactive prompt to link/create a site (no linked project). |
| **Railway** `npx railway up --detach` | *"Unauthorized. Please login with `railway login`"* |
| **Git push** (e.g. trigger Railway auto-deploy) | *"Repository not found"* if GitHub repo is missing or no access. |

So in this environment there is **no valid deploy token** and **no linked project**. The agent cannot complete a deploy on its own until the one-time setup below is done.

---

## How "deploy from here" is supposed to work

For the agent to deploy from here, **you (the human)** must do a **one-time setup** so the CLI can run without interactive login:

1. **Pick a host** (e.g. **Railway**, or Vercel / Netlify).
2. **Log in and link** on your machine:
   - Log in via the host's CLI (`railway login`, `vercel login`, or `netlify login`).
   - Link this repo to a project (`railway init`, or Netlify "link site", or Vercel project link).
3. **Create an API token** in the host's dashboard (e.g. Railway → Account → Tokens).
4. **Put the token where the agent can see it** (e.g. Cursor env or your shell):
   - **Railway:** `RAILWAY_TOKEN` = that token.
   - **Vercel:** `VERCEL_TOKEN` (and optionally `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` if you use non-interactive deploy).
   - **Netlify:** `NETLIFY_AUTH_TOKEN` (and link the site once so `NETLIFY_SITE_ID` is set, or pass it in).
5. After that, the agent can run the deploy command from here (e.g. `npx railway up --detach`) and it will succeed.

---

## One-time setup by host

### Railway

1. On your machine: `npx railway login`, then in this repo `npx railway init` and link the project.
2. Railway dashboard → **Account** → **Tokens** → create a token.
3. Set in Cursor / shell: **`RAILWAY_TOKEN`** = that token.
4. Agent can run: **`npx railway up --detach`**.

### Vercel

1. On your machine: `npx vercel login`, then `npx vercel link` in this repo (link org + project).
2. Vercel dashboard → **Settings** → **Tokens** → create a token.
3. Set: **`VERCEL_TOKEN`** = that token. Optionally **`VERCEL_ORG_ID`** and **`VERCEL_PROJECT_ID`** for non-interactive deploy.
4. Agent can run: **`npx vercel --prod --yes`** (or `npx vercel deploy --prod` with token in env).

### Netlify

1. On your machine: `npx netlify login`, then `npx netlify init` in this repo (link or create site).
2. Netlify dashboard → **User settings** → **Applications** → **Personal access tokens** → create.
3. Set: **`NETLIFY_AUTH_TOKEN`** = that token. If needed, **`NETLIFY_SITE_ID`** (from `netlify status` or site settings).
4. Agent can run: **`npx netlify deploy --prod`** (with token and site id in env, no interactive prompt).

---

## TL;DR for the agent

- **Deploy from here fails** because there is no deploy token (and for Railway/Netlify, no linked project) in this environment.
- **To deploy from here:** The human must add **RAILWAY_TOKEN** (or Vercel/Netlify token) and, for Railway/Netlify, link the project once. Then the agent can run the host's deploy command (e.g. `npx railway up --detach`) and it will succeed.
- **This repo's usual production deploy** is **Cloudflare Pages** from a local build: `npm run deploy:web` (see **DEPLOY.md**). That uses Wrangler and does not require a separate deploy token in this doc; it uses the logged-in Wrangler session or CI secrets where applicable.
