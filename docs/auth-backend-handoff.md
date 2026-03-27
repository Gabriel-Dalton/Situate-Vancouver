# Auth UI → backend handoff (sign-in modal)

This document is for whoever implements **server-side authentication** (e.g. Django) so the existing **frontend sign-in UI** can call real APIs instead of the current browser-only preview.

## Current frontend behavior (UI only)

- **Where the UI lives**
  - Component: [`frontend/src/components/SignInHeader.tsx`](../frontend/src/components/SignInHeader.tsx)
  - It is mounted from the insight shell header in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

- **What happens today when the user clicks “Sign in”**
  - A **modal** opens with **email** and **password** fields.
  - On submit, the client runs **basic validation** only (email must look like an email; password non-empty).
  - **No HTTP request** is made to the backend.
  - The email is stored in **`sessionStorage`** under the key **`situate_session_email`** as a **preview** of “signed in” for that browser tab.
  - **Sign out** removes that `sessionStorage` key.

- **Where to wire the backend**
  - In **`SignInHeader.tsx`**, inside **`SignInModal`**, the function **`handleSubmit`** (the `onSubmit` handler of the `<form>`) is the **single integration point** for:
    - Calling your **login** API (or session endpoint).
    - Handling success (tokens / cookies / redirect).
    - Handling errors (show `sign-in-modal__error` with a server message).
  - **Sign out**: replace the preview-only `signOut` in **`SignInHeader`** with a call to your **logout** endpoint if you use server sessions, then clear client state.

## What the backend should expose (recommended contract)

Exact paths and names are up to you; the frontend can be adjusted to match. A typical setup:

### 1. Login

- **Method:** `POST`
- **Suggested path:** `/api/auth/login/` (or your existing API prefix + resource name).
- **Request body (JSON):**

  ```json
  { "email": "user@example.com", "password": "…" }
  ```

  If you prefer **username** instead of email, say so; the UI label can stay “Email” or change to “Username” in one place in `SignInHeader.tsx`.

- **Success response — pick one pattern:**

  **A. Session cookie (common with Django)**

  - Response **`Set-Cookie`** with an **HttpOnly** session cookie (and `Secure` in production, `SameSite` appropriate for your deployment).
  - Response body can be minimal, e.g. `{ "ok": true }` or `{ "user": { "email": "…", "id": "…" } }`.

  **B. JWT (bearer token)**

  - JSON body, e.g. `{ "access": "…", "refresh": "…" }` (or your project’s standard).
  - Frontend stores **`access`** in memory or a safe store per your security review; **avoid** putting long-lived secrets in `localStorage` without a deliberate threat model.

- **Error response**

  - `4xx` with a JSON body the UI can show, e.g. `{ "detail": "Invalid credentials" }` or field errors. The modal can map `detail` or first field error into the existing error line.

### 2. Logout (optional but useful)

- **Method:** `POST`
- **Suggested path:** `/api/auth/logout/`
- Clears server session or invalidates refresh token, as appropriate.

### 3. Current user (“who am I?”) — recommended

- **Method:** `GET`
- **Suggested path:** `/api/auth/me/` (or `/api/users/me/`)
- **Success:** `200` with `{ "email": "…", "id": "…", … }`
- **Unauthenticated:** `401`

This lets the app **restore signed-in state after refresh** instead of relying only on `sessionStorage`.

## CORS, CSRF, and local dev (Vite + Django)

- The Vite dev server often runs on **`http://127.0.0.1:5173`** and proxies **`/api`** to Django (see repo `README.md` and `frontend/vite.config.ts`).
- If auth uses **cookies**:
  - Ensure **CORS** allows the frontend origin if requests are cross-origin **without** the proxy, or keep using **same-origin `/api` via proxy** in dev.
  - Django **CSRF**: follow your framework’s pattern for SPA + cookie session (CSRF token cookie/header, or SameSite strategy). Document whatever the frontend must send on `POST`.

Document the **final base URL** and whether the browser should call **`/api/...`** (proxied) or an absolute URL in each environment.

## Security checklist

- Passwords must never be logged or stored in plaintext on the client.
- Prefer **HttpOnly cookies** for session IDs or short-lived **access tokens** with a clear refresh story.
- Use **HTTPS** in production; set cookie `Secure` appropriately.

## Frontend cleanup when real auth lands

- Replace or remove reliance on **`situate_session_email`** in `sessionStorage` once `/me` (or equivalent) drives the UI.
- Update or remove the modal **footnote** that mentions “backend in progress” in `SignInHeader.tsx`.
- Optionally add **loading** and **disabled** states on the submit button during the login request.

## Quick QA checklist for the backend owner

- [ ] Document exact **login / logout / me** URLs and **request/response** shapes.
- [ ] Confirm **cookie vs JWT** and how the frontend should attach auth on subsequent requests.
- [ ] Confirm **dev** workflow with Vite proxy (`/api`) vs production URLs.
- [ ] Provide a **test user** (or signup flow) for the team.
