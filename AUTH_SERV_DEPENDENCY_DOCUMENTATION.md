# reSide Strict Dependency on auth_serv — Comprehensive Documentation

This document provides a detailed breakdown of **What**, **Why**, and **Where** (including exact file paths and line numbers) all changes were implemented to make **reSide** strictly dependent on the **`auth_serv`** authentication microservice.

---

## 1. Executive Summary

### The Requirement
reSide must be strictly dependent on the availability of the external authentication microservice `auth_serv` running at `http://localhost:3004`. If `auth_serv` is not running, cannot be reached, or fails availability verification:
1. reSide must display a dedicated, responsive, full-screen offline screen (`ServerOfflineScreen`).
2. The user must be completely blocked from viewing or interacting with any normal application interface (dashboards, listings, chats, login dialogs, header).
3. No cached tokens, sessionStorage flags, admin bypass mechanisms, or URL parameters may defeat this gate.
4. The gate must enforce availability both at application startup and dynamically during runtime if `auth_serv` disconnects mid-session.
5. In accordance with strict constraints, **no code, configuration, or files belonging to `auth_serv` were touched or modified**.

---

## 2. Detailed Breakdown: What, Why & Where (File and Line Numbers)

---

### A. [`frontend/src/services/authServiceAvailability.ts`](file:///c:/ReSide/reSideAI/frontend/src/services/authServiceAvailability.ts) *(New File)*

- **Action:** Created dedicated, reusable service-availability checking module.
- **Total Lines:** 233 lines.

#### What was done:
- **Lines 12–33:** Exported TypeScript interfaces `AuthServiceDetails`, `AuthServiceStatus`, and `AvailabilityCheckOptions`.
- **Lines 35–37:** Defined default timeout (`5000ms`), local fallback URL (`http://localhost:3004`), and development proxy path (`/auth-service-proxy`).
- **Lines 42–48 (`getAuthServiceBaseUrl`):** Reads the auth service URL dynamically from `import.meta.env.VITE_AUTH_SERVICE_URL`, defaulting to `http://localhost:3004`.
- **Lines 53–67 (`isAuthServiceSpec`):** Inspects the returned payload to guarantee it is legitimate `auth_serv` Swagger OpenAPI spec (`info.title === "Auth Service API"` and auth endpoints exist).
- **Lines 72–119 (`attemptFetch`):** Implements fetch with `AbortController` timeout management (default 5000ms) and external signal forwarding to prevent hanging requests.
- **Lines 129–232 (`checkAuthServiceAvailability`):**
  - **Lines 139–175:** Performs direct fetch to `${baseUrl}/docs-json`. If successful, verifies spec and returns `{ isAvailable: true }`. Handles 401/403 as reachable.
  - **Lines 176–188:** Catches abort signals and network errors.
  - **Lines 190–225:** If direct fetch fails in a browser environment due to CORS restrictions, automatically checks via the local Vite dev proxy (`/auth-service-proxy/docs-json`). Correctly identifies 502/504 as offline.
  - **Lines 227–232:** Returns clean offline status and concise message if both direct and proxy attempts fail.

#### Why it was done:
- `auth_serv` has no public `/health` endpoint (returns 404), and `/auth-service-admin/me` requires super-admin JWT credentials. The public Swagger OpenAPI endpoint (`/docs-json`) is safe, unauthenticated, documented, transmits no passwords or secrets, and uniquely identifies `auth_serv`.
- Handles connection timeouts and browser CORS restrictions gracefully without changing `auth_serv`.

---

### B. [`frontend/src/contexts/AuthServiceContext.tsx`](file:///c:/ReSide/reSideAI/frontend/src/contexts/AuthServiceContext.tsx) *(New File)*

- **Action:** Created application-level state provider and lifecycle manager for service availability.
- **Total Lines:** 196 lines.

#### What was done:
- **Lines 16–27:** Defined `AuthServiceGateStatus` type (`'checking' | 'online' | 'offline'`) and `AuthServiceContextType` interface.
- **Lines 32–39 (`getPollInterval`):** Reads `VITE_AUTH_SERVICE_POLL_INTERVAL` (default: 15,000ms / 15s).
- **Lines 41–55:** Initialized state: `status` (starts at `'checking'`), `isAvailable`, `isChecking`, `isRetrying`, `lastChecked`, and `errorMessage`. Created concurrency control refs (`inFlightRef`, `abortControllerRef`, `lastCheckTimeRef`, `isMountedRef`).
- **Lines 57–120 (`performCheck`):**
  - Prevents overlapping checks (`if (inFlightRef.current) return`).
  - Aborts previous in-flight requests via `AbortController`.
  - Invokes `checkAuthServiceAvailability`.
  - Sets `status` to `'online'` or `'offline'` and updates timestamps.
