# No cars showing — checklist

The **key is valid** (run `node scripts/test-autodev-key.js` to confirm). If the site still shows no cars:

## 1. Use the server that has the new code

The app uses **Auto.dev** only when the **current** Node server was started **after** the Auto.dev integration was added. An old process on port 1554 may still be running the previous code.

- **Stop** any existing Node server (e.g. close the terminal that ran `node server.js`, or stop the process using port 1554).
- **Start** the server again from the project folder:
  ```bash
  node server.js
  ```
- Default port is **1554** (from `.env`). You should see: `AutoElite v2.0 is live at http://localhost:1554`.

## 2. Open the same origin in the browser

- Open: **http://localhost:1554** (or **http://127.0.0.1:1554**).
- Do **not** open the site from a different host/port than the one where the API runs, or the frontend may call the wrong API and get no data.

## 3. Hard refresh

- Press **Ctrl+F5** (or Cmd+Shift+R on Mac) so the browser loads the latest HTML/JS and doesn’t use cache.

## 4. Check the browser console

- Press **F12** → **Console**.
- You should see: `[ND] app.js LOADED: http://localhost:1554/`
- If you see red errors (e.g. failed to fetch, or a script error), the cars may not render. Fix or report that error.

## 5. Confirm the API returns cars

- In the browser, open: **http://localhost:1554/api/home-feed?nocache=1**
- You should see JSON with `"source": "autodev"` and a `rails` object with `editorPicks`, etc. If you see `"source": "demo"` and you expect Auto.dev, the server is likely the old one or `AUTO_DEV_API_KEY` is missing in `.env`.

## Summary

| Issue | What to do |
|-------|------------|
| Key invalid | Get a new key from https://auto.dev/signin and set `AUTO_DEV_API_KEY` in `.env`. |
| Wrong server | Stop old process, start `node server.js` again, then open http://localhost:1554. |
| Wrong URL | Open the site on the same host/port as the API (e.g. localhost:1554). |
| Cached page | Hard refresh (Ctrl+F5). |
| JS error | Check F12 → Console and fix the reported error. |
