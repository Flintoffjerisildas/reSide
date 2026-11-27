# reSide Local Development Guide

This guide explains how to configure, run, and test reSide locally.

---

## 1. Architecture Overview & Required Services

The frontend login, registration, OTP, and application API are served by the reSide Express backend on port 5000. `auth_serv` on port 3004 is a separate authentication microservice used by the application's availability gate; it is not the reSide API server, and `VITE_AUTH_SERVICE_URL` must continue to point to it when that microservice is part of the deployment.

The local development ecosystem consists of three services:

| Service | Port | Description |
| :--- | :--- | :--- |
| **`auth_serv`** | `http://localhost:3004` | NestJS + Prisma + PostgreSQL authentication microservice. Provides Swagger documentation at `http://localhost:3004/docs` and OpenAPI JSON at `/docs-json`. |
| **`reSide Server`** | `http://localhost:5000` | Node.js + Express + MongoDB backend API for properties, requests, agreements, and profiles. |
| **`reSide Frontend`** | `http://localhost:3000` | React + TypeScript + Vite frontend with Tailwind CSS and TanStack Query. |

---

## 2. Environment Configuration

### Frontend Variables (`frontend/.env`)

Create or update `frontend/.env` (reference `frontend/.env.example`):

```bash
# Base URL for the external authentication microservice
# Default for local development: http://localhost:3004
VITE_AUTH_SERVICE_URL=http://localhost:3004

# Periodic polling interval (in ms) to monitor auth_serv connectivity while reSide is open
# Default: 15000 (15 seconds)
VITE_AUTH_SERVICE_POLL_INTERVAL=15000

# Optional backend URL override. Leave unset for local development and VS Code
# port forwarding so the same-origin Vite proxy handles backend API requests.
# VITE_API_URL=
# Optional Socket.IO override; defaults to VITE_API_URL or the current origin.
# VITE_SOCKET_URL=
```

> **Important Note Regarding `localhost`:**
> `localhost` in the Vite proxy target refers to the machine running the development server. Browser API and Socket.IO requests use the frontend's origin, so they also work when the frontend is opened through a VS Code forwarded URL. The auth-service proxy target must be reachable from the Vite server. For deployed environments, use publicly reachable service URLs or a same-origin reverse proxy.

---

## 3. Browser CORS Policy & Dev Proxy

`auth_serv` enforces strict Cross-Origin Resource Sharing (CORS) rules. Direct browser requests from `http://localhost:3000` to `http://localhost:3004` are rejected by the authentication server with HTTP 500 (`Origin not allowed by CORS`).

To adhere to the requirement of **never modifying `auth_serv` source code or configuration**, reSide resolves browser CORS restrictions as follows:

1. **Local Development Proxies**:
   The Vite dev server (`vite.config.js`) proxies `/api` and `/socket.io` to the reSide backend on port 5000, and `/auth-service-proxy` to the separate auth service configured by `VITE_AUTH_SERVICE_URL`. Browser API and Socket.IO requests therefore stay on the frontend's origin, including when accessed through VS Code port forwarding.

2. **Availability Check Fallback**:
   The availability module (`frontend/src/services/authServiceAvailability.ts`) tests direct connection first, and if direct browser fetch encounters CORS blocking, automatically verifies connectivity through the local dev proxy.

3. **Production Deployment Recommendation**:
   In deployed environments, place both reSide and `auth_serv` behind a reverse proxy (e.g., Nginx, Envoy, or AWS ALB) sharing the same domain (e.g. `/api/auth` -> `auth_serv`), or configure the auth service's allowed origins in its own deployment configuration.

---

## 4. Availability Check & Application Gate Workflow

1. **Checking Phase**:
   Upon initial app load, `AuthServiceGate` displays `AuthServiceCheckingScreen`. No dashboards, property listings, chat widgets, or authentication dialogs are mounted or exposed in the DOM.

2. **Service Offline Phase**:
   If `auth_serv` cannot be reached or returns an error, `ServerOfflineScreen` is rendered.
   - Shows status: *Connection unavailable*
   - Shows required service: *auth_serv*
   - Primary action: **Retry Connection** button
   - Clicking *Retry Connection* executes an immediate check with a spinner.
   - Cached tokens, sessionStorage items, URL hash secrets, or admin bypass flags **cannot** defeat the offline screen.

3. **Service Online Phase**:
   Once `auth_serv` availability succeeds:
   - reSide proceeds to its normal initialization and role checks.
   - Legitimate session tokens in `localStorage` are verified via `/auth/me`.
   - Role requirements (Super Admin, Owner, Broker, Customer) and pending approval checks are enforced normally.
   - Service availability does **not** grant automatic user authentication.

4. **Runtime Disconnection Detection**:
   - Background polling re-verifies availability every 15 seconds (configurable).
   - Window focus listeners immediately recheck availability when switching tabs.
   - If `auth_serv` terminates while reSide is in use, the application immediately unmounts the workspace and transitions to the blocking offline screen.

---

## 5. Starting the Applications

### Step 1: Start `auth_serv`
```bash
cd /path/to/auth_serv
npm run start
# Service will listen on http://localhost:3004
```

### Step 2: Start reSide Backend Server
```bash
cd reSideAI/server
npm run start
# Server will listen on http://localhost:5000
```

### Step 3: Start reSide Frontend
```bash
cd reSideAI/frontend
npm run start
# Frontend will listen on http://localhost:3000
```

When using VS Code port forwarding, forward port 3000 and open the forwarded frontend URL. Keep `VITE_API_URL` unset so the Vite proxy sends `/api` and `/socket.io` requests to port 5000. The backend binds to `0.0.0.0`; browser-side requests do not need a `localhost:5000` URL.

---

## 6. Verification and Testing

1. **Test Backend API**: With the reSide backend running, open `http://localhost:3000/api/system-status`. It should return system-status JSON; use the same path on the forwarded frontend URL in VS Code.
2. **Test Online State**: Ensure `auth_serv` is running on port 3004. Open the frontend. The initial auth service availability check succeeds and the application loads normally.
3. **Test Offline State**: Stop `auth_serv`. Open or refresh the frontend. `ServerOfflineScreen` blocks all content.
4. **Test Retry Flow**: With `auth_serv` stopped, click **Retry Connection**; observe the concise error notice. Start `auth_serv`, click **Retry Connection**; observe instant recovery into reSide.
5. **Test Mid-Session Disconnect**: With reSide running and logged in, stop `auth_serv`. Within the configured polling interval, reSide transitions automatically to the offline screen.