- **Lines 122–124 (`retry`):** Manual retry trigger invoked by the "Retry Connection" button.
- **Lines 127–138 (`useEffect` - Startup):** Executes initial check before exposing application views; cancels requests on unmount.
- **Lines 141–150 (`useEffect` - Periodic Polling):** Periodically rechecks health every 15s to detect runtime service drops.
- **Lines 153–173 (`useEffect` - Window Focus & Online Events):** Rechecks availability when window regains focus (throttled to at most once per 5 seconds) or when network comes online.
- **Lines 189–195 (`useAuthServiceGate`):** Custom hook for consuming availability status in gate and screen components.

#### Why it was done:
- Centralizes availability state across the entire application.
- Guarantees reSide detects when `auth_serv` terminates after startup or recovers.
- Prevents request spamming, overlapping checks, and memory leaks.

---

### C. [`frontend/src/components/AuthServiceGate.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthServiceGate.tsx) *(New File)*

- **Action:** Created centralized gate component wrapping application children.
- **Total Lines:** 37 lines.

#### What was done:
- **Lines 24–36 (`AuthServiceGate`):**
  - **Lines 27–29:** If `status === 'checking'`, renders `<AuthServiceCheckingScreen />`.
  - **Lines 31–33:** If `status === 'offline'`, renders `<ServerOfflineScreen />`.
  - **Line 35:** If `status === 'online'`, renders `{children}` (the normal application).

#### Why it was done:
- Provides an absolute barrier: when offline or checking, normal reSide components (`AppContent`, `Header`, `PropertyListings`, `AdminDashboard`, `FloatingChat`, `LoginPage`) are **never mounted or rendered in the DOM**.
- Prevents cached tokens, session storage, URL params, or admin bypass flags from displaying any UI while `auth_serv` is down.

---

### D. [`frontend/src/components/ServerOfflineScreen.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/ServerOfflineScreen.tsx) *(New File)*

- **Action:** Created dedicated full-screen offline error screen matching all prompt specifications.
- **Total Lines:** 136 lines.

#### What was done:
- **Lines 14–25 (`handleRetry`):** Triggers immediate recheck on click; displays a user-friendly error notice if retry fails.
- **Lines 28–32:** Responsive, accessible full-screen container with theme support (`dark` & `light`) via `next-themes`.
- **Lines 43–51:** Red/destructive pulsing badge: **`Status: Connection unavailable`** (`நிலை: இணைப்பு கிடைக்கவில்லை`).
- **Lines 53–60:** Required title and message:
  - **Title:** **`Authentication Server Offline`** (`அங்கீகார சேவையகம் ஆஃப்லைனில் உள்ளது`)
  - **Message:** **`We cannot connect to the authentication server right now. Please ensure that auth_serv is running before accessing reSide.`**
- **Lines 63–80:** Diagnostic panel:
  - **Required service:** `auth_serv`
  - **Service endpoint:** `${serviceUrl}` (e.g. `http://localhost:3004`)
  - **Last checked:** timestamp.
- **Lines 82–89:** Concise retry failure alert if connection retry fails (no internal stack traces or secrets leaked).
- **Lines 91–105:** Security policy banner explaining why `auth_serv` is strictly required.
- **Lines 107–123:** **`Retry Connection`** primary button with spinning refresh icon and disabled state while checking.
- **Lines 125–131:** Background auto-recheck indicator.

#### Why it was done:
- Satisfies all display and behavioral requirements for the server-offline screen.
- Includes bilingual English and Tamil support consistent with the reSide design system.

---

### E. [`frontend/src/components/AuthServiceCheckingScreen.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthServiceCheckingScreen.tsx) *(New File)*

- **Action:** Created loading screen for the initial startup check.
- **Total Lines:** 30 lines.

#### What was done:
- **Lines 7–27:** Displays spinner, reSide logo, and message: *"Verifying Authentication Service... Connecting to auth_serv before initializing application..."*.

#### Why it was done:
- Prevents UI flashing or partial rendering of dashboards, chat, or property listings before the initial check completes.

---

### F. [`frontend/src/App.tsx`](file:///c:/ReSide/reSideAI/frontend/src/App.tsx) *(Modified)*

#### Lines Modified:
- **Lines 32–33:** Added imports:
  ```tsx
  import { AuthServiceAvailabilityProvider } from './contexts/AuthServiceContext';
  import AuthServiceGate from './components/AuthServiceGate';
  ```
