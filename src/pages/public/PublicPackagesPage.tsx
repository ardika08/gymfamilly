import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { PackageCard } from '../../components/ui/PackageCard';
import { usePageTitle } from '../../hooks/usePageTitle';
import { packageService } from '../../services/api';
import type { GymPackage } from '../../types/models';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const PublicPackagesPage = () => {
  const [items, setItems] = useState<GymPackage[]>([]);
  usePageTitle('Paket Membership');

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

  const packageSummary = useMemo(() => {
    const promoCount = items.filter((item) => item.harga_promo && item.harga_promo < item.harga_normal).length;
    const cheapestPrice =
      items.length > 0
        ? Math.min(...items.map((item) => item.harga_promo ?? item.harga_normal))
        : null;

    return {
      promoCount,
      cheapestPrice: cheapestPrice ? currency.format(cheapestPrice) : '-',
    };
  }, [items]);

  return (
    <div className="stack-xl public-content-stack">
      <section className="public-packages-hero">
        <div className="public-packages-copy">
          <span className="eyebrow">Paket Gym Familly</span>
          <h1>Pilih membership yang paling pas untuk ritme latihan kamu.</h1>
          <p>Semua paket ditampilkan ringkas dengan harga dan benefit yang mudah dibaca.</p>
          <div className="public-hero-metrics">
            <div className="mini-metric">
              <span>Total paket</span>
              <strong>{items.length}</strong>
            </div>
            <div className="mini-metric">
              <span>Paket promo</span>
              <strong>{packageSummary.promoCount}</strong>
            </div>
            <div className="mini-metric">
              <span>Mulai dari</span>
              <strong>{packageSummary.cheapestPrice}</strong>
            </div>
          </div>
        </div>
        <div className="panel public-packages-sidecard">
          <span className="eyebrow">Info Paket</span>
          <h3>Katalog paket dibuat ringkas dan mudah dipilih.</h3>
          <div className="task-list">
            <div className="task-row">
              <strong>Harga lebih jelas</strong>
              <span>Harga promo dan normal tetap terlihat</span>
            </div>
            <div className="task-row">
              <strong>Benefit singkat</strong>
              <span>Member tahu isi paket sebelum daftar</span>
            </div>
            <div className="task-row">
              <strong>Daftar lebih cepat</strong>
              <span>Tiap paket langsung punya tombol aksi</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stack-lg public-section-stack">
        <div className="panel-toolbar public-section-toolbar">
          <div>
            <span className="eyebrow">Katalog Paket</span>
            <h3>Daftar paket Gym Familly</h3>
            <p>Pilih paket lalu lanjut ke registrasi.</p>
          </div>
          <Link to="/register" className="button-filter is-active">
            Daftar Membership
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Belum ada paket" description="Admin bisa menambahkan paket dari dashboard admin." />
        ) : (
          <div className="public-packages-grid">
            {items.map((item) => (
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

      <section className="public-faq-inline-grid">
        <article className="panel public-faq-inline-card">
          <strong>Pembayaran tetap sederhana</strong>
          <p>Setelah pilih paket, member bisa lanjut ke pembayaran manual dan upload bukti transfer.</p>
        </article>
        <article className="panel public-faq-inline-card">
          <strong>Status aktif selalu jelas</strong>
          <p>Admin memverifikasi pembayaran, lalu member bisa melihat status aktif dan barcode digital.</p>
        </article>
      </section>
    </div>
  );
};
