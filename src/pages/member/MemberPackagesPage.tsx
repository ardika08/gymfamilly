import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { PackageCard } from '../../components/ui/PackageCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { packageService } from '../../services/api';
import type { GymPackage } from '../../types/models';

export const MemberPackagesPage = () => {
  const [items, setItems] = useState<GymPackage[]>([]);
  usePageTitle('Pilih Paket');

  useEffect(() => {
    packageService.list().then(setItems);
  }, []);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Pilih Paket"
        title="Pilih paket membership"
        description="Setelah pilih paket, lanjutkan ke pembayaran manual."
      />
      <section className="section-intro-card">
        <div>
          <small>Paket tersedia</small>
          <strong>{items.length} pilihan paket</strong>
          <p>Bandingkan harga dan durasi sebelum lanjut ke pembayaran.</p>
        </div>
        <div className="section-intro-meta">
          <span>Status katalog</span>
          <strong>{items.length > 0 ? 'Siap dipilih' : 'Belum tersedia'}</strong>
        </div>
      </section>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Katalog paket member</h3>
            <p>Pilih paket yang paling sesuai.</p>
          </div>
          <span className="table-chip">{items.length} paket</span>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Belum ada paket" description="Admin belum menambahkan paket membership." />
        ) : (
          <div className="card-grid">
            {items.map((item) => (
              <PackageCard
                key={item.id}
                item={item}
                action={
                  <Link to={`/member/payments?package=${item.id}`} className="button-inline">
                    Pilih Paket Ini
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
