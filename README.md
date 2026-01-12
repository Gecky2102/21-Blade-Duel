![Logo](/resources/logo.png)
# 21 – Blade Duel

Fast-paced 1v1 online card game. Reach 21 without busting.

## Quick Start

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- Database: postgresql://bladeduel:bladeduel123@localhost:5432/bladeduel_db

## Development

### Frontend
```bash
cd frontend
npm install
npm start
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, Socket.io
- **Database:** PostgreSQL
- **Cache:** Redis
- **Deployment:** Docker, Docker Compose

## Features

- Real-time 1v1 gameplay
- Special card system
- Ranked & casual modes
- Player progression
- JWT authentication
- WebSocket synchronization

