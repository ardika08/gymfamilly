import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { EmptyState } from '../../components/ui/EmptyState';
import { PackageCard } from '../../components/ui/PackageCard';
import { StatCard } from '../../components/ui/StatCard';
import { usePageTitle } from '../../hooks/usePageTitle';
import { packageService } from '../../services/api';
import type { GymPackage } from '../../types/models';

export const LandingPage = () => {
  const [items, setItems] = useState<GymPackage[]>([]);
  const [heroQrImage, setHeroQrImage] = useState('');
  usePageTitle('Beranda');

  useEffect(() => {
    const refresh = () => {
      packageService.list().then(setItems);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === packageService.events.dbKey) {
        refresh();
      }
    };

    refresh();
    window.addEventListener(packageService.events.updated, refresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(packageService.events.updated, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    QRCode.toDataURL('GF|preview-access', {
      width: 280,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    }).then(setHeroQrImage);
  }, []);

  return (
    <div className="stack-xl">
      <section className="public-hero-shell">
        <div className="public-hero-copy">
          <span className="eyebrow">Gym Familly</span>
          <h1 className="landing-hero-title">
            <span>Daftar gym jadi lebih cepat,</span>
            <span>rapi, dan jelas.</span>
          </h1>
          <p>Daftar member, pilih paket, kirim bukti transfer, dan gunakan barcode digital dari satu alur.</p>
          <div className="hero-actions">
            <Link to="/register" className="button-primary">
              Daftar Membership
            </Link>
            <Link to="/packages" className="button-secondary">
              Lihat Paket
            </Link>
          </div>
          <div className="public-hero-metrics">
            <div className="mini-metric">
              <span>Registrasi</span>
              <strong>3 langkah</strong>
            </div>
            <div className="mini-metric">
              <span>Notifikasi</span>
              <strong>WhatsApp aktif</strong>
            </div>
            <div className="mini-metric">
              <span>Check-in</span>
              <strong>Barcode digital</strong>
            </div>
          </div>
        </div>

        <div className="public-hero-visual">
          <div className="public-hero-dashboard-card">
            <div className="public-hero-dashboard-top">
              <div>
                <small>Preview barcode</small>
                <strong>Akses member</strong>
              </div>
              <span className="table-chip success">Siap</span>
            </div>
            <div className="landing-qr-shell">
              <div className="landing-qr-frame">
                {heroQrImage ? (
                  <img src={heroQrImage} alt="Contoh QR code member" className="landing-qr-image" />
                ) : (
                  <div className="barcode-lines" />
                )}
              </div>
              <div className="landing-qr-copy">
                <span className="barcode-code-label">Payload QR</span>
                <strong className="landing-qr-code">GF|preview-access</strong>
                <p className="barcode-package-name">Contoh QR untuk check-in member</p>
              </div>
            </div>
            <div className="public-hero-dashboard-grid">
              <div className="barcode-meta-card">
                <small>QR Code</small>
                <strong>GF-PREVIEW</strong>
              </div>
              <div className="barcode-meta-card">
                <small>Status</small>
                <strong>Aktif setelah verifikasi</strong>
              </div>
              <div className="barcode-meta-card">
                <small>Paket</small>
                <strong>Sesuai pilihan member</strong>
              </div>
              <div className="barcode-meta-card">
                <small>Check-in</small>
                <strong>Scan di pintu masuk</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Daftar lebih cepat" value="3 langkah" hint="Daftar, pilih paket, kirim bukti transfer." />
        <StatCard label="Reminder WA" value="H-3 aktif" hint="Status membership lebih mudah dipantau." />
        <StatCard label="Check-in" value="Barcode digital" hint="Siap dipakai setelah verifikasi admin." />
      </section>

      <section className="public-highlight-grid">
        <article className="panel public-highlight-card">
          <span className="eyebrow">Pengalaman Member</span>
          <h2>Flow yang terasa modern dari daftar sampai check-in.</h2>
          <p>Member cukup fokus ke paket, pembayaran, barcode, dan pesan admin.</p>
          <div className="quick-tips">
            <div>
              <span>Upload bukti</span>
              <strong>Format gambar langsung</strong>
            </div>
            <div>
              <span>Status aktif</span>
              <strong>Tampil real-time</strong>
            </div>
          </div>
        </article>
        <article className="panel public-highlight-card accent">
          <span className="eyebrow">Operasional Admin</span>
          <h2>Verifikasi lebih cepat, riwayat scan lebih tertata.</h2>
          <p>Dashboard admin memudahkan verifikasi pembayaran, masa aktif, dan riwayat check-in.</p>
          <div className="quick-tips">
            <div>
              <span>Scanner</span>
              <strong>Validasi lebih tegas</strong>
            </div>
            <div>
              <span>Keuangan</span>
              <strong>Export lebih rapi</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="stack-lg">
        <div className="panel-toolbar">
          <div>
            <span className="eyebrow">Paket</span>
            <h3>Paket membership</h3>
            <p>Pilih paket yang sesuai lalu lanjut daftar.</p>
          </div>
          <Link to="/packages" className="button-filter">
            Lihat semua paket
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Belum ada paket" description="Admin bisa menambahkan paket dari dashboard admin." />
        ) : (
          <div className="card-grid">
            {items.slice(0, 3).map((item) => (
              <PackageCard
                key={item.id}
                item={item}
                action={
                  <Link to="/register" className="button-inline">
                    Ambil Paket
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="public-testimonial-grid">
        <article className="panel public-testimonial-feature">
          <span className="eyebrow">Keunggulan</span>
          <h3>Tampilan depan dan dashboard memakai alur yang sama.</h3>
          <p>Member tidak perlu beradaptasi ulang saat pindah dari halaman publik ke dashboard.</p>
          <div className="task-list">
            <div className="task-row">
              <strong>Paket jelas</strong>
              <span>Harga dan status lebih mudah dibaca</span>
            </div>
            <div className="task-row">
              <strong>Check-in cepat</strong>
              <span>Barcode siap dipakai setelah verifikasi</span>
            </div>
          </div>
        </article>
        <article className="panel public-faq-card">
          <span className="eyebrow">FAQ Singkat</span>
          <div className="public-faq-list">
            <div className="public-faq-item">
              <strong>Apakah harus datang ke gym untuk daftar?</strong>
              <p>Tidak. Member bisa daftar mandiri, pilih paket, lalu kirim bukti transfer langsung dari sistem.</p>
            </div>
            <div className="public-faq-item">
              <strong>Kapan membership aktif?</strong>
              <p>Membership aktif setelah admin memverifikasi pembayaran dan sistem memperbarui status akun member.</p>
            </div>
            <div className="public-faq-item">
              <strong>Kalau masa aktif habis bagaimana?</strong>
              <p>Member akan melihat pengingat perpanjangan dan barcode berhenti dipakai sampai membership diperbarui.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="public-cta-final">
        <div className="public-cta-copy">
          <span className="eyebrow">Siap Mulai?</span>
          <h2>Mulai membership Gym Familly sekarang.</h2>
          <p>Daftar akun, pilih paket, lalu lanjutkan ke pembayaran dan barcode digital.</p>
        </div>
        <div className="public-cta-actions">
          <Link to="/register" className="button-primary">
            Daftar
          </Link>
          <Link to="/login" className="button-secondary">
            Masuk ke Akun
          </Link>
        </div>
      </section>
    </div>
  );
};
