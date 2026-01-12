import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export interface JWTPayload {
  playerId: string;
  username: string;
  iat: number;
  exp: number;
}

export class AuthService {
  static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  static verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }

  static generateToken(playerId: string, username: string): string {
    return jwt.sign(
      { playerId, username },
      config.jwtSecret,
      { expiresIn: 86400 } // 24 hours in seconds
    );
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch {
      return null;
    }
  }
}
