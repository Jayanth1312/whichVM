# whichvm.com

## Prerequisites

- Node.js (v22+)
- npm

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend server runs at `http://localhost:8080`.

Create a `.env` file (see `.env.example`) to configure environment variables.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

## Project Structure

```
├── backend/          # Express.js + TypeScript API server
│   └── src/
│       ├── server.ts
│       ├── config/
│       ├── apis/
│       ├── models/
│       └── services/
└── frontend/         # Next.js + ShadCN UI
```
