import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { queries } from '../services/database';

const router = express.Router();

// Get player profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const player = await queries.getPlayerById(req.playerId!);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get player stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const player = await queries.getPlayerById(req.playerId!);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({
      level: player.level,
      xp: player.xp,
      casual_wins: player.casual_wins || 0,
      casual_losses: player.casual_losses || 0,
      ranked_wins: player.ranked_wins || 0,
      ranked_losses: player.ranked_losses || 0,
      current_rating: player.current_rating || 1000
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get match history
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const matches = await queries.getMatchHistory(req.playerId!, limit);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

// Get cosmetics
router.get('/cosmetics', authenticateToken, async (req, res) => {
  try {
    const cosmetics = await queries.getCosmetics(req.playerId!);
    res.json(cosmetics || {
      card_theme: 'default',
      blade_skin: 'default',
      background_theme: 'dark'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cosmetics' });
  }
});

// Update cosmetics
router.post('/cosmetics', authenticateToken, async (req, res) => {
  try {
    const { cardTheme, bladeSkin, backgroundTheme } = req.body;
    await queries.updateCosmetics(
      req.playerId!,
      cardTheme || 'default',
      bladeSkin || 'default',
      backgroundTheme || 'dark'
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cosmetics' });
  }
});

export default router;
