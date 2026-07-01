import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  attendanceService,
  membershipHelpers,
  membershipService,
  packageService,
} from '../../services/api';
import type { Attendance, GymPackage, Membership } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

const WEEKDAY_LABELS = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'];

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const buildWeeklyActivity = (attendances: Attendance[]) => {
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const counts = new Array(7).fill(0);

  attendances.forEach((attendance) => {
    if (!attendance.waktu_scan || attendance.hasil === 'ditolak') {
      return;
    }

    const scannedAt = new Date(attendance.waktu_scan);

    if (Number.isNaN(scannedAt.getTime()) || scannedAt < weekStart || scannedAt >= weekEnd) {
      return;
    }

    counts[scannedAt.getDay()] += 1;
  });

  const maxCount = Math.max(...counts, 1);

  return counts.map((count, index) => ({
    label: WEEKDAY_LABELS[index],
    count,
    height: count === 0 ? 24 : 24 + Math.round((count / maxCount) * 62),
  }));
};

export const MemberDashboardPage = () => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [currentPackage, setCurrentPackage] = useState<GymPackage | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  usePageTitle('Dashboard Member');

  useEffect(() => {
    if (!user) {
      return;
    }

    membershipService.currentByUser(user.id).then((current) => {
      setMembership(current);
      if (current) {
        packageService.get(current.package_id).then(setCurrentPackage);
      }
    });
    attendanceService.listByUser(user.id).then((items) => {
      setAttendances(items);
      setAttendanceCount(items.filter((item) => item.hasil !== 'ditolak').length);
    });
  }, [user]);

  const weeklyActivity = buildWeeklyActivity(attendances);
  const isExpired = membership?.status === 'kedaluwarsa';
  const isExpiringSoon = membershipHelpers.isExpiringSoon(membership);
  const daysRemaining = membershipHelpers.getDaysRemaining(membership);

  return (
    <div className="stack-lg">
      {isExpired ? (
        <section className="section-intro-card">
          <div>
            <span className="eyebrow">Perlu perpanjangan</span>
            <strong>Membership kamu sudah berakhir.</strong>
            <p>
              Barcode tidak bisa dipakai untuk check-in sampai kamu memperpanjang membership
              dan pembayaran diverifikasi admin.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(membership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Tanggal berakhir membership terakhir</span>
          </div>
        </section>
      ) : isExpiringSoon ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Segera berakhir</span>
            <strong>Membership kamu akan berakhir dalam {daysRemaining} hari.</strong>
            <p>
              Supaya barcode tetap aktif saat datang ke gym, segera pilih paket dan kirim
              pembayaran perpanjangan.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>{formatDisplayDate(membership?.tanggal_berakhir)}</strong>
            <span className="form-helper-note">Batas akhir membership saat ini</span>
          </div>
        </section>
      ) : null}

      <section className="member-hero">
        <div>
          <span className="eyebrow">Ringkasan member</span>
          <h2>Semua kebutuhan membership ada di satu dashboard.</h2>
          <p>Cek masa aktif, pembayaran, barcode, dan pesan admin dari satu tempat.</p>
        </div>
        <div className="member-hero-card">
          <small>Status membership</small>
          {membership ? (
            isExpiringSoon ? (
              <StatusBadge status={membership.status} label="Segera berakhir" tone="warning" />
            ) : (
              <StatusBadge status={membership.status} />
            )
          ) : (
            <strong>Belum aktif</strong>
          )}
          <p>{currentPackage?.nama_paket ?? 'Pilih paket untuk mulai membership'}</p>
        </div>
      </section>

      <PageHeader
        eyebrow="Dashboard Member"
        title={`Selamat datang, ${user?.nama ?? 'Member'}`}
        description="Pantau status membership dan aktivitas akun."
        actions={
          <div className="dashboard-inline-tools">
            <Link to="/member/packages" className="button-filter">
              {isExpired ? 'Perpanjang Membership' : 'Cek Paket'}
            </Link>
          </div>
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Status Saat Ini"
          value={
            !membership
              ? 'Belum ada paket'
              : isExpired
                ? 'Perlu perpanjangan'
                : isExpiringSoon
                  ? 'Segera berakhir'
                : 'Tersinkron'
          }
          hint={
            membership
              ? isExpired
                ? `Masa aktif ${currentPackage?.nama_paket ?? '-'} sudah berakhir.`
                : isExpiringSoon
                  ? `Sisa ${daysRemaining} hari sebelum membership berakhir.`
                : `Paket ${currentPackage?.nama_paket ?? '-'}`
              : 'Pilih paket untuk mulai membership.'
          }
        />
        <StatCard
          label="Riwayat Datang"
          value={`${attendanceCount} kali`}
          hint="Setiap scan barcode akan dicatat otomatis."
        />
        <StatCard
          label="Reminder WA"
          value={isExpiringSoon ? 'H-3 aktif' : 'Aktif'}
          hint={
            isExpiringSoon
              ? 'Segera lakukan perpanjangan sebelum akses check-in berhenti.'
              : 'Notifikasi akan dikirim saat registrasi dan H-3 expired.'
          }
        />
      </div>

      <section className="member-dashboard-grid">
        <article className="panel member-summary-panel">
          <div className="panel-row">
            <div>
              <h3>Membership aktif kamu</h3>
              <p>Lihat status membership terbaru.</p>
            </div>
            {membership ? (
              isExpiringSoon ? (
                <StatusBadge status={membership.status} label="Segera berakhir" tone="warning" />
              ) : (
                <StatusBadge status={membership.status} />
              )
            ) : null}
          </div>
          {membership ? (
            <div className="detail-list">
              <div>
                <span>Paket</span>
                <strong>{currentPackage?.nama_paket ?? '-'}</strong>
              </div>
              <div>
                <span>Mulai</span>
                <strong>{membership.tanggal_mulai ? formatDisplayDate(membership.tanggal_mulai) : 'Menunggu verifikasi'}</strong>
              </div>
              <div>
                <span>Berakhir</span>
                <strong>{membership.tanggal_berakhir ? formatDisplayDate(membership.tanggal_berakhir) : 'Belum aktif'}</strong>
              </div>
            </div>
          ) : (
            <p>Belum ada membership. Kamu bisa mulai dari halaman paket.</p>
          )}
          <div className="inline-actions">
            <Link to="/member/packages" className="button-primary">
              {isExpired ? 'Perpanjang Sekarang' : 'Pilih Paket'}
            </Link>
            <Link to="/member/barcode" className="button-secondary">
              Lihat Barcode
            </Link>
          </div>
        </article>

        <article className="panel member-activity-panel">
          <div className="panel-row">
            <div>
              <h3>Aktivitas mingguan</h3>
              <p>Ringkasan check-in mingguan.</p>
            </div>
          </div>
          <div className="mini-bars">
            {weeklyActivity.map((item) => (
              <div key={item.label} className="mini-bars-item">
                <span style={{ height: item.height }} />
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <div className="quick-tips">
            <div>
              <span>Reminder aktif</span>
              <strong>WA H-3 siap</strong>
            </div>
            <div>
              <span>Total check-in</span>
              <strong>{attendanceCount} kali</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="member-quick-grid">
        <article className="panel">
          <h3>Aksi cepat</h3>
          <div className="quick-link-grid">
            <Link to="/member/payments" className="quick-link-card">
              <strong>Kirim Pembayaran</strong>
              <p>Upload bukti transfer.</p>
            </Link>
            <Link to="/member/barcode" className="quick-link-card">
              <strong>Buka Barcode</strong>
              <p>Tunjukkan saat check-in.</p>
            </Link>
            <Link to="/member/messages" className="quick-link-card">
              <strong>Hubungi Admin</strong>
              <p>Tanya status atau kendala.</p>
            </Link>
          </div>
        </article>

        <article className="panel">
          <h3>Catatan hari ini</h3>
          <div className="task-list">
            <div className="task-row">
              <strong>Membership siap</strong>
              <span>
                {membership
                  ? isExpired
                    ? 'Perlu perpanjangan sebelum check-in berikutnya'
                    : 'Status sudah tersinkron dengan dashboard'
                  : 'Belum ada membership aktif'}
              </span>
            </div>
            <div className="task-row">
              <strong>Paket</strong>
              <span>{currentPackage?.nama_paket ?? 'Cek paket yang tersedia'}</span>
            </div>
            <div className="task-row">
              <strong>Bantuan admin</strong>
              <span>Pesan langsung tersedia jika ada kendala.</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};
