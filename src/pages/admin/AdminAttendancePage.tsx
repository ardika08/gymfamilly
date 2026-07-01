import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { adminService, attendanceService } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import type { Attendance, User } from '../../types/models';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
  formatInputDate,
} from '../../utils/date';

type AttendanceStatusFilterExtended =
  | 'semua'
  | 'berhasil'
  | 'ditolak'
  | 'kedaluwarsa'
  | 'belum_aktif';

let pdfLoaderPromise:
  | Promise<{
      jsPDF: any;
      autoTable: any;
    }>
  | null = null;

const escapeCsvCell = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const loadPdfModules = async () => {
  if (!pdfLoaderPromise) {
    pdfLoaderPromise = Promise.all([import('jspdf'), import('jspdf-autotable')]).then(
      ([jspdfModule, autoTableModule]) => ({
        jsPDF: jspdfModule.jsPDF,
        autoTable: autoTableModule.default,
      }),
    );
  }

  return pdfLoaderPromise;
};

const getAttendanceToneClass = (item: Attendance) => {
  if (item.hasil === 'ditolak') {
    if (item.catatan?.toLowerCase().includes('kedaluwarsa')) {
      return 'warning';
    }

    return 'subtle';
  }

  return 'success';
};

const PAGE_SIZE = 10;

