import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RootLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell public-app-shell">
      <header className="topbar public-topbar">
        <Link to="/" className="brand">
          <span>GF</span>
          <div>
            <strong>Gym Familly</strong>
            <small>Sistem member dan operasional gym.</small>
          </div>
        </Link>

        <nav className="topnav">
          <NavLink to="/" end>
            Beranda
          </NavLink>
          <NavLink to="/packages">Paket</NavLink>
          {user ? (
            <>
              <NavLink to={user.role === 'admin' ? '/admin' : '/member'}>Dashboard</NavLink>
              <button type="button" className="ghost-button" onClick={logout}>
                Keluar
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Masuk</NavLink>
              <NavLink to="/register" className="primary-link">
                Mulai Sekarang
              </NavLink>
            </>
          )}
        </nav>

        <div className="public-mobile-actions">
          <Link
            to={user ? (user.role === 'admin' ? '/admin' : '/member') : '/register'}
            className="public-mobile-cta"
          >
            {user ? 'Dashboard' : 'Mulai'}
          </Link>
          <button
            type="button"
            className="public-hamburger"
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        className={`public-drawer-overlay${mobileMenuOpen ? ' is-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      <aside className={`public-drawer${mobileMenuOpen ? ' is-open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="public-drawer-header">
          <div>
            <strong>Menu Gym Familly</strong>
            <small>Pilih halaman yang ingin dibuka.</small>
          </div>
          <button type="button" className="public-drawer-close" onClick={() => setMobileMenuOpen(false)}>
            Tutup
          </button>
        </div>

        <nav className="public-drawer-nav">
          <NavLink to="/" end>
            Beranda
          </NavLink>
          <NavLink to="/packages">Paket</NavLink>
          {user ? (
            <>
              <NavLink to={user.role === 'admin' ? '/admin' : '/member'}>Dashboard</NavLink>
              <button type="button" className="public-drawer-logout" onClick={handleLogout}>
                Keluar
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Masuk</NavLink>
              <NavLink to="/register">Mulai Sekarang</NavLink>
            </>
          )}
        </nav>
      </aside>

      <main className="page-shell public-page-shell">
        <Outlet />
      </main>

      <footer className="footer public-footer">
        <p>Registrasi, pembayaran, barcode, dan operasional gym dalam satu sistem.</p>
        <small className="public-copyright">© {currentYear} Gym Familly</small>
      </footer>
    </div>
  );
};
