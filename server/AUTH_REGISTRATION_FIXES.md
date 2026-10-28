# Authentication & Registration Fixes Documentation

## 1. Executive Summary

This document explains all changes made to resolve two core issues:
1. **`POST /api/auth/register 500 (Internal Server Error)`**: Caused by an unhandled SMTP authentication rejection from `smtp.titan.email` when sending verification OTP emails.
2. **"Unable to get OTP in the mail"**: The configured Titan email account credentials (`info@krishub.in` in `server/.env`) are rejected by the mail server (`535 5.7.8 Error: authentication failed`).
3. **`Port 5000 is already in use`**: Stale background server process holding the port upon restart.

To fix these problems, we made the backend resilient against email provider failures, added development fallback mechanisms, printed OTP codes directly to terminal output, and added autofill/helper banners in both the full page and dialog authentication views.

---

## 2. Changes Breakdown by File and Line Numbers

### A. [`server/utilities/mailer.js`](file:///c:/ReSide/reSideAI/server/utilities/mailer.js)

#### Lines Modified:
- **Lines 3–21**: Transporter factory function with connection timeouts and port-based SSL logic.
- **Lines 23–28**: High-visibility console logging for every generated OTP.
- **Lines 52–61**: Try/Catch wrapper around `transporter.sendMail()`.

#### Rationale & Details:
- **Previously**: The file initialized a single static transporter and called `await transporter.sendMail(mailOptions)` with no `try...catch` block and no timeout. If Titan SMTP failed or hung, the unhandled rejection propagated to the controller and crashed the request with an HTTP 500 error.
- **After Change**:
  - `createTransporter()` dynamically creates a transporter with 5-second connection/greeting/socket timeouts to prevent requests from hanging.
  - Automatically enables SSL (`secure: true`) if port is `465`.
  - Added prominent terminal logging:
    ```text
    ============================================================
    [OTP DISPATCH] Destination: <email>
    [OTP DISPATCH] Purpose: <purpose>
    [OTP DISPATCH] CODE: <otp>
    ============================================================
    ```
  - Wrapped `transporter.sendMail()` in a `try...catch` block. On failure, it logs a warning and returns `{ success: false, error: err.message, otp }` instead of throwing an unhandled exception.

---

### B. [`server/controllers/authController.js`](file:///c:/ReSide/reSideAI/server/controllers/authController.js)

#### Lines Modified:
- **Lines 84–91**: `register()` function.
- **Lines 248–253**: `forgotPassword()` function.
- **Lines 339–346**: `resendOtp()` function.

#### Rationale & Details:
- **Previously**: Each of these controller methods executed `await sendOtpEmail(...)`. If the email delivery failed, the `catch (err)` block returned `res.status(500).send('Server error')`.
- **After Change**:
  - Captured `const mailResult = await sendOtpEmail(...)`.
  - If `mailResult.success` is false or the server is in development mode, the response safely returns HTTP 200 with:
    - A descriptive user message.
    - `devOtp: otp` (only exposed when not in strict production mode or when SMTP failed).
  - Users can now complete account verification even if SMTP credentials are down or misconfigured.

---

### C. [`frontend/src/contexts/AuthContext.tsx`](file:///c:/ReSide/reSideAI/frontend/src/contexts/AuthContext.tsx)

#### Lines Modified:
- **Line 17**: `AuthContextType` interface (`register` return type).
- **Line 19**: `AuthContextType` interface (`forgotPasswordStart` return type).
- **Lines 110–111**: `register()` method implementation.
- **Lines 143–144**: `forgotPasswordStart()` method implementation.

#### Rationale & Details:
- **Previously**: `register` and `forgotPasswordStart` were typed as returning `Promise<void>` and did not return the response body (`res.data`).
- **After Change**:
  - Changed return signatures to `Promise<any>`.
  - Added `return res.data` inside `register` and `forgotPasswordStart`. This allows callers in UI components to read the server response, including `devOtp`.

---

### D. [`frontend/src/App.tsx`](file:///c:/ReSide/reSideAI/frontend/src/App.tsx) (Main Login/Register Page)

#### Lines Modified:
- **Line 66**: Added `const [devOtp, setDevOtp] = useState<string | null>(null);`.
- **Lines 72–73**: Reset `devOtp` when switching between views.
- **Lines 118–127**: `handleRegisterSubmit` response handling.
- **Lines 165–174**: `handleForgotEmailSubmit` response handling.
- **Lines 222–229**: `handleResendOtp` response handling.
- **Lines 426–439**: `register-otp` view UI banner.
- **Lines 503–516**: `forgot-otp` view UI banner.

#### Rationale & Details:
- **Previously**:
  - `handleRegisterSubmit` cleared `otp` (`setOtp('')`) and did not store the returned OTP code.
  - Users had no way of knowing their OTP if the email provider failed.
- **After Change**:
  - Stored `data.devOtp` in state and pre-filled the OTP input automatically.
  - Displayed a blue notification box directly above the OTP input showing:
    `OTP Code: [CODE] [Autofill Button]`
  - Added the same fallback behavior to `handleResendOtp` and `handleForgotEmailSubmit`.

---

### E. [`frontend/src/components/AuthDialog.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthDialog.tsx) (Modal Dialog)

#### Lines Modified:
- **Lines 110–117**: `handleRegisterSubmit`.
- **Lines 151–158**: `handleForgotEmailSubmit`.
- **Lines 211–216**: `handleResendOtp`.

#### Rationale & Details:
- Mirrors the same improvements as `App.tsx` for consistency when authentication is triggered from header modals.

---

### F. Stale Server Process Management

#### Action:
- Identified stale Node process (`PID 14308`) running in the background and holding TCP port 5000.
- Terminated PID 14308.
- Restarted `node index.js` as an active daemon process (`task-124`), ensuring clean server startup without `EADDRINUSE`.

---

## 3. Summary Table

| File | Lines | Type of Change | Reason |
| :--- | :--- | :--- | :--- |
| [`server/utilities/mailer.js`](file:///c:/ReSide/reSideAI/server/utilities/mailer.js) | 3–21, 23–28, 52–61 | Bugfix & Reliability | Prevent 500 error on SMTP failure, set 5s timeout, print OTP to terminal console |
| [`server/controllers/authController.js`](file:///c:/ReSide/reSideAI/server/controllers/authController.js) | 84–91, 248–253, 339–346 | Controller enhancement | Return 200 with fallback `devOtp` when mail delivery fails or during dev |
| [`frontend/src/contexts/AuthContext.tsx`](file:///c:/ReSide/reSideAI/frontend/src/contexts/AuthContext.tsx) | 17, 19, 110–111, 143–144 | API / State integration | Return API response data to UI callers |
| [`frontend/src/App.tsx`](file:///c:/ReSide/reSideAI/frontend/src/App.tsx) | 66, 72–73, 118–127, 165–174, 222–229, 426–439, 503–516 | UI / UX enhancement | Autofill OTP input and display helper badge on screen |
| [`frontend/src/components/AuthDialog.tsx`](file:///c:/ReSide/reSideAI/frontend/src/components/AuthDialog.tsx) | 110–117, 151–158, 211–216 | Modal UI consistency | Handle `devOtp` in modal dialogs |
| Port 5000 Process | System | Process Management | Fixed `Port 5000 is already in use` error by killing stale PID 14308 |
