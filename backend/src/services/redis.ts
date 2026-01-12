import { createClient } from 'redis';
import { config } from '../config';

export class RedisService {
  private client;

  constructor() {
    this.client = createClient({ url: config.redisUrl });
    this.client.on('error', (err) => console.error('Redis Client Error', err));
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  async addToQueue(mode: 'casual' | 'ranked', playerId: string, username: string, rating?: number): Promise<boolean> {
    const queueKey = `queue:${mode}`;
    const playerData = JSON.stringify({ playerId, username, rating: rating || 1000, timestamp: Date.now() });
    
    await this.client.lPush(queueKey, playerData);
    // Expire queue entries after 2 minutes
    await this.client.expire(queueKey, 120);
    
    return true;
  }

  async getMatchmakingPair(mode: 'casual' | 'ranked'): Promise<[any, any] | null> {
    const queueKey = `queue:${mode}`;
    const player1 = await this.client.rPop(queueKey);
    const player2 = await this.client.rPop(queueKey);

    if (!player1 || !player2) {
      // Return player if only one exists
      if (player1) {
        await this.client.lPush(queueKey, player1);
      }
      return null;
    }

    return [JSON.parse(player1), JSON.parse(player2)];
  }

  async getQueueLength(mode: 'casual' | 'ranked'): Promise<number> {
    const queueKey = `queue:${mode}`;
    return await this.client.lLen(queueKey);
  }

  async storeGameState(matchId: string, gameState: any): Promise<void> {
    const key = `game:${matchId}`;
    await this.client.setEx(key, 3600, JSON.stringify(gameState)); // 1 hour expiry
  }

  async getGameState(matchId: string): Promise<any | null> {
    const key = `game:${matchId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async removeGameState(matchId: string): Promise<void> {
    const key = `game:${matchId}`;
    await this.client.del(key);
  }

  async setPlayerMatchId(playerId: string, matchId: string): Promise<void> {
    await this.client.setEx(`player:${playerId}:match`, 3600, matchId);
  }

  async getPlayerMatchId(playerId: string): Promise<string | null> {
    return await this.client.get(`player:${playerId}:match`);
  }

  async removePlayerMatchId(playerId: string): Promise<void> {
    await this.client.del(`player:${playerId}:match`);
  }

  async getOnlinePlayerCount(): Promise<number> {
    const keys = await this.client.keys('player:*:match');
    return keys.length;
  }
}

export const redisService = new RedisService();
