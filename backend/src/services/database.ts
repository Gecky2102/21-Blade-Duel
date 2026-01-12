import postgres from 'postgres';
import { config } from '../config';

let db: ReturnType<typeof postgres>;

export async function initDb() {
  db = postgres(config.databaseUrl);
  
  // Test connection
  const result = await db`SELECT NOW()`;
  console.log('Database connected:', result);
  
  return db;
}

export async function closeDb() {
  if (db) {
    await db.end();
  }
}

export const queries = {
  // Players
  createPlayer: async (username: string, email: string, passwordHash: string) => {
    const result = await db`
      INSERT INTO players (username, email, password_hash)
      VALUES (${username}, ${email}, ${passwordHash})
      RETURNING id, username, email, level, xp
    `;
    return result[0];
  },

  getPlayerById: async (id: string) => {
    const result = await db`
      SELECT p.*, ps.casual_wins, ps.casual_losses, ps.ranked_wins, ps.ranked_losses, ps.current_rating
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE p.id = ${id}
    `;
    return result[0];
  },

  getPlayerByUsername: async (username: string) => {
    const result = await db`
      SELECT p.*, ps.casual_wins, ps.casual_losses, ps.ranked_wins, ps.ranked_losses, ps.current_rating
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE p.username = ${username}
    `;
    return result[0];
  },

  ensureBotPlayer: async () => {
    const existing = await queries.getPlayerByUsername('AIBot');
    if (existing) return existing;

    const inserted = await db`
      INSERT INTO players (username, email, password_hash, level, xp)
      VALUES ('AIBot', 'ai@bot.local', 'bot', 1, 0)
      ON CONFLICT (username) DO NOTHING
      RETURNING *
    `;
    const botPlayer = inserted[0] || (await queries.getPlayerByUsername('AIBot'));
    if (!botPlayer) throw new Error('Failed to create bot player');

    await db`
      INSERT INTO player_stats (player_id)
      VALUES (${botPlayer.id})
      ON CONFLICT (player_id) DO NOTHING
    `;

    return botPlayer;
  },

  updatePlayerLevel: async (playerId: string, level: number, xp: number) => {
    await db`
      UPDATE players
      SET level = ${level}, xp = ${xp}, updated_at = NOW()
      WHERE id = ${playerId}
    `;
  },

  // Player Stats
  createPlayerStats: async (playerId: string) => {
    await db`
      INSERT INTO player_stats (player_id)
      VALUES (${playerId})
    `;
  },

  updatePlayerStats: async (
    playerId: string,
    mode: 'casual' | 'ranked',
    won: boolean,
    ratingChange?: number
  ) => {
    if (mode === 'casual') {
      if (won) {
        await db`
          UPDATE player_stats
          SET casual_wins = casual_wins + 1, total_matches = total_matches + 1, updated_at = NOW()
          WHERE player_id = ${playerId}
        `;
      } else {
        await db`
          UPDATE player_stats
          SET casual_losses = casual_losses + 1, total_matches = total_matches + 1, updated_at = NOW()
          WHERE player_id = ${playerId}
        `;
      }
    } else {
      if (won) {
        await db`
          UPDATE player_stats
          SET ranked_wins = ranked_wins + 1, 
              total_matches = total_matches + 1,
              current_rating = current_rating + ${ratingChange || 0},
              peak_rating = GREATEST(peak_rating, current_rating + ${ratingChange || 0}),
              updated_at = NOW()
          WHERE player_id = ${playerId}
        `;
      } else {
        await db`
          UPDATE player_stats
          SET ranked_losses = ranked_losses + 1, 
              total_matches = total_matches + 1,
              current_rating = GREATEST(0, current_rating + ${ratingChange || 0}),
              updated_at = NOW()
          WHERE player_id = ${playerId}
        `;
      }
    }
  },

  // Matches
  createMatch: async (
    player1Id: string,
    player2Id: string,
    mode: 'casual' | 'ranked' | 'friends'
  ) => {
    const result = await db`
      INSERT INTO matches (player1_id, player2_id, mode)
      VALUES (${player1Id}, ${player2Id}, ${mode})
      RETURNING id
    `;
    return result[0].id;
  },

  finishMatch: async (
    matchId: string,
    winnerId: string,
    player1Total: number,
    player2Total: number,
    player1CardCount: number,
    player2CardCount: number,
    durationSeconds: number
  ) => {
    await db`
      UPDATE matches
      SET 
        winner_id = ${winnerId},
        player1_final_total = ${player1Total},
        player2_final_total = ${player2Total},
        player1_card_count = ${player1CardCount},
        player2_card_count = ${player2CardCount},
        duration_seconds = ${durationSeconds},
        status = 'completed'
      WHERE id = ${matchId}
    `;
  },

  // Match Log
  logAction: async (
    matchId: string,
    turnNumber: number,
    playerId: string,
    action: string,
    cardValue?: number,
    newTotal?: number,
    specialCard?: string
  ) => {
    await db`
      INSERT INTO match_log (match_id, turn_number, player_id, action, card_value, new_total, special_card_used)
      VALUES (${matchId}, ${turnNumber}, ${playerId}, ${action}, ${cardValue || null}, ${newTotal || null}, ${specialCard || null})
    `;
  },

  getMatchHistory: async (playerId: string, limit: number = 20) => {
    const result = await db`
      SELECT m.*, 
             p1.username as player1_username, 
             p2.username as player2_username,
             pw.username as winner_username
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      LEFT JOIN players pw ON m.winner_id = pw.id
      WHERE m.player1_id = ${playerId} OR m.player2_id = ${playerId}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
    return result;
  },

  // Cosmetics
  getCosmetics: async (playerId: string) => {
    const result = await db`
      SELECT * FROM cosmetics WHERE player_id = ${playerId}
    `;
    return result[0];
  },

  updateCosmetics: async (playerId: string, cardTheme: string, bladeSkin: string, backgroundTheme: string) => {
    await db`
      INSERT INTO cosmetics (player_id, card_theme, blade_skin, background_theme)
      VALUES (${playerId}, ${cardTheme}, ${bladeSkin}, ${backgroundTheme})
      ON CONFLICT (player_id) DO UPDATE SET
        card_theme = ${cardTheme},
        blade_skin = ${bladeSkin},
        background_theme = ${backgroundTheme}
    `;
  }
};

export function getDb() {
  return db;
}
