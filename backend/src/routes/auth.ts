import express from 'express';
import { AuthService } from '../services/auth';
import { queries } from '../services/database';
import { randomUUID } from 'crypto';

const router = express.Router();

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body as RegisterRequest;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingPlayer = await queries.getPlayerByUsername(username);
    if (existingPlayer) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = AuthService.hashPassword(password);
    const player = await queries.createPlayer(username, email, passwordHash);

    // Create player stats
    await queries.createPlayerStats(player.id);

    const token = AuthService.generateToken(player.id, player.username);

    res.status(201).json({
      player: {
        id: player.id,
        username: player.username,
        level: player.level,
        xp: player.xp
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const player = await queries.getPlayerByUsername(username);
    if (!player || !AuthService.verifyPassword(password, player.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = AuthService.generateToken(player.id, player.username);

    res.json({
      player: {
        id: player.id,
        username: player.username,
        level: player.level,
        xp: player.xp
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