- **Lines 715–725 (`export default function App()`):**
  Wrapped the application root with `AuthServiceAvailabilityProvider` and `AuthServiceGate`:
  ```tsx
  export default function App() {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LanguageProvider>
          <AuthServiceAvailabilityProvider>
            <AuthServiceGate>
              <PropertyProvider>
                <AIProvider>
                  <AppContent />
                  <Toaster />
                </AIProvider>
              </PropertyProvider>
            </AuthServiceGate>
          </AuthServiceAvailabilityProvider>
        </LanguageProvider>
      </ThemeProvider>
    );
  }
  ```

#### Why it was done:
- Ensures the availability gate sits above `PropertyProvider`, `AIProvider`, and `AppContent`.
- Places `LanguageProvider` and `ThemeProvider` above the gate so `ServerOfflineScreen` and `AuthServiceCheckingScreen` have full bilingual and dark-mode styling support.

---

### G. [`frontend/vite.config.js`](file:///c:/ReSide/reSideAI/frontend/vite.config.js) *(Modified)*

#### Lines Modified:
- **Lines 3, 5–7:** Added `loadEnv` from `'vite'` and resolved `authServiceTarget`:
  ```javascript
  const env = loadEnv(mode, process.cwd(), '');
  const authServiceTarget = env.VITE_AUTH_SERVICE_URL || 'http://localhost:3004';
  ```
- **Lines 25–29:** Added development server proxy for `auth_serv`:
  ```javascript
  '/auth-service-proxy': {
      target: authServiceTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/auth-service-proxy/, '')
  }
  ```

#### Why it was done:
- Direct browser calls from `http://localhost:3000` to `http://localhost:3004` fail due to `auth_serv`'s strict CORS rules (`Origin not allowed by CORS`).
- Under the constraint of **never modifying `auth_serv`**, the Vite development proxy forwards requests over local TCP with rewritten origin headers, resolving browser CORS restrictions cleanly.

---

### H. [`frontend/package.json`](file:///c:/ReSide/reSideAI/frontend/package.json) *(Modified)*

#### Lines Modified:
- **Line 13:** Added test script:
  ```json
  "test:auth-gate": "node scripts/test-auth-service-gate.mjs"
  ```

#### Why it was done:
- Enables quick, repeatable verification of all 13 required test scenarios via `npm run test:auth-gate`.

---

### I. [`frontend/.env.example`](file:///c:/ReSide/reSideAI/frontend/.env.example) & [`frontend/.env`](file:///c:/ReSide/reSideAI/frontend/.env) *(New Files)*

- **Action:** Created environment configuration files.
- **Lines:**
  ```bash
  VITE_AUTH_SERVICE_URL=http://localhost:3004
  VITE_AUTH_SERVICE_POLL_INTERVAL=15000
  ```

#### Why it was done:
- Configures `VITE_AUTH_SERVICE_URL` without hardcoding `http://localhost:3004` throughout the codebase.
- Allows configuration of the background polling frequency.

---

### J. [`frontend/LOCAL_DEV.md`](file:///c:/ReSide/reSideAI/frontend/LOCAL_DEV.md) *(Modified)*

#### What was done:
- **Lines 1–117:** Completely updated the local development guide.
  - Documented the three services (`auth_serv:3004`, `reSide server:5000`, `reSide frontend:3000`).
  - Added environment variable documentation and explained `localhost` browser scope.
  - Documented `auth_serv` CORS restrictions and the dev proxy solution.
  - Documented startup order, runtime disconnect behavior, and test commands.

---

### K. [`frontend/scripts/test-auth-service-gate.mjs`](file:///c:/ReSide/reSideAI/frontend/scripts/test-auth-service-gate.mjs) *(New File)*

- **Action:** Created test runner verifying all 13 test scenarios specified in the requirements.
- **Total Lines:** 279 lines.

#### Scenarios Verified:
1. **Service online at startup:** Verifies `/docs-json` via dev proxy returns 200 and spec title `"Auth Service API"`.
2. **Service offline at startup:** Verifies unreachable port fails and transitions to offline.
3. **Retry succeeds:** Verifies retry against live service restores online status.
4. **Retry fails:** Verifies retry against dead port remains offline without crash.
5. **Runtime disconnection:** Simulates abrupt service shutdown and verifies immediate offline detection.
6. **Runtime recovery:** Simulates service restarting and verifies online restoration.
7. **Cached session immunity:** Verifies cached `localStorage` token cannot bypass offline gate.
8. **Admin bypass immunity:** Verifies `sessionStorage` admin token cannot defeat gate.
9. **Temporary network failure / timeout:** Verifies `AbortController` handles slow/hung networks safely.
10. **CORS diagnostic handling:** Verifies direct CORS rejection (HTTP 500) and proxy resolution.
11. **Authentication separation:** Verifies reachable service does not automatically log in or grant admin rights to user.
12. **Existing features:** Verifies backend Express properties API on port 5000 remains operational.
13. **Direct backend access assessment:** Verifies unauthenticated calls to `/api/auth/me` are rejected with HTTP 401.

