# Render setup (if settings keep changing back)

If Render keeps reverting to Docker and you see **"failed to read dockerfile: open npm start"**:

1. Go to **NightDrive** → **Settings** → **Build & Deploy**.

2. **Dockerfile path:** set to exactly **`Dockerfile`** (the filename).  
   Do **not** leave it empty and do **not** put `npm start` here.  
   This makes Render use the `Dockerfile` in the repo root so the build succeeds.

3. **Root Directory:** leave empty.

4. Save and deploy. The repo’s `Dockerfile` will be used and the app will run.

---

If you prefer Native Environment instead of Docker:

- Set **Environment** to **Native Environment**.
- **Build command:** `npm install`
- **Start command:** `npm start`
- Clear any **Dockerfile path** (or leave it blank).
- Save (and re-check after the next deploy in case it reverts).
