# AI City — Backend Milestone 1

Full-stack Node.js, Express, WebSocket, and Three.js application representing an autonomous multi-agent simulation.

## Architecture

- **Backend (`/server`)**:
  - Express HTTP server running on port `3000`.
  - Native WebSocket server on `/ws` using `ws`.
  - Vite dev server middleware integration in development mode (`NODE_ENV !== 'production'`).
  - Production static asset serving in `NODE_ENV === 'production'`.
  - Endpoints:
    - `GET /api/health`: Server health check, uptime, active connections, and store metrics.
    - `GET /api/tasks`: Retrieve authoritative tasks list.
    - `POST /api/tasks`: Validate and queue a new task (`{ district, text, fail }`), generate UUID, and broadcast `task.created` to all WebSocket clients.
- **Frontend (`/index.html`)**:
  - Three.js r128 3D city scene with 42 agents and 7 functional districts.
  - Event-driven state machine (`ingest`, `apply`, `store`).
  - Safe WebSocket client (`connect()`) with automatic protocol detection (`ws:` / `wss:`) and exponential reconnect.
  - Graceful fallback: If backend is unavailable, the UI automatically falls back to client-side simulation (`run()`) and localStorage.
- **Cloud Realtime (`/src/supabase.ts`)**:
  - Outbound/inbound synchronization on Supabase Realtime channel `ai-city-realtime`.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (Express + Vite on http://0.0.0.0:3000)
npm run dev

# Run automated backend test suite
npm test

# Build production assets
npm run build

# Start production server
npm run start
```

## Environment Variables

Defined in `.env.example`:
- `PORT`: Port to listen on (default `3000`).
- `NODE_ENV`: `development` | `production` | `test`.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public API key.
