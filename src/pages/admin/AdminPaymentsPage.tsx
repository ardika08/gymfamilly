import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, packageService } from '../../services/api';
import type { GymPackage, Membership, User } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

export const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<Membership[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [successModal, setSuccessModal] = useState<{
    memberName: string;
    packageName: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [filter, setFilter] = useState<'semua' | 'menunggu_pembayaran' | 'aktif' | 'kedaluwarsa'>('semua');
  usePageTitle('Riwayat Pembayaran');

  const refresh = () => {
    adminService.payments().then(setPayments);
  };

  useEffect(() => {
    adminService.members().then(setMembers);
    packageService.list().then(setPackages);
    refresh();
  }, []);

  const pendingCount = payments.filter((item) => item.status === 'menunggu_pembayaran').length;
  const aktifCount = payments.filter((item) => item.status === 'aktif').length;

  const filtered = filter === 'semua' ? payments : payments.filter((item) => item.status === filter);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Pembayaran"
        title="Riwayat transaksi Duitku"
        description="Semua transaksi membership via Duitku — status diperbarui otomatis dari webhook."
      />

      {/* Stats */}
      <section className="section-intro-card">
        <div>
          <small>Antrean pembayaran</small>
          <strong>{pendingCount} menunggu konfirmasi</strong>
          <p>Transaksi aktif otomatis setelah pembayaran berhasil dikonfirmasi Duitku.</p>
        </div>
        <div className="section-intro-meta">
          <span>Member aktif</span>
          <strong>{aktifCount}</strong>
        </div>
      </section>

      {/* Tabel transaksi */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Daftar transaksi</h3>
            <p>Urutan terbaru di atas.</p>
          </div>
          <div className="inline-actions">
            {(['semua', 'menunggu_pembayaran', 'aktif', 'kedaluwarsa'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`button-filter ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'semua'
                  ? `Semua (${payments.length})`
                  : f === 'menunggu_pembayaran'
                    ? `Menunggu (${pendingCount})`
                    : f === 'aktif'
                      ? `Aktif (${aktifCount})`
                      : `Kadaluarsa (${payments.filter((p) => p.status === 'kedaluwarsa').length})`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada transaksi"
            description="Transaksi yang sesuai filter akan muncul di sini."
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Paket</th>
                  <th>Status</th>
                  <th>Metode</th>
                  <th>Voucher</th>
                  <th>Mulai</th>
                  <th>Expired</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const member = members.find((u) => u.id === item.user_id);
                  const pkg = packages.find((p) => p.id === item.package_id);
                  const hasDiskon = (item as any).voucher_diskon > 0;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{member?.nama ?? '-'}</strong>
                          <small>{member?.email ?? '-'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="table-primary">
                          <strong>{pkg?.nama_paket ?? '-'}</strong>
                          <small>
                            Rp {((pkg?.harga_promo ?? pkg?.harga_normal) ?? 0).toLocaleString('id-ID')}
                          </small>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <span className="table-chip subtle">
                          {item.payment_method === 'duitku'
                            ? `Duitku${item.payment_channel ? ` · ${item.payment_channel}` : ''}`
                            : (item.payment_method ?? '-')}
                        </span>
                      </td>
                      <td>
                        {hasDiskon ? (
                          <div className="table-primary">
                            <strong style={{ color: '#16a34a' }}>
                              - Rp {(item as any).voucher_diskon.toLocaleString('id-ID')}
                            </strong>
                            <small>Diskon voucher</small>
                          </div>
                        ) : (
                          <span className="table-chip subtle" style={{ opacity: 0.4 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.tanggal_mulai)}</strong>
                          <small>{item.tanggal_mulai ? 'Mulai aktif' : 'Belum aktif'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.tanggal_berakhir)}</strong>
                          <small>{item.tanggal_berakhir ? 'Batas akhir' : '—'}</small>
                        </div>
                      </td>
                      <td>
                        {item.status === 'menunggu_pembayaran' ? (
                          <button
                            type="button"
                            className="table-action-button"
                            title="Aktifkan manual jika webhook Duitku gagal"
                            onClick={async () => {
                              const verified = await adminService.verifyPayment(item.id);
                              setSuccessModal({
                                memberName: member?.nama ?? 'Member',
                                packageName: pkg?.nama_paket ?? 'Membership',
                                startDate: formatDisplayDate(verified.tanggal_mulai),
                                endDate: formatDisplayDate(verified.tanggal_berakhir),
                              });
                              refresh();
                            }}
                          >
                            Aktifkan
                          </button>
                        ) : (
                          <span className="table-chip subtle" style={{ opacity: 0.4 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Success modal */}
      {successModal ? (
        <div className="proof-modal-overlay">
          <div
            className="proof-modal-card success-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="success-modal-badge">Membership Diaktifkan</div>
            <h3>Status member sudah aktif</h3>
            <p>Membership berhasil diaktifkan secara manual.</p>
            <div className="mini-metric-grid">
              <div className="mini-metric">
                <span>Member</span>
                <strong>{successModal.memberName}</strong>
              </div>
              <div className="mini-metric">
                <span>Paket</span>
                <strong>{successModal.packageName}</strong>
              </div>
              <div className="mini-metric">
                <span>Mulai aktif</span>
                <strong>{successModal.startDate}</strong>
              </div>
              <div className="mini-metric">
                <span>Expired</span>
                <strong>{successModal.endDate}</strong>
              </div>
            </div>
            <div className="inline-actions success-modal-actions">
              <button
                type="button"
                className="table-action-button"
                onClick={() => setSuccessModal(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
