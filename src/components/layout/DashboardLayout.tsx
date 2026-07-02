import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface DashboardLayoutProps {
  mode: 'member' | 'admin';
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const memberSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/member', label: 'Ringkasan', icon: 'grid' },
      { to: '/member/packages', label: 'Pilih Paket', icon: 'package' },
      { to: '/member/payments', label: 'Pembayaran', icon: 'wallet' },
    ],
  },
  {
    title: 'Aktivitas',
    items: [
      { to: '/member/barcode', label: 'Barcode', icon: 'qr' },
      { to: '/member/attendance', label: 'Kehadiran', icon: 'clock' },
      { to: '/member/messages', label: 'Pesan', icon: 'mail' },
    ],
  },
];

const adminSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'grid' },
      { to: '/admin/members', label: 'Member', icon: 'users' },
      { to: '/admin/payments', label: 'Pembayaran', icon: 'wallet' },
      { to: '/admin/finance', label: 'Keuangan', icon: 'finance' },
      { to: '/admin/packages', label: 'Paket & Promo', icon: 'package' },
      { to: '/admin/vouchers', label: 'Voucher', icon: 'finance' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/admin/messages', label: 'Inbox', icon: 'mail' },
      { to: '/admin/attendance', label: 'Riwayat', icon: 'clock' },
      { to: '/admin/scanner', label: 'Scan Barcode', icon: 'qr' },
    ],
  },
];

const SidebarIcon = ({ name }: { name: string }) => {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'sidebar-icon-svg',
    'aria-hidden': true,
  };

  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="M12 3 4.5 7 12 11 19.5 7 12 3Z" />
          <path d="M4.5 7v10L12 21l7.5-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 15.5v-7Z" />
          <path d="M15 12h5" />
          <circle cx="15.5" cy="12" r=".5" fill="currentColor" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...common}>
          <path d="M5 19V10" />
          <path d="M12 19V5" />
          <path d="M19 19v-8" />
          <path d="M3 19h18" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <path d="M15 15h1v1h-1z" fill="currentColor" stroke="none" />
          <path d="M18 14v2m-2 2h2m1 0h1v1h-1z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2.5" />
          <path d="m5.5 8 6.5 5 6.5-5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 19a4 4 0 0 0-8 0" />
          <circle cx="12" cy="10" r="3" />
          <path d="M19 19a3 3 0 0 0-2.2-2.9M5 19a3 3 0 0 1 2.2-2.9" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
  }
};

export const DashboardLayout = ({ mode }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = mode === 'admin' ? adminSections : memberSections;

  const currentItem = useMemo(
    () =>
      sections
        .flatMap((section) => section.items)
        .find((item) =>
          item.to === `/${mode}`
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to),
        ),
    [location.pathname, mode, sections],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="dashboard-app-shell">
      <div
        className={`dashboard-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <aside className={`dashboard-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="dashboard-sidebar-top">
          <Link to={mode === 'admin' ? '/admin' : '/member'} className="dashboard-brand">
            <span>GF</span>
            <div>
              <strong>Gym Familly</strong>
              <small>{mode === 'admin' ? 'Admin Control Panel' : 'Member Dashboard'}</small>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup sidebar"
          >
            <span />
            <span />
          </button>
        </div>
        <div className="sidebar-sections">
          {sections.map((section) => (
            <div key={section.title} className="sidebar-group">
              <span className="sidebar-group-title">{section.title}</span>
              <nav className="sidebar-nav">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/member' || item.to === '/admin'}
                    className="sidebar-link"
                  >
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <SidebarIcon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-footer-card">
          <div className="session-user">
            <div>
              <small>Login sebagai</small>
              <strong>{user?.nama}</strong>
            </div>
          </div>
          <button type="button" className="ghost-button dashboard-logout" onClick={logout}>
            Keluar
          </button>
        </div>
      </aside>

      <div className="dashboard-main-shell">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-main">
            <button
              type="button"
              className="hamburger-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka sidebar"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <div className="dashboard-breadcrumb">
                <Link to="/">Pages</Link>
                <span>/</span>
                <span>{currentItem?.label ?? (mode === 'admin' ? 'Dashboard' : 'Ringkasan')}</span>
              </div>
              <h1>{currentItem?.label ?? (mode === 'admin' ? 'Dashboard' : 'Ringkasan')}</h1>
            </div>
          </div>
          <div className="dashboard-topbar-actions">
            <div className="search-shell">
              <input placeholder="Cari menu..." />
            </div>
            <div className="topbar-profile">
              <span className="topbar-avatar">{user?.nama?.slice(0, 1) ?? 'G'}</span>
              <div>
                <strong>{user?.nama}</strong>
                <small>{mode === 'admin' ? 'Admin' : 'Member'}</small>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-main-content">
          <Outlet />
        </main>

        <footer className="dashboard-footer">
          <p>Dashboard Gym Familly</p>
          <small>Siap dipakai di desktop dan mobile.</small>
        </footer>
      </div>
    </div>
  );
};
