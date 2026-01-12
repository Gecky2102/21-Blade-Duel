import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initDb } from './services/database';
import { redisService } from './services/redis';
import { GameManager } from './services/gameManager';
import { config } from './config';

import authRoutes from './routes/auth';
import playerRoutes from './routes/player';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    credentials: true
  }
});

// Middleware
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io
const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  gameManager.initializeSocket(socket);

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

// Start server
async function start() {
  try {
    console.log('Initializing database...');
    await initDb();

    console.log('Connecting to Redis...');
    await redisService.connect();

    httpServer.listen(config.port, () => {
      console.log(`🎮 Blade Duel server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await redisService.disconnect();
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

start();

export default app;
