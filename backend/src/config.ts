import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000'),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://bladeduel:bladeduel123@localhost:5432/bladeduel_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
  jwtExpiry: '24h',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
};
