# PORT and EADDRINUSE on Windows

The server reads the port from the environment:

```bash
const PORT = Number(process.env.PORT || 1444)
```

Set a different port via `.env` (`PORT=1444`) or at run time (e.g. PowerShell: `$env:PORT="1444"; node server.js`).

## EADDRINUSE (address already in use)

This means another process is already listening on that port (e.g. a previous Node server or another app).

**Find what is using the port (e.g. 1444):**

```powershell
netstat -ano | findstr :1444
```

You will see a line with `LISTENING` and a PID (last column).

**Stop that process:**

```powershell
taskkill /PID <pid> /F
```

Example: if PID is `12345`:

```powershell
taskkill /PID 12345 /F
```

Then start the server again. Changing `PORT` in `.env` (e.g. to `1445`) is an alternative so this app uses a different port.
