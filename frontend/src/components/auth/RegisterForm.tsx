import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { setAuth, setError, setLoading } from '../../redux/authSlice';
import { authAPI } from '../../services/api';

export default function RegisterForm() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setError(null));

    if (formData.password !== formData.confirmPassword) {
      dispatch(setError('Passwords do not match'));
      return;
    }

    if (formData.password.length < 8) {
      dispatch(setError('Password must be at least 8 characters'));
      return;
    }

    dispatch(setLoading(true));

    try {
      const response = await authAPI.register(formData.username, formData.email, formData.password);
      dispatch(setAuth({
        token: response.data.token,
        player: response.data.player
      }));
    } catch (err: any) {
      dispatch(setError(err.response?.data?.error || 'Registration failed'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold text-white mb-1">Join the Duelists</h2>
        <p className="text-sm text-gray-400">Forge your mark. Claim your edge.</p>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-gray-300 text-sm mb-2">Username</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="w-full input-dark text-white px-4 py-3 rounded transition"
          required
        />
      </div>

      <div>
        <label className="block text-gray-300 text-sm mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full input-dark text-white px-4 py-3 rounded transition"
          required
        />
      </div>

      <div>
        <label className="block text-gray-300 text-sm mb-2">Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full input-dark text-white px-4 py-3 rounded transition"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Min 8 characters, avoid obvious patterns.</p>
      </div>

      <div>
        <label className="block text-gray-300 text-sm mb-2">Confirm Password</label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full input-dark text-white px-4 py-3 rounded transition"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full button-blood hover:brightness-110 disabled:brightness-75 text-white font-semibold py-3 rounded transition"
      >
        {loading ? 'Creating account...' : 'Register'}
      </button>
    </form>
  );
}
