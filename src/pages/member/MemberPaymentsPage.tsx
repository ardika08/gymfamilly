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
  paymentMethodService,
  voucherService,
} from '../../services/api';
import type { GymPackage, Membership, PaymentMethodSetting, VoucherCheckResult } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

const isImageProof = (value?: string | null) =>
  Boolean(value && (value.startsWith('data:image/') || value.startsWith('/storage/') || value.startsWith('http')));

export const MemberPaymentsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Membership[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BCA Manual');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [paymentProofName, setPaymentProofName] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSetting[]>([]);
  const [copySuccess, setCopySuccess] = useState('');
  const [success, setSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);
  const [paymentMode, setPaymentMode] = useState<'manual' | 'online'>('online');
  const [duitkuMethods, setDuitkuMethods] = useState<{ paymentMethod: string; paymentName: string; paymentImage: string; totalFee: number }[]>([]);
  const [selectedDuitkuMethod, setSelectedDuitkuMethod] = useState('');
  const [duitkuLoading, setDuitkuLoading] = useState(false);
  const [voucherKode, setVoucherKode] = useState('');
  const [voucherResult, setVoucherResult] = useState<VoucherCheckResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [manualVoucherKode, setManualVoucherKode] = useState('');
  const [manualVoucherResult, setManualVoucherResult] = useState<VoucherCheckResult | null>(null);
  const [manualVoucherLoading, setManualVoucherLoading] = useState(false);
  const [manualVoucherError, setManualVoucherError] = useState('');
  const packageQuery = searchParams.get('package');
  usePageTitle('Pembayaran');

  const refresh = () => {
    if (!user) {
      return;
    }
    membershipService.listByUser(user.id).then(setItems);
    membershipService.currentByUser(user.id).then(setCurrentMembership);
  };

  useEffect(() => {
    packageService.list().then((allPackages) => {
      setPackages(allPackages);
      setSelectedPackage(packageQuery ?? String(allPackages[0]?.id ?? ''));
    });
    paymentMethodService.list().then(setPaymentMethods);
  }, [packageQuery]);

  // Reset voucher ketika paket berubah
  useEffect(() => {
    setVoucherKode('');
    setVoucherResult(null);
    setVoucherError('');
    setManualVoucherKode('');
    setManualVoucherResult(null);
    setManualVoucherError('');
  }, [selectedPackage]);

  // Load Duitku payment methods ketika paket berubah
  useEffect(() => {
    if (!selectedPackage || paymentMode !== 'online') return;
    const pkg = packages.find((p) => p.id === Number(selectedPackage));
    if (!pkg) return;
    const amount = pkg.harga_promo ?? pkg.harga_normal;
    duitkuService.getPaymentMethods(amount).then((methods) => {
      setDuitkuMethods(methods);
      if (methods.length > 0 && !selectedDuitkuMethod) {
        setSelectedDuitkuMethod(methods[0].paymentMethod);
      }
    }).catch(() => setDuitkuMethods([]));
  }, [selectedPackage, packages, paymentMode]);

  useEffect(() => {
    refresh();
  }, [user]);

  useEffect(() => {
    const reload = () => paymentMethodService.list().then(setPaymentMethods);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === paymentMethodService.events.dbKey) {
        reload();
      }
    };

    window.addEventListener(paymentMethodService.events.updated, reload);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(paymentMethodService.events.updated, reload);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (paymentProofPreview) {
        window.URL.revokeObjectURL(paymentProofPreview);
      }
    };
  }, [paymentProofPreview]);

  const isExpiringSoon = membershipHelpers.isExpiringSoon(currentMembership);
  const daysRemaining = membershipHelpers.getDaysRemaining(currentMembership);
  const hasActiveMembership = currentMembership?.status === 'aktif';
  const selectedPaymentMethod =
    paymentMethods.find((item) => item.code === paymentMethod) ?? null;

  const handleCopyAccount = async () => {
    if (!selectedPaymentMethod?.accountNumber) {
      return;
    }

    await navigator.clipboard.writeText(selectedPaymentMethod.accountNumber);
    setCopySuccess('Nomor rekening berhasil disalin.');
    window.setTimeout(() => setCopySuccess(''), 2400);
  };

  const handleCheckVoucher = async (kode: string, setter: typeof setVoucherResult, errSetter: typeof setVoucherError, loadSetter: typeof setVoucherLoading) => {
    if (!kode.trim() || !selectedPackage) return;
    loadSetter(true);
    errSetter('');
    setter(null);
    try {
      const result = await voucherService.check(kode.trim(), Number(selectedPackage));
      setter(result);
    } catch (err) {
      errSetter(err instanceof Error ? err.message : 'Kode voucher tidak valid.');
    } finally {
      loadSetter(false);
    }
  };

  const handleDuitkuCheckout = async () => {
    if (hasActiveMembership) {
      setErrorMessage('Membership Anda masih aktif. Checkout baru belum diperbolehkan.');
      setShowBlockedModal(true);
      return;
    }

    if (!selectedPackage || !selectedDuitkuMethod) return;

    setDuitkuLoading(true);
    setErrorMessage('');
    setSuccess('');

    try {
      const result = await duitkuService.checkout(Number(selectedPackage), selectedDuitkuMethod, voucherResult?.kode);

      if (result.payment_url) {
        setSuccess('Transaksi berhasil dibuat. Anda akan diarahkan ke halaman pembayaran...');
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasActiveMembership) {
      setSuccess('');
      setErrorMessage('Membership Anda masih aktif. Checkout paket baru belum diperbolehkan sampai masa aktif saat ini berakhir.');
      setShowBlockedModal(true);
      return;
    }

    if (!user || !selectedPackage || !paymentProof) {
      return;
    }

    try {
      await membershipService.createPaymentReport({
        userId: user.id,
        packageId: Number(selectedPackage),
        paymentMethod,
        paymentProof,
        voucherKode: manualVoucherResult?.kode,
      });
    } catch (error) {
      setSuccess('');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Checkout ditolak. Silakan selesaikan membership aktif Anda terlebih dulu.',
      );
      setShowBlockedModal(true);
      return;
    }

    setPaymentProof(null);
    setPaymentProofPreview('');
    setPaymentProofName('');
    setErrorMessage('');
    setSuccess('Bukti pembayaran berhasil dikirim. Admin akan memverifikasi secara manual.');
    refresh();
  };

  const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setPaymentProof(null);
      setPaymentProofPreview('');
      setPaymentProofName('');
      return;
    }

    setPaymentProof(file);
    setPaymentProofPreview(URL.createObjectURL(file));
    setPaymentProofName(file.name);
  };

  return (
    <div className="stack-lg">
      {isExpiringSoon ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Perpanjang sekarang</span>
            <strong>Membership aktif kamu tinggal {daysRemaining} hari lagi.</strong>
            <p>
              Kirim pembayaran perpanjangan dari halaman ini agar akses masuk gym tetap
              berjalan tanpa jeda.
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
        title="Pilih metode pembayaran"
        description="Bayar online (otomatis aktif) atau transfer manual (verifikasi admin)."
      />

      {hasActiveMembership ? (
        <section className="section-intro-card">
          <div>
            <span className="eyebrow">Aturan membership</span>
            <strong>Checkout baru dikunci selama membership aktif masih berjalan.</strong>
            <p>
              Silakan lanjutkan memakai membership saat ini terlebih dulu. Setelah masa aktif
              berakhir, Anda bisa kembali ke halaman ini untuk memilih paket berikutnya.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(currentMembership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Tanggal berakhir membership aktif</span>
          </div>
        </section>
      ) : null}

      <div className="payment-mode-toggle">
        <button
          type="button"
          className={`button-filter ${paymentMode === 'online' ? 'active' : ''}`}
          onClick={() => setPaymentMode('online')}
        >
          💳 Bayar Online
        </button>
        <button
          type="button"
          className={`button-filter ${paymentMode === 'manual' ? 'active' : ''}`}
          onClick={() => setPaymentMode('manual')}
        >
          🏦 Transfer Manual
        </button>
      </div>

      {paymentMode === 'online' ? (
        <section className="premium-form-shell">
          <div className="premium-form-intro">
            <span className="eyebrow">Pembayaran Online (Duitku)</span>
            <h3>Bayar via VA, QRIS, atau e-wallet — membership langsung aktif otomatis.</h3>
            <p>Pilih paket dan metode pembayaran, lalu klik tombol bayar. Anda akan diarahkan ke halaman pembayaran Duitku.</p>
          </div>

          <section className="panel premium-form-panel">
            {packages.length === 0 ? (
              <EmptyState title="Belum ada paket" description="Admin belum menambahkan paket membership." />
            ) : null}
            <div className="form-grid premium-form-grid">
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
                        {m.paymentName} {m.totalFee > 0 ? `(+Rp ${m.totalFee.toLocaleString('id-ID')})` : ''}
                      </option>
                    ))
                  )}
                </select>
                <small>Virtual Account, QRIS, GoPay, OVO, dan lainnya tersedia.</small>
              </label>
              {/* Voucher input - Duitku */}
              <div className="field-span-2 voucher-input-row">
                <label style={{marginBottom: 0}}>
                  <span>Kode Voucher <small style={{fontWeight:'normal'}}>(opsional)</small></span>
                  <div className="voucher-input-group">
                    <input
                      type="text"
                      placeholder="Contoh: GYM20"
                      value={voucherKode}
                      onChange={(e) => { setVoucherKode(e.target.value.toUpperCase()); setVoucherResult(null); setVoucherError(''); }}
                      disabled={hasActiveMembership}
                    />
                    <button
                      type="button"
                      className="button-filter"
                      onClick={() => handleCheckVoucher(voucherKode, setVoucherResult, setVoucherError, setVoucherLoading)}
                      disabled={voucherLoading || !voucherKode.trim() || hasActiveMembership}
                    >
                      {voucherLoading ? '...' : 'Pakai'}
                    </button>
                  </div>
                </label>
                {voucherError ? <p className="form-error">{voucherError}</p> : null}
                {voucherResult ? (
                  <div className="voucher-success-card">
                    <strong>🎉 Voucher berhasil!</strong>
                    <span>{voucherResult.deskripsi ?? voucherResult.kode}</span>
                    <div className="voucher-discount-row">
                      <span>Diskon: <strong>- Rp {voucherResult.diskon.toLocaleString('id-ID')}</strong></span>
                      <span>Harga akhir: <strong>Rp {voucherResult.harga_akhir.toLocaleString('id-ID')}</strong></span>
                      {voucherResult.bonus_days > 0 && <span>+{voucherResult.bonus_days} hari bonus</span>}
                    </div>
                  </div>
                ) : null}
              </div>
              {success ? <p className="form-success field-span-2">{success}</p> : null}
              <div className="form-actions-row field-span-2">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleDuitkuCheckout}
                  disabled={duitkuLoading || hasActiveMembership || !selectedDuitkuMethod}
                >
                  {duitkuLoading ? 'Memproses...' : 'Bayar Sekarang'}
                </button>
                <span className="form-helper-note">
                  Membership otomatis aktif setelah pembayaran berhasil dikonfirmasi.
                </span>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {paymentMode === 'manual' ? (
      <section className="premium-form-shell">
        <div className="premium-form-intro">
          <span className="eyebrow">Alur pembayaran manual</span>
          <h3>Kirim bukti transfer agar admin bisa verifikasi lebih cepat.</h3>
          <p>Pilih paket, tentukan metode transfer, lalu upload bukti pembayaran.</p>
          <div className="form-stat-card">
            <small>Riwayat laporan</small>
            <strong>{items.length}</strong>
          </div>
        </div>

        <section className="panel premium-form-panel">
          {packages.length === 0 ? (
            <EmptyState title="Belum ada paket" description="Admin belum menambahkan paket membership." />
          ) : null}
          <form className="form-grid premium-form-grid" onSubmit={handleSubmit}>
            <label>
              <span>Pilih Paket</span>
              <select
                value={selectedPackage}
                onChange={(event) => setSelectedPackage(event.target.value)}
                required
                disabled={hasActiveMembership || packages.length === 0}
              >
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama_paket}
                  </option>
                ))}
              </select>
              <small>Pilih paket yang benar agar masa aktif dihitung sesuai durasi membership.</small>
            </label>
            <label>
              <span>Metode Pembayaran</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={hasActiveMembership}
              >
                {paymentMethods.map((method) => (
                  <option key={method.code} value={method.code}>
                    {method.label}
                  </option>
                ))}
              </select>
              <small>Nama metode ini akan terlihat oleh admin saat proses verifikasi.</small>
            </label>
            {selectedPaymentMethod ? (
              <div className="field-span-2 payment-account-member-card">
                <div className="payment-account-member-copy">
                  <small>Transfer ke rekening</small>
                  <strong>{selectedPaymentMethod.label}</strong>
                  <div className="payment-account-number-row">
                    <code>{selectedPaymentMethod.accountNumber || 'Admin belum mengisi nomor rekening'}</code>
                    <button
                      type="button"
                      className="button-filter"
                      onClick={handleCopyAccount}
                      disabled={!selectedPaymentMethod.accountNumber}
                    >
                      Copy
                    </button>
                  </div>
                  <span className="form-helper-note">
                    {selectedPaymentMethod.accountName
                      ? `a.n. ${selectedPaymentMethod.accountName}`
                      : 'Nama pemilik rekening belum diisi admin.'}
                  </span>
                  {copySuccess ? <span className="form-success">{copySuccess}</span> : null}
                </div>
              </div>
            ) : null}
            {/* Voucher input - Manual */}
            <div className="field-span-2 voucher-input-row">
              <label style={{marginBottom: 0}}>
                <span>Kode Voucher <small style={{fontWeight:'normal'}}>(opsional)</small></span>
                <div className="voucher-input-group">
                  <input
                    type="text"
                    placeholder="Contoh: GYM20"
                    value={manualVoucherKode}
                    onChange={(e) => { setManualVoucherKode(e.target.value.toUpperCase()); setManualVoucherResult(null); setManualVoucherError(''); }}
                    disabled={hasActiveMembership}
                  />
                  <button
                    type="button"
                    className="button-filter"
                    onClick={() => handleCheckVoucher(manualVoucherKode, setManualVoucherResult, setManualVoucherError, setManualVoucherLoading)}
                    disabled={manualVoucherLoading || !manualVoucherKode.trim() || hasActiveMembership}
                  >
                    {manualVoucherLoading ? '...' : 'Pakai'}
                  </button>
                </div>
              </label>
              {manualVoucherError ? <p className="form-error">{manualVoucherError}</p> : null}
              {manualVoucherResult ? (
                <div className="voucher-success-card">
                  <strong>🎉 Voucher berhasil!</strong>
                  <span>{manualVoucherResult.deskripsi ?? manualVoucherResult.kode}</span>
                  <div className="voucher-discount-row">
                    <span>Diskon: <strong>- Rp {manualVoucherResult.diskon.toLocaleString('id-ID')}</strong></span>
                    <span>Harga akhir: <strong>Rp {manualVoucherResult.harga_akhir.toLocaleString('id-ID')}</strong></span>
                    {manualVoucherResult.bonus_days > 0 && <span>+{manualVoucherResult.bonus_days} hari bonus</span>}
                  </div>
                </div>
              ) : null}
            </div>
            <label className="field-span-2">
              <span>Upload Bukti Transfer</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                required={!paymentProof}
                disabled={hasActiveMembership || packages.length === 0}
              />
              <small>Upload gambar bukti transfer agar admin bisa mengecek pembayaran lebih cepat.</small>
            </label>
            {paymentProofPreview ? (
              <div className="field-span-2 proof-upload-preview">
                <div className="proof-upload-card">
                  <div className="proof-upload-copy">
                    <strong>{paymentProofName || 'Bukti transfer terunggah'}</strong>
                    <small>Pastikan nominal dan nama pengirim terlihat jelas pada gambar.</small>
                  </div>
                  <img src={paymentProofPreview} alt="Preview bukti transfer" className="proof-preview-image" />
                </div>
              </div>
            ) : null}
            {success ? <p className="form-success field-span-2">{success}</p> : null}
            <div className="form-actions-row field-span-2">
              <button type="submit" className="button-primary">
                {packages.length === 0
                  ? 'Menunggu Paket'
                  : hasActiveMembership
                    ? 'Lihat Alasan Penolakan'
                    : 'Kirim Bukti Pembayaran'}
              </button>
              <span className="form-helper-note">
                {packages.length === 0
                  ? 'Tambahkan paket dulu dari dashboard admin.'
                  : hasActiveMembership
                  ? 'Checkout baru akan dibuka kembali setelah membership aktif Anda selesai.'
                  : 'Admin akan mengubah status membership setelah pengecekan manual.'}
              </span>
            </div>
          </form>
        </section>
      </section>
      ) : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Riwayat membership & pembayaran</h3>
            <p>Lihat semua laporan pembayaran yang pernah dikirim.</p>
          </div>
          <span className="table-chip">Pembayaran siap</span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="Belum ada laporan pembayaran"
            description="Pilih paket dulu lalu kirim bukti transfer agar admin bisa mengaktifkan membership."
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
                  <th>Tanggal Expired</th>
                  <th>Bukti</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pkg = packages.find((entry) => entry.id === item.package_id);
                  const expiringSoon = membershipHelpers.isExpiringSoon(item);
                  const daysRemaining = membershipHelpers.getDaysRemaining(item);
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
                            {item.tanggal_mulai ? 'Mulai membership' : 'Menunggu verifikasi'}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.tanggal_berakhir)}</strong>
                          <small>
                            {expiringSoon
                              ? `Sisa ${daysRemaining} hari`
                              : item.tanggal_berakhir
                                ? 'Batas akhir membership'
                                : 'Belum aktif'}
                          </small>
                        </div>
                      </td>
                      <td>
                        {isImageProof(item.payment_proof) ? (
                          <div className="table-proof-preview">
                            <img
                              src={item.payment_proof ?? ''}
                              alt={`Bukti transfer ${pkg?.nama_paket ?? 'membership'}`}
                              className="table-proof-image"
                            />
                            <small>Bukti gambar</small>
                          </div>
                        ) : (
                          <code className="proof-code">{item.payment_proof ?? '-'}</code>
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

      {showBlockedModal ? (
        <div className="proof-modal-overlay" onClick={() => setShowBlockedModal(false)}>
          <div
            className="proof-modal-card success-modal-card blocked-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="success-modal-badge blocked-modal-badge">Checkout Ditolak</div>
            <h3>Membership aktif Anda masih berjalan.</h3>
            <p>
              {errorMessage ||
                'Sistem menolak checkout baru karena Anda masih memiliki membership aktif yang belum berakhir.'}
            </p>
            <p className="form-helper-note">
              Setelah membership saat ini selesai, Anda bisa kembali ke halaman pembayaran
              untuk mengambil paket baru tanpa kebingungan.
            </p>
            <div className="inline-actions success-modal-actions">
              <button type="button" className="button-primary" onClick={() => setShowBlockedModal(false)}>
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
