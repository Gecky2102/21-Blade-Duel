import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { getSocket } from '../../services/socket';
import { motion } from 'framer-motion';

const SPECIAL_CARD_INFO: Record<string, string> = {
  OVERCLOCK: '+3 max limit (24).',
  SWAP: 'Swap totals with opponent.',
  JAM: 'Blocks opponent next special.',
  ECHO: 'Duplicate your last card.',
  BURN: 'Replace your last card.',
  BLOOD_DRAW: 'Both draw + bleed 1.',
  EDGE: 'Next hit +3.',
  GREED: 'Draw 2, keep best.',
  DISTURB: 'Scramble opponent total.',
  FAKE_STAND: 'Pretend stand, keep turn.',
  DELAY: 'Add 5s to your timer.',
  DOUBLE_EDGE: 'Next hit double, risk bust.',
  LAST_BREATH: 'Survive one overdraw.'
};

const SUITS = ['♠', '♥', '♦', '♣'];

export default function GameBoard() {
  const { gameState, result } = useSelector((state: RootState) => state.game);
  const { token, player } = useSelector((state: RootState) => state.auth);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [turnSeconds, setTurnSeconds] = useState<number | null>(null);
  const socket = getSocket();

  const calculateSawOffset = () => {
    if (!gameState) return 0;
    const yourTotal = gameState.yourTotal;
    const oppTotal = gameState.opponentTotal ?? gameState.opponentVisibleCard ?? 0;
    const roundNum = gameState.currentTurn === 'you' ? gameState.turnCount : gameState.turnCount + 1;

    // Step-based movement: round 1 = 2px, round 2 = 4px, round 3+ = 8px per move
    let stepSize = 2;
    if (roundNum >= 2) stepSize = 4;
    if (roundNum >= 3) stepSize = 8;

    // Direction: towards the player with higher total (losing position)
    const direction = yourTotal > oppTotal ? 1 : yourTotal < oppTotal ? -1 : 0;
    return direction * (stepSize * Math.floor(roundNum / 2));
  };

  const getBladeOutcome = () => {
    if (sawOffset > 12) return { text: '⚠️ YOU LOSE', color: '#ef4444', desc: 'Blade closing on you' };
    if (sawOffset < -12) return { text: '✓ YOU WIN', color: '#22c55e', desc: 'Blade closing on opponent' };
    return { text: '⚖️ NEUTRAL', color: '#9ca3af', desc: 'Blade in center' };
  };

  useEffect(() => {
    if (!gameState?.turnDeadline) {
      setTurnSeconds(null);
      return;
    }
    const tick = () => {
      const ms = gameState.turnDeadline - Date.now();
      setTurnSeconds(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [gameState?.turnDeadline]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading game...</p>
      </div>
    );
  }

  if (gameState.gamePhase === 'result' && result) {
    const isWinner = result.winnerId === player?.id;
    return (
      <div className="min-h-screen relative overflow-hidden px-4 py-8 flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(circle at 30% 10%, rgba(208,22,42,0.12), transparent 32%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(208,22,42,0.1) 0%, transparent 40%, rgba(208,22,42,0.08) 90%)' }} />
        
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="relative z-10 text-center space-y-8 max-w-2xl"
        >
          {isWinner ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="text-9xl"
              >
                🪚
              </motion.div>
              <h1 className="text-6xl font-bold hero-title text-red-400">VICTORY</h1>
              <p className="text-2xl text-gray-300">Your blade found its mark.</p>
              <div className="glass-panel rounded-xl p-6 space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Your hand:</span>
                  <span className="font-bold text-green-400">{result.winnerTotal}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Opponent:</span>
                  <span className="font-bold text-red-400">{result.loserTotal}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Duration:</span>
                  <span className="font-bold text-gray-300">{result.durationSeconds}s</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-9xl"
              >
                ⚔️
              </motion.div>
              <h1 className="text-6xl font-bold hero-title text-red-600">DEFEAT</h1>
              <p className="text-2xl text-gray-300">The blade turns against you.</p>
              <div className="glass-panel rounded-xl p-6 space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Your hand:</span>
                  <span className="font-bold text-red-400">{result.loserTotal}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">{result.winnerUsername}:</span>
                  <span className="font-bold text-green-400">{result.winnerTotal}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Duration:</span>
                  <span className="font-bold text-gray-300">{result.durationSeconds}s</span>
                </div>
              </div>
            </>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="button-blood px-8 py-4 rounded-lg text-lg font-semibold mt-8"
          >
            Return to Lobby
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const isYourTurn = gameState.currentTurn === 'you';
  const opponentTotal = gameState.opponentTotal ?? gameState.opponentVisibleCard ?? 0;
  const sawOffset = calculateSawOffset();
  const bladeHint = sawOffset > 12 ? 'The blade approaches you.' : sawOffset < -12 ? 'The blade eyes your opponent.' : 'The blade waits in the center.';

  const formatCard = (value: number, idx: number) => {
    const suit = SUITS[idx % SUITS.length];
    return { label: value.toString(), suit };
  };

  const handleHit = () => {
    socket.emit('game_action', {
      matchId: gameState.matchId,
      token,
      action: 'HIT'
    });
    setLastAction('hit');
  };

  const handleStand = () => {
    socket.emit('game_action', {
      matchId: gameState.matchId,
      token,
      action: 'STAND'
    });
    setLastAction('stand');
  };

  return (
    <div className="min-h-screen relative overflow-hidden px-4 py-8">
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(circle at 30% 10%, rgba(208,22,42,0.12), transparent 32%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-45" style={{ background: 'radial-gradient(circle at 70% 20%, rgba(208,22,42,0.08), transparent 28%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(208,22,42,0.1) 0%, transparent 40%, rgba(208,22,42,0.08) 90%)' }} />

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        {/* Status */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm tracking-[0.2em] uppercase text-red-400">{gameState.mode} match</p>
            <h2 className="text-3xl font-bold hero-title">Blood is the stakes</h2>
            <p className="text-gray-400 text-sm">{isYourTurn ? 'Your move.' : 'Hold your breath.'}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Turn</p>
            <div className="text-3xl font-bold text-white">{isYourTurn ? 'You' : 'Opponent'}</div>
            {turnSeconds !== null && (
              <p className="text-red-300 text-sm">{turnSeconds}s</p>
            )}
          </div>
        </div>

        {/* Blade track with avatars */}
        <div className="flex items-center justify-between mb-2 px-2 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-700/60 flex items-center justify-center text-white">You</div>
            <div className="text-red-200 font-semibold">{gameState.yourTotal}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-orange-200 font-semibold">{gameState.gamePhase === 'result' || gameState.opponentStanding ? gameState.opponentTotal ?? '??' : '??'}</div>
            <div className="w-10 h-10 rounded-full bg-orange-900/40 border border-orange-700/60 flex items-center justify-center text-white">{(gameState.opponentName || '?').slice(0,2).toUpperCase()}</div>
          </div>
        </div>
        <div className="blade-track rounded-xl mb-2">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ x: sawOffset }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              className="saw-blade"
            />
          </motion.div>
        </div>

        {/* Blade distance and outcome prediction */}
        <div className="grid grid-cols-3 gap-4 px-2 mb-3">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Distance to You</p>
            <p className="text-lg font-bold text-red-400">{Math.abs(sawOffset).toFixed(0)}px</p>
          </div>
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-sm font-bold"
              style={{
                color: getBladeOutcome().color
              }}
            >
              {getBladeOutcome().text}
            </motion.div>
            <p className="text-xs text-gray-400 mt-1">{getBladeOutcome().desc}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Distance to Opponent</p>
            <p className="text-lg font-bold text-orange-400">{Math.abs(sawOffset).toFixed(0)}px</p>
          </div>
        </div>
        <p className="text-center text-gray-400 text-sm mt-2">{bladeHint}</p>

        {/* Opponent */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-red-400">Opponent</p>
                <h3 className="text-lg font-bold text-white">{gameState.opponentName || 'Unknown steel'}</h3>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-400">{gameState.gamePhase === 'result' || gameState.opponentStanding ? gameState.opponentTotal ?? '??' : '??'}</div>
                <p className="text-gray-500 text-xs">Total</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="playing-card">
                <div className="card-inner">
                  <div className="card-value">{gameState.opponentVisibleCard}</div>
                  <div className="card-suit">{SUITS[0]}</div>
                </div>
              </div>
              <div className="playing-card card-hidden">
                <div className="card-inner">
                  <div className="card-back">🔒</div>
                </div>
              </div>
            </div>
          </div>

          {/* You */}
          <div className="glass-panel rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-red-400">You</p>
                <h3 className="text-lg font-bold text-white">Your hand</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">{gameState.yourTotal}</div>
                <p className="text-gray-500 text-xs">Total</p>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap mb-4">
              {gameState.yourCards.map((card, idx) => {
                const formatted = formatCard(card, idx);
                return (
                  <motion.div
                    key={idx}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.06 }}
                    className="playing-card"
                  >
                    <div className="card-inner">
                      <div className="card-value">{formatted.label}</div>
                      <div className={`card-suit ${formatted.suit === '♥' || formatted.suit === '♦' ? 'text-red-500' : 'text-black'}`}>
                        {formatted.suit}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {gameState.specialCards.length > 0 && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs mb-2">Special Cards</p>
                <div className="flex gap-2 flex-wrap">
                  {gameState.specialCards.map((card, idx) => (
                    <div key={idx} className="px-3 py-2 rounded text-xs font-semibold holo-badge" title={SPECIAL_CARD_INFO[card] || 'Unknown effect'}>
                      <div className="font-bold">{card}</div>
                      <div className="text-[10px] text-red-50/80">{SPECIAL_CARD_INFO[card] || ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mb-2">
              <button
                onClick={handleHit}
                disabled={!isYourTurn}
                className="flex-1 button-blood hover:brightness-110 disabled:brightness-75 text-white font-bold py-3 rounded transition"
              >
                🎲 Hit
              </button>
              <button
                onClick={handleStand}
                disabled={!isYourTurn}
                className="flex-1 bg-black/60 border border-red-800 text-white font-bold py-3 rounded transition hover:bg-black/70 disabled:opacity-60"
              >
                ✋ Stand
              </button>
            </div>
            {lastAction && (
              <p className="text-center text-gray-400 text-sm">Last action: {lastAction}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
