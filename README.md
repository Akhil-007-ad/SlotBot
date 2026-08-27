# SlotBot

SlotBot is a Microsoft Entra-authenticated meeting-room booking portal. It uses a React/Vite frontend, an Express API, MongoDB through Mongoose, and optional Microsoft Graph synchronization for Outlook/Teams meetings.

## Local development

Requirements: Node.js 22+, npm, MongoDB, and two Microsoft Entra app registrations (SPA and API).

1. Copy `backend/.env.example` to `backend/.env` and enter the backend values.
2. Copy `frontend/.env.example` to `frontend/.env` and enter the SPA values.
3. In `backend`, run `npm ci`, `npm run seed`, and `npm run dev`.
4. In `frontend`, run `npm ci` and `npm run dev`.
5. Open `http://localhost:5173`.

## Production configuration

### Microsoft Entra

Configure the SPA app registration with the exact HTTPS production URL as a **Single-page application** redirect URI and logout URL. Configure the API app registration to expose `access_as_user`, then grant that delegated scope to the SPA.

Frontend build variables:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE` | Public HTTPS API origin, such as `https://api.slotbot.example.com` |
| `VITE_REDIRECT_URI` | Exact public HTTPS frontend URL |
| `VITE_ENTRA_TENANT_ID` | Organization tenant ID |
| `VITE_ENTRA_CLIENT_ID` | SPA app registration client ID |
| `VITE_ENTRA_API_SCOPE` | API scope, normally `api://<api-client-id>/access_as_user` |

Backend runtime variables:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV=production` | Required for production behavior |
| `PORT` | Listening port; defaults to `5001` |
| `MONGODB_URI` | Required; store as a platform secret |
| `FRONTEND_ORIGIN` | Required browser origin; comma-separate multiple exact origins |
| `ENTRA_TENANT_ID` | Required tenant ID |
| `ENTRA_API_CLIENT_ID` | Required API app registration client ID |
| `INITIAL_ADMIN_EMAILS` | Admin bootstrap allowlist; remove after the initial admins have signed in if desired |
| `TRUST_PROXY=true` | Use when the API runs behind one trusted reverse proxy/load balancer |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | Optional API throttling; defaults to 15 minutes/300 requests |
| `JSON_BODY_LIMIT` | Optional JSON body cap; defaults to `100kb` |

For Microsoft 365 synchronization set `MS365_ENABLED=true` and provide `MS_TENANT_ID`, `MS_CLIENT_ID`, and `MS_CLIENT_SECRET`; `MS_TIMEZONE` defaults to `Asia/Kolkata`. Keep the client secret in the deployment platform's secret manager, never in an image or source control. The Graph app needs the permissions used by the configured booking and directory-search flows, with tenant admin consent where Microsoft requires it.

### MongoDB Atlas

- Create a least-privilege database user for SlotBot instead of using an Atlas owner account.
- Permit connections from the deployment platform through Atlas Network Access (a private network is preferred).
- Enable backups and alerts.
- Run `npm run seed` from a one-off backend job before first use; do not run it on every container start.

## Containers

Both applications include production Dockerfiles. Build from their own directories so `.dockerignore` is applied.

```sh
docker build -t slotbot-api ./backend

docker build -t slotbot-web \
  --build-arg VITE_API_BASE=https://api.slotbot.example.com \
  --build-arg VITE_REDIRECT_URI=https://slotbot.example.com \
  --build-arg VITE_ENTRA_TENANT_ID=<tenant-id> \
  --build-arg VITE_ENTRA_CLIENT_ID=<spa-client-id> \
  --build-arg VITE_ENTRA_API_SCOPE=api://<api-client-id>/access_as_user \
  ./frontend
```

Run the API with its environment supplied by the platform. It exposes port `5001`, `/health/live` for liveness, and `/health/ready` for readiness. The web image exposes port `8080`, serves the SPA with route fallback, and exposes `/health`.

Always terminate TLS at the platform ingress or load balancer. Do not expose MongoDB or the API container's internal port directly to the internet without that managed ingress.

## Render backend and Vercel frontend

The repository includes `render.yaml` for the API and `frontend/vercel.json` for the SPA route fallback and response headers.

On Render, create a Blueprint from the repository root. The Blueprint uses `backend` as its root directory, runs `npm ci --omit=dev` and `npm start`, and checks `/health/ready`. Enter every environment variable marked `sync: false` in Render; secret values are intentionally not stored in the Blueprint.

On Vercel, import the same repository and set **Root Directory** to `frontend`. Use the detected Vite preset, `npm run build`, and `dist` output. Add all `VITE_*` values to the Production environment before the first production build.

Deploy Render first. Put its final `https://...onrender.com` or custom-domain URL in Vercel as `VITE_API_BASE`. Deploy Vercel next, then put its final production origin in Render as `FRONTEND_ORIGIN` and redeploy the API. Finally, configure that same Vercel production URL as the Entra SPA redirect and logout URL. Preview deployments need their own exact CORS origin and Entra redirect registration; do not use a broad wildcard for authenticated production traffic.

## Release checklist

1. Build and deploy the API with production secrets.
2. Confirm `/health/ready` returns HTTP 200.
3. Build the frontend with the final public URLs (Vite values are compiled into the bundle).
4. Add the exact frontend URL to Entra SPA redirect URIs and the API `FRONTEND_ORIGIN` allowlist.
5. Sign in as each bootstrapped admin and confirm the Admin tab appears only for admins.
6. Test room visibility, a booking, participant invitations, cancellation, history, and Graph directory search using production-like accounts.
7. Configure centralized container logs, uptime monitoring, alerts, MongoDB backups, and secret rotation.

## Backend layout

`backend/server.js` validates configuration and controls process lifecycle. `backend/app.js` configures HTTP middleware and routes. Requests flow through `routes/` → `middleware/` → `controllers/` → `services/` → `models/`. Conversation handling remains under `chatbot/`.