export const AdminAttendancePage = () => {
  const [items, setItems] = useState<Attendance[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<'semua' | string>('semua');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilterExtended>('semua');
  const [search, setSearch] = useState('');
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(formatInputDate(monthStart));
  const [endDate, setEndDate] = useState(formatInputDate(today));
  const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null);
  usePageTitle('Riwayat Kehadiran');

  useEffect(() => {
    adminService.members().then(setMembers);
    attendanceService.listAll().then(setItems);
  }, []);

  const enrichedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        member: members.find((member) => member.id === item.user_id) ?? null,
      })),
    [items, members],
  );

  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      const memberOk = selectedMemberId === 'semua' ? true : String(item.user_id) === selectedMemberId;
      const searchOk =
        search.trim() === ''
          ? true
          : (item.member?.nama ?? '').toLowerCase().includes(search.trim().toLowerCase());
      const statusOk =
        statusFilter === 'semua'
          ? true
          : statusFilter === 'berhasil'
            ? item.hasil === 'berhasil'
            : statusFilter === 'ditolak'
              ? item.hasil === 'ditolak'
              : statusFilter === 'kedaluwarsa'
                ? item.catatan?.toLowerCase().includes('kedaluwarsa') ?? false
                : item.catatan?.toLowerCase().includes('belum aktif') ?? false;
      const dateValue = new Date(item.waktu_scan);
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      const dateOk = dateValue >= start && dateValue <= end;

      return memberOk && searchOk && statusOk && dateOk;
    });
  }, [endDate, enrichedItems, search, selectedMemberId, startDate, statusFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, selectedMemberId, startDate, endDate, statusFilter]);

  const summary = useMemo(() => {
    const scansToday = filteredItems.filter(
      (item) => formatInputDate(new Date(item.waktu_scan)) === formatInputDate(today),
    ).length;
    const latestScan = filteredItems[0] ?? null;
    return {
      scansToday,
      scansInRange: filteredItems.length,
      latestMember: latestScan?.member?.nama ?? '-',
      latestAt: latestScan ? formatDisplayDateTime(latestScan.waktu_scan) : '-',
    };
  }, [filteredItems, today]);

  const exportRows = filteredItems.map((item) => ({
    'Nama Member': item.member?.nama ?? '-',
    WhatsApp: item.member?.whatsapp ?? '-',
    'Tanggal Scan': formatDisplayDate(item.waktu_scan),
    'Jam Scan': formatDisplayTime(item.waktu_scan),
    Status: item.hasil === 'ditolak' ? 'Ditolak' : 'Berhasil',
    Catatan: item.catatan ?? 'Validasi barcode berhasil',
  }));
  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMoreItems = visibleItems.length < filteredItems.length;
  const selectedAttendance =
    filteredItems.find((item) => item.id === selectedAttendanceId) ??
    enrichedItems.find((item) => item.id === selectedAttendanceId) ??
    null;

  const isTodayRange = startDate === formatInputDate(today) && endDate === formatInputDate(today);
  const isCurrentMonthRange = startDate === formatInputDate(monthStart) && endDate === formatInputDate(today);
  const lastSevenDaysStart = new Date(today);
  lastSevenDaysStart.setDate(today.getDate() - 6);
  const isLastSevenDaysRange =
    startDate === formatInputDate(lastSevenDaysStart) && endDate === formatInputDate(today);

  const setQuickRange = (mode: 'today' | '7days' | 'month') => {
    if (mode === 'today') {
      const date = formatInputDate(today);
      setStartDate(date);
      setEndDate(date);
      return;
    }

    if (mode === '7days') {
      setStartDate(formatInputDate(lastSevenDaysStart));
      setEndDate(formatInputDate(today));
      return;
    }

    setStartDate(formatInputDate(monthStart));
    setEndDate(formatInputDate(today));
  };

  const handleExportCsv = () => {
    setIsExporting('csv');
    const headers = ['Nama Member', 'WhatsApp', 'Tanggal Scan', 'Jam Scan', 'Status', 'Catatan'];
    const csvContent = `\uFEFF${[
      headers.map((header) => escapeCsvCell(header)).join(';'),
      ...exportRows.map((row) => headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(';')),
    ].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwayat-kehadiran-gym-familly-${startDate}-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setIsExporting(null);
  };

  const handleExportPdf = async () => {
    setIsExporting('pdf');

    try {
      const headers = ['Nama Member', 'WhatsApp', 'Tanggal Scan', 'Jam Scan', 'Status', 'Catatan'];
      const body = exportRows.map((row) => headers.map((header) => row[header as keyof typeof row]));
      const { jsPDF, autoTable } = await loadPdfModules();
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('Riwayat Kehadiran Gym Familly', 14, 16);
      doc.setFontSize(10);
      doc.text(`Periode: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`, 14, 24);

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [171, 24, 42],
          textColor: [255, 255, 255],
        },
      });

      doc.save(`riwayat-kehadiran-gym-familly-${startDate}-${endDate}.pdf`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Riwayat Kehadiran"
        title="Log scan barcode member"
        description="Setiap check-in yang lolos validasi akan dicatat dan bisa dipantau per periode."
        actions={
          <div className="dashboard-inline-tools">
            <button type="button" className="button-filter" onClick={handleExportPdf} disabled={isExporting !== null}>
              {isExporting === 'pdf' ? 'Menyiapkan PDF...' : 'Export PDF'}
            </button>
            <button type="button" className="button-filter" onClick={handleExportCsv}>
              {isExporting === 'csv' ? 'Menyiapkan CSV...' : 'Export CSV'}
            </button>
          </div>
        }
      />

      <div className="stats-grid">
        <article className="stat-card">
          <span>Scan Hari Ini</span>
          <strong>{summary.scansToday}</strong>
          <p>Total check-in valid pada tanggal hari ini.</p>
        </article>
        <article className="stat-card">
          <span>Scan Periode Ini</span>
          <strong>{summary.scansInRange}</strong>
          <p>Jumlah scan yang masuk sesuai filter aktif.</p>
        </article>
        <article className="stat-card">
          <span>Member Terakhir</span>
          <strong>{summary.latestMember}</strong>
          <p>Scan terbaru yang tercatat di halaman riwayat.</p>
        </article>
        <article className="stat-card">
          <span>Waktu Scan Terakhir</span>
          <strong>{summary.latestAt}</strong>
          <p>Format tanggal sudah diseragamkan ke dd/mm/yyyy.</p>
        </article>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Filter riwayat scan</h3>
            <p>Pilih rentang tanggal dan member untuk melihat log check-in yang lebih spesifik.</p>
          </div>
        </div>
        <div className="dashboard-inline-tools attendance-quick-filters">
          <button
            type="button"
            className={`button-filter ${isTodayRange ? 'is-active' : ''}`}
            onClick={() => setQuickRange('today')}
          >
            Hari ini
          </button>
          <button
            type="button"
            className={`button-filter ${isLastSevenDaysRange ? 'is-active' : ''}`}
            onClick={() => setQuickRange('7days')}
          >
            7 hari
          </button>
          <button
            type="button"
            className={`button-filter ${isCurrentMonthRange ? 'is-active' : ''}`}
            onClick={() => setQuickRange('month')}
          >
            Bulan ini
          </button>
        </div>
        <div className="finance-filter-grid finance-filter-grid-wide">
          <label>
            <span>Cari Member</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama member..."
            />
          </label>
          <label>
            <span>Tanggal Mulai</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>Tanggal Akhir</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <span>Member</span>
            <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>
              <option value="semua">Semua member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nama}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AttendanceStatusFilterExtended)}
            >
              <option value="semua">Semua status</option>
              <option value="berhasil">Berhasil</option>
              <option value="ditolak">Ditolak</option>
              <option value="kedaluwarsa">Kedaluwarsa</option>
              <option value="belum_aktif">Belum aktif</option>
            </select>
          </label>
          <div className="finance-total-card">
            <small>Total hasil</small>
            <strong>{filteredItems.length} scan</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Feed kehadiran</h3>
            <p>Riwayat scan terbaru untuk monitoring aktivitas gym.</p>
          </div>
          <div className="dashboard-inline-tools">
            <span className="table-chip">Klik row untuk lihat detail scan</span>
            <span className="table-chip">{filteredItems.length} scan</span>
          </div>
        </div>
        {filteredItems.length === 0 ? (
          <EmptyState
            title="Belum ada data kehadiran"
            description="Riwayat scan dari halaman scanner admin akan muncul di sini setelah ada check-in."
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`attendance-row attendance-row--${getAttendanceToneClass(item)}`}
                    onClick={() => setSelectedAttendanceId(item.id)}
                  >
                    <td>
                      <div className="table-primary">
                        <strong>{item.member?.nama ?? '-'}</strong>
                        <small>{item.member?.whatsapp ?? 'Nomor belum tersedia'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="finance-table-period">
                        <strong>{formatDisplayDate(item.waktu_scan)}</strong>
                        <small>Riwayat check-in</small>
                      </div>
                    </td>
                    <td>
                      <span className="table-chip subtle">{formatDisplayTime(item.waktu_scan)}</span>
                    </td>
                    <td>
                      <span className={`table-chip ${getAttendanceToneClass(item)}`}>
                        {item.hasil === 'ditolak' ? 'Ditolak' : 'Berhasil'}
                      </span>
                    </td>
                    <td>
                      <div className="table-primary">
                        <strong>{item.catatan ?? 'Validasi barcode berhasil'}</strong>
                        <small>Tercatat otomatis pada {formatDisplayDateTime(item.waktu_scan)}</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredItems.length > PAGE_SIZE ? (
          <div className="attendance-pagination">
            <small>
              Menampilkan {visibleItems.length} dari {filteredItems.length} log scan
            </small>
            <div className="dashboard-inline-tools">
              {visibleCount > PAGE_SIZE ? (
                <button
                  type="button"
                  className="button-filter"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                >
                  Tampilkan lebih sedikit
                </button>
              ) : null}
              {hasMoreItems ? (
                <button
                  type="button"
                  className="button-filter is-active"
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                >
                  Muat 10 log lagi
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {selectedAttendance ? (
        <div className="proof-modal-overlay" onClick={() => setSelectedAttendanceId(null)}>
          <div className="proof-modal-card attendance-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-toolbar">
              <div>
                <h3>Detail scan kehadiran</h3>
                <p>Lihat informasi lengkap hasil validasi barcode member.</p>
              </div>
              <button type="button" className="button-filter" onClick={() => setSelectedAttendanceId(null)}>
                Tutup
              </button>
            </div>
            <div className="attendance-detail-grid">
              <div className="attendance-detail-card">
                <small>Nama member</small>
                <strong>{selectedAttendance.member?.nama ?? '-'}</strong>
              </div>
              <div className="attendance-detail-card">
                <small>WhatsApp</small>
                <strong>{selectedAttendance.member?.whatsapp ?? 'Nomor belum tersedia'}</strong>
              </div>
              <div className="attendance-detail-card">
                <small>Tanggal scan</small>
                <strong>{formatDisplayDate(selectedAttendance.waktu_scan)}</strong>
              </div>
              <div className="attendance-detail-card">
                <small>Jam scan</small>
                <strong>{formatDisplayTime(selectedAttendance.waktu_scan)}</strong>
              </div>
            </div>
            <div className="attendance-detail-summary">
              <span className={`table-chip ${getAttendanceToneClass(selectedAttendance)}`}>
                {selectedAttendance.hasil === 'ditolak' ? 'Ditolak' : 'Berhasil'}
              </span>
              <p>{selectedAttendance.catatan ?? 'Validasi barcode berhasil'}</p>
              <small>Tercatat pada {formatDisplayDateTime(selectedAttendance.waktu_scan)}</small>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
