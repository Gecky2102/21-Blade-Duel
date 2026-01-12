import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';

declare global {
  namespace Express {
    interface Request {
      playerId?: string;
      username?: string;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  req.playerId = payload.playerId;
  req.username = payload.username;
  next();
};
