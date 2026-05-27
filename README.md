# MedRush Agent Hub

Delivery rider frontend for the MedRush platform. This app is built on the existing portable Preact template and is wired to the current backend contract documented in `server/FRONTEND_API_CONTRACT.md`.

## Setup

```bash
cd portable
npm install
npm run dev
```

Build for production:

```bash
cd portable
npm run build
```

## Environment Variables

Set these before running `npm run dev` or `npm run build`:

- `API_BASE_URL`: Backend base URL. Default: `http://localhost:8000`
- `API_TIMEOUT_MS`: Request timeout in milliseconds. Default: `10000`
- `API_AUTH_HEADER`: Auth header key expected by the backend. Default: `token`
- `ENABLE_MOCK_DATA`: Set to `true` or `1` to allow small mock delivery fallbacks when backend data is unavailable

## Available Routes

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/deliveries`
- `/deliveries/:id`
- `/active`
- `/profile`

## Features Implemented

- Agent login, registration, logout, and local session persistence
- Pending delivery dashboard backed by `GET /api/v1/agent/orders/pending`
- Accept delivery action backed by `POST /api/v1/agent/orders/:order_id/accept`
- Delivery detail pages using live list data plus local cache fallback because a single-delivery endpoint is missing
- Active deliveries view based on accepted delivery cache
- Profile update flow backed by `PATCH /api/v1/agent/account`
- Centralized API client, shared interfaces, loading states, empty states, and error states

## Known Limitations

- No backend profile-read or `me` endpoint, so profile screens start from cached auth payloads
- No assigned-deliveries endpoint after accept, so active runs are stored locally
- No delivery lifecycle endpoints beyond accept, so pickup, in-transit, and delivered actions remain TODO states in the UI
- Pickup pharmacy details are shown only when available in the existing order payload
- Browser requests can fail if backend CORS is not enabled for the frontend origin

## Backend Endpoint Assumptions

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST|PATCH|PUT /api/v1/agent/account`
- `GET /api/v1/agent/orders/pending`
- `POST /api/v1/agent/orders/:order_id/accept`
