import type { GymPackage } from '../../types/models';

interface PackageCardProps {
  item: GymPackage;
  action?: React.ReactNode;
  adminAction?: React.ReactNode;
}

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const PackageCard = ({ item, action, adminAction }: PackageCardProps) => (
  <article className="package-card">
    <div className="package-card-top">
      {adminAction ? <div className="package-card-menu">{adminAction}</div> : null}
      <span className="package-chip">{item.promo_label?.trim() || 'Paket'}</span>
      <h3>{item.nama_paket}</h3>
      <p>{item.deskripsi}</p>
    </div>
    <div className="price-group">
      {item.harga_promo && item.harga_promo < item.harga_normal ? (
        <span className="old-price">{currency.format(item.harga_normal)}</span>
      ) : null}
      <strong>{currency.format(item.harga_promo ?? item.harga_normal)}</strong>
      <small style={{ fontWeight: 'normal', opacity: 0.7 }}>{item.durasi_hari} hari aktif</small>
    </div>
    {action ? <div className="package-action">{action}</div> : null}
  </article>
);
