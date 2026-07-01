import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, packageService, paymentMethodService } from '../../services/api';
import type { GymPackage, Membership, PaymentMethodSetting, User } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

const isImageProof = (value?: string | null) =>
  Boolean(value && (value.startsWith('data:image/') || value.startsWith('/storage/') || value.startsWith('http')));

export const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<Membership[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [previewProof, setPreviewProof] = useState<{
    src: string;
    memberName: string;
  } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSetting[]>([]);
  const [successModal, setSuccessModal] = useState<{
    memberName: string;
    packageName: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  usePageTitle('Verifikasi Pembayaran');

  const refresh = () => {
    adminService.payments().then(setPayments);
  };

  const loadPaymentMethods = () => {
    paymentMethodService.list().then(setPaymentMethods);
  };

  useEffect(() => {
    adminService.members().then(setMembers);
    packageService.list().then(setPackages);
    loadPaymentMethods();
    refresh();
  }, []);

  useEffect(() => {
    const reload = () => loadPaymentMethods();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === paymentMethodService.events.dbKey) {
        loadPaymentMethods();
      }
    };

    window.addEventListener(paymentMethodService.events.updated, reload);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(paymentMethodService.events.updated, reload);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const pendingCount = payments.filter(
    (item) => item.status === 'menunggu_pembayaran',
  ).length;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Pembayaran"
        title="Verifikasi transfer manual"
        description="Admin mengaktifkan membership setelah memeriksa bukti transfer dari member."
      />
      <section className="section-intro-card">
        <div>
          <small>Antrean pembayaran</small>
          <strong>{pendingCount} butuh verifikasi</strong>
          <p>Review bukti transfer, validasi paket, lalu aktifkan membership dari tabel ini.</p>
        </div>
        <div className="section-intro-meta">
          <span>Total laporan</span>
          <strong>{payments.length}</strong>
        </div>
      </section>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Nomor rekening tujuan</h3>
            <p>Ubah rekening per metode transfer agar langsung tampil di halaman member.</p>
          </div>
          <span className="table-chip">Sinkron antar tab</span>
        </div>
        <div className="payment-account-grid">
          {paymentMethods.map((method) => (
            <div key={method.code} className="payment-account-card">
              <div className="payment-account-heading">
                <strong>{method.label}</strong>
                <small>Metode transfer manual</small>
              </div>
              <label>
                <span>Nomor Rekening</span>
                <input
                  type="text"
                  value={method.accountNumber}
                  placeholder="Contoh: 1234567890"
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      current.map((item) =>
                        item.code === method.code
                          ? { ...item, accountNumber: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <span>Nama Pemilik Rekening</span>
                <input
                  type="text"
                  value={method.accountName ?? ''}
                  placeholder="Contoh: Gym Familly"
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      current.map((item) =>
                        item.code === method.code
                          ? { ...item, accountName: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <div className="form-actions-row payment-account-actions">
          <button
            type="button"
            className="button-primary"
            onClick={async () => {
              const saved = await paymentMethodService.save(paymentMethods);
              setPaymentMethods(saved);
            }}
          >
            Simpan Rekening
          </button>
          <span className="form-helper-note">
            Member akan melihat rekening ini sesuai metode pembayaran yang dipilih.
          </span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Daftar pembayaran member</h3>
            <p>Urutan terbaru muncul di bagian atas.</p>
          </div>
          <span className="table-chip">Verifikasi manual</span>
        </div>
        {payments.length === 0 ? (
          <EmptyState
            title="Belum ada pembayaran"
            description="Laporan pembayaran dari member akan muncul di sini."
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
                  <th>Bukti</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((item) => {
                  const member = members.find((entry) => entry.id === item.user_id);
                  const pkg = packages.find((entry) => entry.id === item.package_id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{member?.nama ?? '-'}</strong>
                          <small>{member?.email ?? 'Email belum tersedia'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="table-primary">
                          <strong>{pkg?.nama_paket ?? '-'}</strong>
                          <small>{pkg?.deskripsi ?? 'Paket membership'}</small>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <span className="table-chip subtle">{item.payment_method ?? '-'}</span>
                      </td>
                      <td>
                        {isImageProof(item.payment_proof) ? (
                          <button
                            type="button"
                            className="table-proof-preview button-reset"
                            onClick={() =>
                              setPreviewProof({
                                src: item.payment_proof ?? '',
                                memberName: member?.nama ?? 'Member',
                              })
                            }
                          >
                            <img
                              src={item.payment_proof ?? ''}
                              alt={`Bukti transfer ${member?.nama ?? 'member'}`}
                              className="table-proof-image"
                            />
                            <small>Bukti gambar</small>
                          </button>
                        ) : (
                          <code className="proof-code">{item.payment_proof ?? '-'}</code>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-action-button"
                          disabled={item.status === 'aktif'}
                          onClick={async () => {
                            const verified = await adminService.verifyPayment(item.id);
                            setSuccessModal({
                              memberName: member?.nama ?? 'Member',
                              packageName: pkg?.nama_paket ?? 'Membership Gym Familly',
                              startDate: formatDisplayDate(verified.tanggal_mulai),
                              endDate: formatDisplayDate(verified.tanggal_berakhir),
                            });
                            refresh();
                          }}
                        >
                          {item.status === 'aktif' ? 'Sudah Aktif' : 'Verifikasi'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {previewProof ? (
        <div className="proof-modal-overlay" onClick={() => setPreviewProof(null)}>
          <div className="proof-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-toolbar">
              <div>
                <h3>Preview bukti transfer</h3>
                <p>{previewProof.memberName}</p>
              </div>
              <button
                type="button"
                className="button-filter"
                onClick={() => setPreviewProof(null)}
              >
                Tutup
              </button>
            </div>
            <img
              src={previewProof.src}
              alt={`Preview bukti transfer ${previewProof.memberName}`}
              className="proof-modal-image"
            />
          </div>
        </div>
      ) : null}
      {successModal ? (
        <div className="proof-modal-overlay">
          <div className="proof-modal-card success-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="success-modal-badge">Verifikasi Berhasil</div>
            <h3>Status member sudah aktif</h3>
            <p>
              Pembayaran berhasil diverifikasi. Member sekarang sudah bisa memakai barcode
              untuk check-in di Gym Familly.
            </p>
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
