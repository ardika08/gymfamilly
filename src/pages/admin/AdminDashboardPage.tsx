import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService } from '../../services/api';
import type { DashboardSummary, Membership, User } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

interface TrendData {
  visitTrend: { date: string; count: number }[];
  revenueTrend: { month: string; revenue: number }[];
}

export const AdminDashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [expiringMembers, setExpiringMembers] = useState<
    { member: User; membership: Membership | null }[]
  >([]);
  const [trends, setTrends] = useState<TrendData | null>(null);
  usePageTitle('Dashboard Admin');

  useEffect(() => {
    adminService.dashboardSummary().then(setSummary);
    adminService.expiringMembers().then(setExpiringMembers);
    adminService.trends().then(setTrends);
  }, []);

  const visitTrend = trends?.visitTrend.map((d) => d.count) ?? [];
  const trendDots = trends?.revenueTrend.map((d) => d.revenue) ?? [];

  return (
    <div className="stack-lg">
      <section className="dashboard-banner">
        <div>
          <span className="eyebrow">Dashboard Admin</span>
          <h2>Ringkasan operasional gym.</h2>
          <p>Pantau pembayaran, member aktif, dan kunjungan dari satu layar.</p>
        </div>
        <button
          type="button"
          className="button-light"
          onClick={() => {
            if (!summary) return;
            const rows = [
              ['Metrik', 'Nilai'],
              ['Member Aktif', String(summary.activeMembers)],
              ['Pembayaran Pending', String(summary.pendingPayments)],
              ['Pendapatan', currency.format(summary.monthlyRevenue)],
              ['Check-in Hari Ini', String(summary.attendanceToday)],
              ['Reminder H-3', String(summary.expiringSoonCount)],
            ];
            const csv = rows.map((r) => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ringkasan-gym-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export ringkasan
        </button>
      </section>

      <PageHeader
        eyebrow="Dashboard Admin"
        title="Kontrol operasional Gym Familly"
        description="Ringkasan utama pembayaran, pendapatan, dan check-in."
        actions={
          <div className="dashboard-inline-tools">
            <button type="button" className="button-filter">
              27/05/2026
            </button>
            <button type="button" className="button-filter">
              30 Hari
            </button>
          </div>
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Member Aktif"
          value={`${summary?.activeMembers ?? 0}`}
          hint="Jumlah membership yang sudah diverifikasi."
        />
        <StatCard
          label="Pembayaran Pending"
          value={`${summary?.pendingPayments ?? 0}`}
          hint="Butuh verifikasi transfer manual."
        />
        <StatCard
          label="Pendapatan"
          value={currency.format(summary?.monthlyRevenue ?? 0)}
          hint="Akumulasi dari membership aktif."
        />
        <StatCard
          label="Check-in Hari Ini"
          value={`${summary?.attendanceToday ?? 0}`}
          hint="Bertambah saat ada scan berhasil."
        />
        <StatCard
          label="Reminder H-3"
          value={`${summary?.expiringSoonCount ?? 0}`}
          hint="Member yang perlu segera diingatkan untuk perpanjangan."
        />
      </div>

      {expiringMembers.length > 0 ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Reminder admin</span>
            <strong>{expiringMembers.length} member mendekati masa expired.</strong>
            <p>Prioritaskan follow-up agar akses check-in mereka tidak terputus.</p>
          </div>
          <div className="section-intro-meta">
            <strong>H-3 aktif</strong>
            <span className="form-helper-note">Notifikasi manual admin disarankan hari ini</span>
          </div>
        </section>
      ) : null}

      <section className="chart-layout">
        <article className="panel chart-panel main">
          <div className="panel-row">
            <div>
              <h3>Grafik kunjungan gym</h3>
              <p>Tren kunjungan member.</p>
            </div>
            <button type="button" className="button-filter">
              10 hari terakhir
            </button>
          </div>
          <div className="line-chart line-chart-large">
            <div className="line-chart-grid" />
            <svg viewBox="0 0 460 210" className="line-chart-svg large" aria-hidden="true">
              <polyline
                fill="none"
                stroke="url(#visitTrendGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={visitTrend
                  .map((point, index) => `${26 + index * 45},${180 - point}`)
                  .join(' ')}
              />
              {visitTrend.map((point, index) => (
                <circle
                  key={index}
                  cx={26 + index * 45}
                  cy={180 - point}
                  r="5.5"
                  fill="#ab182a"
                />
              ))}
              <defs>
                <linearGradient id="visitTrendGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ab182a" />
                  <stop offset="100%" stopColor="#d8616f" />
                </linearGradient>
              </defs>
            </svg>
            <div className="chart-x-axis">
              {visitTrend.map((_, index) => (
                <small key={index}>{String(index + 1).padStart(2, '0')}</small>
              ))}
            </div>
          </div>
        </article>

        <article className="panel chart-panel side">
          <div className="panel-row">
            <div>
              <h3>Tren pendapatan</h3>
              <p>Pergerakan pemasukan membership.</p>
            </div>
          </div>
          <div className="line-chart">
            <div className="line-chart-grid" />
            <svg viewBox="0 0 320 180" className="line-chart-svg" aria-hidden="true">
              <polyline
                fill="none"
                stroke="url(#chartGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trendDots
                  .map((point, index) => `${20 + index * 40},${160 - point}`)
                  .join(' ')}
              />
              {trendDots.map((point, index) => (
                <circle
                  key={index}
                  cx={20 + index * 40}
                  cy={160 - point}
                  r="5"
                  fill="#ab182a"
                />
              ))}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ab182a" />
                  <stop offset="100%" stopColor="#d8616f" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="trend-summary">
            <div>
              <span>Total pendapatan</span>
              <strong>{currency.format(summary?.monthlyRevenue ?? 0)}</strong>
            </div>
            <div>
              <span>Pertumbuhan</span>
              <strong>+20.1%</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="chart-layout lower">
        <article className="panel">
          <div className="panel-row">
            <div>
              <h3>Prioritas hari ini</h3>
              <p>Fokus kerja admin.</p>
            </div>
          </div>
          <div className="task-list">
            <div className="task-row">
              <strong>Verifikasi pembayaran manual</strong>
              <span>{summary?.pendingPayments ?? 0} transaksi menunggu</span>
            </div>
            <div className="task-row">
              <strong>Monitoring attendance</strong>
              <span>{summary?.attendanceToday ?? 0} check-in tercatat hari ini</span>
            </div>
            <div className="task-row">
              <strong>Reminder membership H-3</strong>
              <span>{summary?.expiringSoonCount ?? 0} member perlu dihubungi admin</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-row">
            <div>
              <h3>Ringkasan cepat</h3>
              <p>Insight operasional singkat.</p>
            </div>
          </div>
          <div className="mini-metric-grid">
            <div className="mini-metric">
              <span>Konversi</span>
              <strong>74%</strong>
            </div>
            <div className="mini-metric">
              <span>Member kembali</span>
              <strong>61%</strong>
            </div>
            <div className="mini-metric">
              <span>Reminder WA</span>
              <strong>{summary?.expiringSoonCount ?? 0} antrean</strong>
            </div>
            <div className="mini-metric">
              <span>Sinyal member</span>
              <strong>{expiringMembers.length > 0 ? 'Perlu follow-up' : 'Stabil'}</strong>
            </div>
          </div>
        </article>
      </section>

      {expiringMembers.length > 0 ? (
        <section className="panel">
          <div className="panel-toolbar">
            <div>
              <h3>Member mendekati expired</h3>
              <p>Daftar member dengan sisa masa aktif tiga hari atau kurang.</p>
            </div>
            <span className="table-chip">{expiringMembers.length} reminder</span>
          </div>
          <div className="task-list">
            {expiringMembers.map(({ member, membership }) => (
              <div key={member.id} className="task-row">
                <strong>{member.nama}</strong>
                <span>{`Berakhir ${formatDisplayDate(membership?.tanggal_berakhir)} · ${member.whatsapp}`}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
