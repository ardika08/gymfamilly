import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, restoreError, clearRestoreError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  usePageTitle('Masuk');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    clearRestoreError();
    setSubmitting(true);

    try {
      const user = await login({ email, password });
      navigate(user.role === 'admin' ? '/admin' : '/member');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Terjadi kesalahan saat login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="panel auth-showcase-card">
        <span className="eyebrow">Masuk</span>
        <h1>Akses dashboard member dan admin dari satu akun.</h1>
        <p>Masuk untuk melihat membership, pembayaran, barcode, dan operasional gym.</p>
        <div className="mini-metric-grid">
          <div className="mini-metric">
            <span>Dashboard</span>
            <strong>Member & Admin</strong>
          </div>
          <div className="mini-metric">
            <span>Akses</span>
            <strong>Barcode digital</strong>
          </div>
          <div className="mini-metric">
            <span>Pembayaran</span>
            <strong>Verifikasi admin</strong>
          </div>
          <div className="mini-metric">
            <span>Status</span>
            <strong>Realtime</strong>
          </div>
        </div>
        <div className="auth-trust-row">
          <span className="table-chip success">Akun aktif</span>
          <span className="table-chip subtle">Akses cepat</span>
          <span className="table-chip warning">Cek status</span>
        </div>
      </div>

      <div className="auth-card premium-auth-card">
        <div className="auth-card-header">
          <span className="eyebrow">Akses Dashboard</span>
          <h2>Masuk ke akun</h2>
          <p>Gunakan email dan password yang sudah terdaftar.</p>
        </div>
        <form className="form-grid premium-auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="contoh@email.com"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
          </label>
          {restoreError ? <p className="form-error">{restoreError}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <div className="auth-benefit-list">
          <div className="auth-benefit-item">
            <strong>Status membership</strong>
            <small>Lihat masa aktif dan barcode dari satu dashboard.</small>
          </div>
          <div className="auth-benefit-item">
            <strong>Pesan admin</strong>
            <small>Komunikasi tetap rapi di dalam sistem.</small>
          </div>
        </div>
        <div className="auth-footer-line">
          <small>Belum punya akun?</small>
          <Link to="/register" className="button-filter">
            Daftar
          </Link>
        </div>
      </div>
    </section>
  );
};
