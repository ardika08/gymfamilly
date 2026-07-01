import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  duitkuService,
  membershipHelpers,
  membershipService,
  packageService,
  voucherService,
} from '../../services/api';
import type { GymPackage, Membership, VoucherCheckResult } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

export const MemberPaymentsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Membership[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);

  // Duitku
  const [duitkuMethods, setDuitkuMethods] = useState<
    { paymentMethod: string; paymentName: string; paymentImage: string; totalFee: number }[]
  >([]);
  const [selectedDuitkuMethod, setSelectedDuitkuMethod] = useState('');
  const [duitkuLoading, setDuitkuLoading] = useState(false);

  // Voucher
  const [voucherKode, setVoucherKode] = useState('');
  const [voucherResult, setVoucherResult] = useState<VoucherCheckResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  // UI feedback
  const [success, setSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  const packageQuery = searchParams.get('package');
  usePageTitle('Pembayaran');

  const refresh = () => {
    if (!user) return;
    membershipService.listByUser(user.id).then(setItems);
    membershipService.currentByUser(user.id).then(setCurrentMembership);
  };

  useEffect(() => {
    packageService.list().then((allPackages) => {
      setPackages(allPackages);
      setSelectedPackage(packageQuery ?? String(allPackages[0]?.id ?? ''));
    });
  }, [packageQuery]);

  // Reset voucher & reload Duitku methods saat paket berubah
  useEffect(() => {
    setVoucherKode('');
    setVoucherResult(null);
    setVoucherError('');

    if (!selectedPackage) return;
    const pkg = packages.find((p) => p.id === Number(selectedPackage));
    if (!pkg) return;
    const amount = pkg.harga_promo ?? pkg.harga_normal;
    duitkuService
      .getPaymentMethods(amount)
      .then((methods) => {
        setDuitkuMethods(methods);
        if (methods.length > 0) setSelectedDuitkuMethod(methods[0].paymentMethod);
      })
      .catch(() => setDuitkuMethods([]));
  }, [selectedPackage, packages]);

  useEffect(() => {
    refresh();
  }, [user]);

  const isExpiringSoon = membershipHelpers.isExpiringSoon(currentMembership);
  const daysRemaining = membershipHelpers.getDaysRemaining(currentMembership);
  const hasActiveMembership = currentMembership?.status === 'aktif';

  const handleCheckVoucher = async () => {
    if (!voucherKode.trim() || !selectedPackage) return;
    setVoucherLoading(true);
    setVoucherError('');
    setVoucherResult(null);
    try {
      const result = await voucherService.check(voucherKode.trim(), Number(selectedPackage));
      setVoucherResult(result);
    } catch (err) {
      setVoucherError(err instanceof Error ? err.message : 'Kode voucher tidak valid.');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (hasActiveMembership) {
      setErrorMessage('Membership kamu masih aktif. Checkout baru belum diperbolehkan.');
      setShowBlockedModal(true);
      return;
    }
    if (!selectedPackage || !selectedDuitkuMethod) return;

    setDuitkuLoading(true);
    setErrorMessage('');
    setSuccess('');

    try {
      const result = await duitkuService.checkout(
        Number(selectedPackage),
        selectedDuitkuMethod,
        voucherResult?.kode,
      );

      if (result.payment_url) {
        setSuccess('Transaksi berhasil dibuat. Kamu akan diarahkan ke halaman pembayaran...');
        window.setTimeout(() => {
          window.open(result.payment_url!, '_blank');
        }, 1000);
      } else {
        setSuccess('Transaksi dibuat. Gunakan informasi berikut untuk menyelesaikan pembayaran.');
      }

      refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Gagal membuat transaksi. Silakan coba lagi.',
      );
      setShowBlockedModal(true);
    } finally {
      setDuitkuLoading(false);
    }
  };

  // Harga setelah voucher
  const selectedPkg = packages.find((p) => p.id === Number(selectedPackage));
  const basePrice = selectedPkg ? (selectedPkg.harga_promo ?? selectedPkg.harga_normal) : 0;
  const finalPrice = voucherResult ? voucherResult.harga_akhir : basePrice;

  return (
    <div className="stack-lg">
      {isExpiringSoon ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Perpanjang sekarang</span>
            <strong>Membership kamu tinggal {daysRemaining} hari lagi.</strong>
            <p>
              Bayar perpanjangan dari halaman ini agar akses masuk gym tidak terputus.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(currentMembership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Tanggal akhir membership aktif</span>
          </div>
        </section>
      ) : null}

      <PageHeader
        eyebrow="Pembayaran"
        title="Bayar membership online"
        description="Pilih paket dan metode pembayaran. Membership aktif otomatis setelah pembayaran berhasil."
      />

      {hasActiveMembership ? (
        <section className="section-intro-card">
          <div>
            <span className="eyebrow">Aturan membership</span>
            <strong>Checkout baru dikunci selama membership aktif masih berjalan.</strong>
            <p>
              Setelah masa aktif berakhir, kamu bisa kembali ke halaman ini untuk memilih paket
              berikutnya.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(currentMembership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Tanggal berakhir membership aktif</span>
          </div>
        </section>
      ) : null}

      <section className="premium-form-shell">
        <div className="premium-form-intro">
          <span className="eyebrow">Pembayaran Online</span>
          <h3>VA, QRIS, GoPay, OVO, dan lainnya — membership langsung aktif otomatis.</h3>
          <p>Pilih paket, masukkan kode voucher jika ada, lalu klik bayar.</p>
        </div>

        <section className="panel premium-form-panel">
          {packages.length === 0 ? (
            <EmptyState title="Belum ada paket" description="Admin belum menambahkan paket membership." />
          ) : null}

          <div className="form-grid premium-form-grid">
            {/* Pilih Paket */}
            <label>
              <span>Pilih Paket</span>
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                required
                disabled={hasActiveMembership || packages.length === 0}
              >
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama_paket} — Rp {(item.harga_promo ?? item.harga_normal).toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            </label>

            {/* Metode Pembayaran */}
            <label>
              <span>Metode Pembayaran</span>
              <select
                value={selectedDuitkuMethod}
                onChange={(e) => setSelectedDuitkuMethod(e.target.value)}
                disabled={hasActiveMembership || duitkuMethods.length === 0}
              >
                {duitkuMethods.length === 0 ? (
                  <option value="">Memuat metode pembayaran...</option>
                ) : (
                  duitkuMethods.map((m) => (
                    <option key={m.paymentMethod} value={m.paymentMethod}>
                      {m.paymentName}
                      {m.totalFee > 0 ? ` (+Rp ${m.totalFee.toLocaleString('id-ID')})` : ''}
                    </option>
                  ))
                )}
              </select>
            </label>

            {/* Voucher */}
            <div className="field-span-2 voucher-input-row">
              <label style={{ marginBottom: 0 }}>
                <span>
                  Kode Voucher <small style={{ fontWeight: 'normal' }}>(opsional)</small>
                </span>
                <div className="voucher-input-group">
                  <input
                    type="text"
                    placeholder="Contoh: GYM20"
                    value={voucherKode}
                    onChange={(e) => {
                      setVoucherKode(e.target.value.toUpperCase());
                      setVoucherResult(null);
                      setVoucherError('');
                    }}
                    disabled={hasActiveMembership}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckVoucher()}
                  />
                  <button
                    type="button"
                    className="button-filter"
                    onClick={handleCheckVoucher}
                    disabled={voucherLoading || !voucherKode.trim() || hasActiveMembership}
                  >
                    {voucherLoading ? '...' : 'Pakai'}
                  </button>
                </div>
              </label>
              {voucherError ? <p className="form-error">{voucherError}</p> : null}
              {voucherResult ? (
                <div className="voucher-success-card">
                  <strong>🎉 Voucher berhasil dipakai!</strong>
                  <span>{voucherResult.deskripsi ?? voucherResult.kode}</span>
                  <div className="voucher-discount-row">
                    <span>
                      Diskon:{' '}
                      <strong>- Rp {voucherResult.diskon.toLocaleString('id-ID')}</strong>
                    </span>
                    <span>
                      Harga akhir:{' '}
                      <strong>Rp {voucherResult.harga_akhir.toLocaleString('id-ID')}</strong>
                    </span>
                    {voucherResult.bonus_days > 0 && (
                      <span>+{voucherResult.bonus_days} hari bonus masa aktif</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Ringkasan harga */}
            {selectedPkg ? (
              <div className="field-span-2 payment-account-member-card">
                <div className="payment-account-member-copy">
                  <small>Ringkasan pembayaran</small>
                  <strong>{selectedPkg.nama_paket}</strong>
                  <div className="payment-account-number-row">
                    {voucherResult && voucherResult.diskon > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <code style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                          Rp {basePrice.toLocaleString('id-ID')}
                        </code>
                        <code style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                          Rp {finalPrice.toLocaleString('id-ID')}
                        </code>
                      </div>
                    ) : (
                      <code>Rp {basePrice.toLocaleString('id-ID')}</code>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {success ? <p className="form-success field-span-2">{success}</p> : null}

            <div className="form-actions-row field-span-2">
              <button
                type="button"
                className="button-primary"
                onClick={handleCheckout}
                disabled={duitkuLoading || hasActiveMembership || !selectedDuitkuMethod || packages.length === 0}
              >
                {duitkuLoading
                  ? 'Memproses...'
                  : `Bayar Rp ${finalPrice.toLocaleString('id-ID')}`}
              </button>
              <span className="form-helper-note">
                Membership otomatis aktif setelah pembayaran berhasil dikonfirmasi.
              </span>
            </div>
          </div>
        </section>
      </section>

      {/* Riwayat */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Riwayat membership</h3>
            <p>Semua transaksi membership kamu.</p>
          </div>
          <span className="table-chip">{items.length} transaksi</span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi"
            description="Transaksi pembayaran kamu akan muncul di sini setelah checkout."
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Paket</th>
                  <th>Status</th>
                  <th>Metode</th>
                  <th>Tanggal Mulai</th>
                  <th>Expired</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pkg = packages.find((entry) => entry.id === item.package_id);
                  const expiringSoon = membershipHelpers.isExpiringSoon(item);
                  const days = membershipHelpers.getDaysRemaining(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{pkg?.nama_paket ?? '-'}</strong>
                          <small>{pkg?.deskripsi ?? 'Paket membership Gym Familly'}</small>
                        </div>
                      </td>
                      <td>
                        {expiringSoon ? (
                          <StatusBadge status={item.status} label="Segera berakhir" tone="warning" />
                        ) : (
                          <StatusBadge status={item.status} />
                        )}
                      </td>
                      <td>
                        <span className="table-chip subtle">{item.payment_method ?? '-'}</span>
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.tanggal_mulai)}</strong>
                          <small>
                            {item.tanggal_mulai ? 'Mulai membership' : 'Menunggu pembayaran'}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.tanggal_berakhir)}</strong>
                          <small>
                            {expiringSoon
                              ? `Sisa ${days} hari`
                              : item.tanggal_berakhir
                                ? 'Batas akhir membership'
                                : 'Belum aktif'}
                          </small>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal blocked */}
      {showBlockedModal ? (
        <div className="proof-modal-overlay" onClick={() => setShowBlockedModal(false)}>
          <div
            className="proof-modal-card success-modal-card blocked-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="success-modal-badge blocked-modal-badge">Checkout Ditolak</div>
            <h3>Membership aktif kamu masih berjalan.</h3>
            <p>
              {errorMessage ||
                'Sistem menolak checkout baru karena kamu masih memiliki membership aktif.'}
            </p>
            <p className="form-helper-note">
              Setelah membership saat ini selesai, kamu bisa kembali ke halaman ini untuk memilih
              paket baru.
            </p>
            <div className="inline-actions success-modal-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => setShowBlockedModal(false)}
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