---

## 3. Summary Table

| File | Lines | Type of Change | What was done | Why it was done |
| :--- | :--- | :--- | :--- | :--- |
| [`frontend/src/services/authServiceAvailability.ts`](file:///c:/ReSide/reSideAI/frontend/src/services/authServiceAvailability.ts) | 1–233 | **Created** | Endpoint reachability checker with timeout and CORS fallback | Verify `auth_serv` via Swagger OpenAPI spec without credentials or secrets |
| [`frontend/src/contexts/AuthServiceContext.tsx`](file:///c:/ReSide/reSideAI/frontend/src/contexts/AuthServiceContext.tsx) | 1–196 | **Created** | Lifecycle context provider with periodic polling & focus listeners | Track `checking` / `online` / `offline` states and detect mid-session drops |
| [`frontend/src/components/AuthServiceGate.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthServiceGate.tsx) | 1–37 | **Created** | Central application gate component | Completely unmount normal application when `auth_serv` is offline |
| [`frontend/src/components/ServerOfflineScreen.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/ServerOfflineScreen.tsx) | 1–136 | **Created** | Full-screen offline screen with "Retry Connection" button | Display required status, service name, and retry action with bilingual support |
| [`frontend/src/components/AuthServiceCheckingScreen.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthServiceCheckingScreen.tsx) | 1–30 | **Created** | Initial loading screen component | Prevent UI flashing before initial availability check finishes |
| [`frontend/src/App.tsx`](file:///c:/ReSide/reSideAI/frontend/src/App.tsx) | 32–33, 715–725 | **Modified** | Imported and wrapped root with provider and gate | Enforce gate at the highest level of the application hierarchy |
| [`frontend/vite.config.js`](file:///c:/ReSide/reSideAI/frontend/vite.config.js) | 3, 5–7, 25–29 | **Modified** | Added `/auth-service-proxy` to Vite dev server | Bypass browser CORS restrictions on `http://localhost:3004` without modifying `auth_serv` |
| [`frontend/package.json`](file:///c:/ReSide/reSideAI/frontend/package.json) | 13 | **Modified** | Added `"test:auth-gate"` npm script | Allow single-command test execution (`npm run test:auth-gate`) |
| [`frontend/.env.example`](file:///c:/ReSide/reSideAI/frontend/.env.example) | 1–11 | **Created** | Environment variable example file | Document `VITE_AUTH_SERVICE_URL` and `VITE_AUTH_SERVICE_POLL_INTERVAL` |
| [`frontend/.env`](file:///c:/ReSide/reSideAI/frontend/.env) | 1–4 | **Created** | Local environment configuration | Set local defaults pointing to `http://localhost:3004` |
| [`frontend/LOCAL_DEV.md`](file:///c:/ReSide/reSideAI/frontend/LOCAL_DEV.md) | 1–117 | **Modified** | Comprehensive local dev instructions | Document services, CORS proxy, and testing steps |
| [`frontend/scripts/test-auth-service-gate.mjs`](file:///c:/ReSide/reSideAI/frontend/scripts/test-auth-service-gate.mjs) | 1–279 | **Created** | Automated test suite for all 13 scenarios | Prove implementation meets all requirements with 0 failures |

---

## 4. Verification Results

All tests and compilation checks have been executed and passed:

1. **Gate Test Suite:**
   ```bash
   npm run test:auth-gate
   # Output: 18 passed, 0 failed across all 13 scenarios
   ```
2. **TypeScript Compilation Check:**
   ```bash
   npm run typescript-check
   # Output: Exit code 0 (zero errors)
   ```
3. **Production Bundle Build:**
   ```bash
   npm run build
   # Output: Built successfully in 22.95s
   ```

---

## 5. Troubleshooting Note on Port 5000 (`EADDRINUSE`)

If running `npm start` in `c:\ReSide\reSideAI\server` displays:
```text
Port 5000 is already in use. Stop the other server and restart this backend.
```
This indicates that the reSide Express backend server is already running in the background.

To stop the stale process and restart:
```powershell
# 1. Find the process using port 5000
netstat -ano | findstr :5000

# 2. Terminate the process by PID
taskkill /PID <PID_NUMBER> /F

# 3. Restart the server
npm start
```
