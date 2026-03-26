# Tic-Tac-Toe Multiplayer (Nakama + React)

Production-ready multiplayer Tic-Tac-Toe with server-authoritative gameplay using Nakama and a React frontend.

## Project Structure

- `frontend/`: Vite + React + TypeScript client
- `backend/nakama/`: Nakama runtime module and SQL schema
- `shared/`: Shared TypeScript types and contracts
- `docker-compose.yml`: Local Postgres + Nakama stack
- `.env.example`: Safe environment template for frontend values

## Tech Stack

- Frontend: React, Vite, TypeScript, Zustand, Framer Motion, Tailwind CSS
- Backend runtime: Nakama JavaScript/TypeScript runtime
- Database: PostgreSQL
- Orchestration: Docker Compose

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose

## Environment Setup

1. Create local environment files:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Update values for your environment:

- `VITE_NAKAMA_HOST`
- `VITE_NAKAMA_PORT`
- `VITE_SERVER_KEY`

Optional backend override for Docker Compose:

- `POSTGRES_PASSWORD` (defaults to `changeme_local_only` if not provided)

## Run Locally

### 1. Start backend services

```bash
docker compose up --build
```

Default endpoints:

- Nakama API: `http://127.0.0.1:7350`
- Nakama Console: `http://127.0.0.1:7351`

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL shown in terminal.

## Multiplayer Testing (2 Browsers)

1. Open two browser windows (or one normal + one incognito).
2. In window A, create a room.
3. In window B, join with the room ID or use auto-match.
4. Verify:
   - turn enforcement works
   - invalid moves are rejected
   - win/draw resolution syncs on both clients
   - reconnection restores state

Optional scripted E2E test:

```bash
cd frontend
npm run test:e2e
```

## Build

```bash
cd frontend
npm run build
```

## Deployment

1. Build and push frontend and backend images.
2. Use managed Postgres in production.
3. Set secure runtime values:
   - strong Nakama server key
   - TLS enabled endpoints
   - restricted network access
4. Run Nakama DB migrations before rollout.
5. Configure CORS/WebSocket access for frontend domain.

## Security Notes

- No real secrets should be committed.
- Keep `.env` and `.env.local` untracked.
- Replace placeholder keys and passwords before production deployment.
