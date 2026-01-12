import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import Lobby from '../components/game/Lobby';

export default function Home() {
  const { token, player } = useSelector((state: RootState) => state.auth);
  const [showRegister, setShowRegister] = React.useState(false);

  if (token && player) {
    return <Lobby />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-40 mix-blend-screen" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(208,22,42,0.14), transparent 28%)' }} />
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 70% 10%, rgba(208,22,42,0.1), transparent 26%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(208,22,42,0.08) 0%, transparent 35%, rgba(208,22,42,0.12) 70%)' }} />
      </div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-center relative z-10">
        <div className="space-y-4">
          <p className="text-sm tracking-[0.2em] uppercase text-red-400">Enter the duel</p>
          <h1 className="text-5xl md:text-6xl font-bold hero-title">Blade Duel</h1>
          <p className="text-lg text-gray-300 max-w-xl">
            Reach 21 or bleed trying. Ultra-fast 1v1 clashes, sudden twists, and thirteen cursed cards that tip the edge of every round.
          </p>
          <div className="blood-divider" />
          <div className="flex gap-4 text-sm text-gray-400">
            <span className="px-3 py-2 rounded border border-red-700/60 bg-red-900/20">Real-time duels</span>
            <span className="px-3 py-2 rounded border border-red-700/60 bg-red-900/20">Ranked & Friends</span>
            <span className="px-3 py-2 rounded border border-red-700/60 bg-red-900/20">13 special cards</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-2xl">
          <div className="flex mb-6 bg-black/40 rounded-lg border border-white/5 overflow-hidden">
            <button
              onClick={() => setShowRegister(false)}
              className={`flex-1 py-3 text-sm font-semibold transition ${!showRegister ? 'button-blood' : 'text-gray-300 hover:text-white'}`}
            >
              Login
            </button>
            <button
              onClick={() => setShowRegister(true)}
              className={`flex-1 py-3 text-sm font-semibold transition ${showRegister ? 'button-blood' : 'text-gray-300 hover:text-white'}`}
            >
              Register
            </button>
          </div>

          {!showRegister ? (
            <LoginForm />
          ) : (
            <RegisterForm />
          )}
        </div>
      </div>
    </div>
  );
}
