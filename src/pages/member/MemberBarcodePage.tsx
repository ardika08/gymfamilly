import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { membershipHelpers, membershipService, packageService } from '../../services/api';
import type { GymPackage, Membership } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

export const MemberBarcodePage = () => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [currentPackage, setCurrentPackage] = useState<GymPackage | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [qrImage, setQrImage] = useState('');
  usePageTitle('Barcode Member');

  useEffect(() => {
    if (!user) {
      return;
    }
    membershipService.barcode().then((payload) => {
      const current = payload?.membership ?? null;
      setMembership(current);
      setQrValue(payload?.barcode ?? '');
      if (current) {
        packageService.get(current.package_id).then(setCurrentPackage);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!qrValue) {
      setQrImage('');
      return;
    }

    QRCode.toDataURL(qrValue, {
      width: 300,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    }).then(setQrImage);
  }, [qrValue]);

  const isExpiringSoon = membershipHelpers.isExpiringSoon(membership);
  const daysRemaining = membershipHelpers.getDaysRemaining(membership);

  if (!membership) {
    return (
      <div className="stack-lg">
        <PageHeader
          eyebrow="Barcode"
          title="Barcode digital kamu"
          description="Tunjukkan QR code ini ke petugas saat masuk gym."
        />
        <EmptyState
          title="Belum ada barcode aktif"
          description="Selesaikan pembayaran membership untuk mengaktifkan barcode."
        />
      </div>
    );
  }

  if (membership.status === 'kedaluwarsa') {
    return (
      <div className="stack-lg">
        <PageHeader
          eyebrow="Barcode"
          title="Barcode belum bisa dipakai"
          description="Perpanjang membership untuk mengaktifkan barcode kembali."
        />
        <section className="panel">
          <div className="stack-lg">
            <StatusBadge status={membership.status} />
            <h3>Maaf, membership Anda sudah berakhir.</h3>
            <p>
              Silakan perpanjang membership Anda terlebih dulu. Setelah pembayaran
              diverifikasi admin, barcode akan aktif kembali untuk check-in.
            </p>
            <div className="inline-actions">
              <Link to="/member/packages" className="button-primary">
                Perpanjang Membership
              </Link>
              <Link to="/member/payments" className="button-secondary">
                Lanjut ke Pembayaran
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Barcode"
        title="Tunjukkan barcode saat check-in"
        description="Gunakan barcode ini saat check-in."
      />
      {isExpiringSoon ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Reminder perpanjangan</span>
            <strong>Membership kamu tinggal {daysRemaining} hari lagi.</strong>
            <p>
              Barcode masih aktif untuk sekarang, tetapi segera perpanjang membership agar
              akses check-in tidak terputus.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(membership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Tanggal akhir membership aktif</span>
          </div>
        </section>
      ) : null}
      <section className="barcode-premium-shell">
        <div className="barcode-card large premium">
          <div className="barcode-card-head">
            <div>
              <span>Member Gym Familly</span>
              <strong>{user?.nama ?? 'Member'}</strong>
            </div>
            {isExpiringSoon ? (
              <StatusBadge status={membership.status} label="Segera berakhir" tone="warning" />
            ) : (
              <StatusBadge status={membership.status} />
            )}
          </div>
          <div className="barcode-card-body">
            <div className="barcode-qr-frame">
              {qrImage ? (
                <img src={qrImage} alt="QR code member" className="member-qr-image" />
              ) : (
                <div className="barcode-lines" />
              )}
            </div>
            <div className="barcode-code-block">
              <span className="barcode-code-label">Payload QR</span>
              <strong className="barcode-code">{qrValue || `GF-${String(user?.id).padStart(4, '0')}-${membership.id}`}</strong>
            </div>
            <p className="barcode-package-name">{currentPackage?.nama_paket ?? '-'}</p>
          </div>
          <div className="barcode-meta-grid">
            <div className="barcode-meta-card">
              <small>Mulai</small>
              <strong>{formatDisplayDate(membership.tanggal_mulai)}</strong>
            </div>
            <div className="barcode-meta-card">
              <small>Berakhir</small>
              <strong>{formatDisplayDate(membership.tanggal_berakhir)}</strong>
            </div>
          </div>
        </div>

        <article className="panel barcode-side-panel">
          <div className="barcode-side-header">
            <div>
              <h3>Status akses check-in</h3>
              <p>Tunjukkan QR code ini saat datang ke gym.</p>
            </div>
            <StatusBadge
              status={membership.status}
              label={isExpiringSoon ? 'Segera diperpanjang' : 'Siap check-in'}
              tone={isExpiringSoon ? 'warning' : undefined}
            />
          </div>
          <div className="barcode-side-grid">
            <div className="barcode-side-card">
              <span>Paket aktif</span>
              <strong>{currentPackage?.nama_paket ?? '-'}</strong>
            </div>
            <div className="barcode-side-card">
              <span>Status akses</span>
              <strong>{isExpiringSoon ? 'Perlu perpanjangan' : 'Siap dipakai'}</strong>
            </div>
            <div className="barcode-side-card">
              <span>Sisa masa aktif</span>
              <strong>{daysRemaining ?? '-'} hari</strong>
            </div>
            <div className="barcode-side-card">
              <span>Berlaku sampai</span>
              <strong>{formatDisplayDate(membership.tanggal_berakhir)}</strong>
            </div>
          </div>
          <div className="barcode-side-note">
            QR code ini bersifat personal dan hanya berlaku untuk satu member dengan satu kali
            check-in per hari.
          </div>
          <div className="inline-actions barcode-side-actions">
            <Link to="/member/packages" className="button-primary">
              Lihat Paket
            </Link>
            <Link to="/member/payments" className="button-secondary">
              Riwayat Pembayaran
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
};
