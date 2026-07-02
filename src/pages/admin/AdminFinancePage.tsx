import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, packageService } from '../../services/api';
import type {
  Expense,
  GymPackage,
  Membership,
  MembershipStatus,
  User,
} from '../../types/models';
import { formatDisplayDate, formatDisplayDayMonth, formatInputDate } from '../../utils/date';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

type FinanceStatusFilter = MembershipStatus | 'semua';
type FinanceMethodFilter = 'semua' | 'BCA Manual' | 'BRI Manual' | 'Mandiri Manual';
type ExportResultMode = 'clipboard';
type PreparedDownload = {
  filename: string;
  url: string;
};

let pdfLoaderPromise:
  | Promise<{
      jsPDF: any;
      autoTable: any;
    }>
  | null = null;

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

const escapeCsvCell = (value: string | number) => {
  const stringValue = String(value ?? '');
  const escapedValue = stringValue.replace(/"/g, '""');
  return `"${escapedValue}"`;
};

const buildCsvContent = (
  rows: Array<Record<string, string | number>>,
  headers: string[],
) => {
  const delimiter = ';';
  const headerLine = headers.map((header) => escapeCsvCell(header)).join(delimiter);
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row[header] ?? '')).join(delimiter),
  );
  return [headerLine, ...bodyLines].join('\n');
};

const getFinanceDate = (payment: Membership) =>
  payment.created_at ?? payment.tanggal_mulai ?? payment.tanggal_berakhir ?? null;

const isInCustomRange = (
  dateValue: string | null,
  startDate: string,
  endDate: string,
) => {
  if (!dateValue) {
    return false;
  }

  const current = new Date(dateValue);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  return current >= start && current <= end;
};

const financeChartDays = 20;

export const AdminFinancePage = () => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [payments, setPayments] = useState<Membership[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
  const [startDate, setStartDate] = useState(formatInputDate(monthStart));
  const [endDate, setEndDate] = useState(formatInputDate(today));
  const [statusFilter, setStatusFilter] = useState<FinanceStatusFilter>('semua');
  const [methodFilter, setMethodFilter] = useState<FinanceMethodFilter>('semua');
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | 'member-pdf' | 'member-excel' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [preparedFinanceExcel, setPreparedFinanceExcel] = useState<PreparedDownload | null>(null);
  const [preparedMemberExcel, setPreparedMemberExcel] = useState<PreparedDownload | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    label: '',
    nominal: '',
    tanggal: formatInputDate(today),
    kategori: 'Operasional',
  });
  usePageTitle('Keuangan Admin');

  useEffect(() => {
    adminService.members().then((memberList) => {
      setMembers(memberList);
      setSelectedMemberId(memberList[0]?.id ?? null);
    });
    packageService.list().then(setPackages);
    adminService.payments().then(setPayments);
    adminService.expenses().then(setExpenses);

    window.setTimeout(() => {
      void loadPdfModules();
    }, 250);

    return () => {
      setPreparedFinanceExcel((current) => {
        if (current) {
          window.URL.revokeObjectURL(current.url);
        }
        return null;
      });
      setPreparedMemberExcel((current) => {
        if (current) {
          window.URL.revokeObjectURL(current.url);
        }
        return null;
      });
    };
  }, []);

  const enrichedPayments = useMemo(
    () =>
      payments.map((payment) => {
        const member = members.find((item) => item.id === payment.user_id) ?? null;
        const pkg = packages.find((item) => item.id === payment.package_id) ?? null;
        const amount = pkg?.harga_promo ?? pkg?.harga_normal ?? 0;
        const financeDate = getFinanceDate(payment);

        return {
          ...payment,
          member,
          pkg,
          amount,
          financeDate,
        };
      }),
    [members, packages, payments],
  );

  const filteredPayments = useMemo(() => {
    return enrichedPayments.filter((payment) => {
      const statusOk = statusFilter === 'semua' ? true : payment.status === statusFilter;
      const methodOk =
        methodFilter === 'semua' ? true : payment.payment_method === methodFilter;
      const dateOk = isInCustomRange(payment.financeDate, startDate, endDate);

      return statusOk && methodOk && dateOk;
    });
  }, [endDate, enrichedPayments, methodFilter, startDate, statusFilter]);

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => isInCustomRange(expense.tanggal, startDate, endDate)),
    [endDate, expenses, startDate],
  );

  const financeSummary = useMemo(() => {
    const approved = filteredPayments.filter((payment) => payment.status === 'aktif');
    const pending = filteredPayments.filter(
      (payment) => payment.status === 'menunggu_pembayaran',
    );

    const totalRevenue = approved.reduce((total, payment) => total + payment.amount, 0);
    const estimatedRevenue = filteredPayments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );
    const totalExpense = filteredExpenses.reduce(
      (total, expense) => total + expense.nominal,
      0,
    );

    return {
      totalRevenue,
      estimatedRevenue,
      totalExpense,
      profitLoss: totalRevenue - totalExpense,
      approvedCount: approved.length,
      pendingCount: pending.length,
    };
  }, [filteredExpenses, filteredPayments]);

  const weeklyChartData = useMemo(() => {
    const rollingDays = Array.from({ length: financeChartDays }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (financeChartDays - 1 - index));
      return date;
    });

    return rollingDays.map((date) => {
      const dateKey = formatInputDate(date);
      const total = enrichedPayments
        .filter((payment) => payment.status === 'aktif' && payment.financeDate)
        .filter(
          (payment) => formatInputDate(new Date(payment.financeDate!)) === dateKey,
        )
        .reduce((sum, payment) => sum + payment.amount, 0);

      return {
        label: formatDisplayDayMonth(date),
        total,
      };
    });
  }, [enrichedPayments, today]);

  const weeklyMax = Math.max(...weeklyChartData.map((item) => item.total), 1);

  const memberTransactions = useMemo(
    () =>
      filteredPayments.filter((payment) => payment.user_id === selectedMemberId),
    [filteredPayments, selectedMemberId],
  );

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;

  const memberSummary = useMemo(() => {
    const total = memberTransactions.reduce((sum, payment) => sum + payment.amount, 0);
    const active = memberTransactions.filter((payment) => payment.status === 'aktif').length;
    return { total, active, count: memberTransactions.length };
  }, [memberTransactions]);

  const buildRows = (source: typeof filteredPayments) =>
    source.map((payment) => ({
      'Nama Member': payment.member?.nama ?? '-',
      'Email Member': payment.member?.email ?? '-',
      'Nama Paket': payment.pkg?.nama_paket ?? '-',
      'Status Membership':
        payment.status === 'menunggu_pembayaran'
          ? 'Menunggu Pembayaran'
          : payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
      'Metode Pembayaran': payment.payment_method ?? '-',
      'Nominal Pembayaran': currency.format(payment.amount),
      'Tanggal Transaksi': payment.financeDate ? formatDisplayDate(payment.financeDate) : '-',
      'Bukti Pembayaran':
        typeof payment.payment_proof === 'string' &&
        payment.payment_proof.startsWith('data:image/')
          ? 'Bukti gambar terunggah'
          : payment.payment_proof ?? '-',
    }));

  const exportHeaders = [
    'Nama Member',
    'Email Member',
    'Nama Paket',
    'Status Membership',
    'Metode Pembayaran',
    'Nominal Pembayaran',
    'Tanggal Transaksi',
    'Bukti Pembayaran',
  ];
  const exportRows = buildRows(filteredPayments);
  const memberExportRows = buildRows(memberTransactions);

  const prepareExcelDownload = async (
    rows: typeof exportRows,
    filename: string,
  ): Promise<PreparedDownload | ExportResultMode> => {
    const csvOutput = `\uFEFF${buildCsvContent(rows, exportHeaders)}`;

    const isCodexInApp =
      typeof navigator !== 'undefined' &&
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent.toLowerCase().includes('codex');

    if (isCodexInApp) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(csvOutput);
        return 'clipboard';
      }
    }

    const blob = new Blob([csvOutput], {
      type: 'text/csv;charset=utf-8;',
    });
    return {
      filename: filename.replace(/\.xlsx$/i, '.csv'),
      url: window.URL.createObjectURL(blob),
    };
  };

  const exportPdf = async (rows: typeof exportRows, filename: string, title: string) => {
    const { jsPDF, autoTable } = await loadPdfModules();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${formatDisplayDate(startDate)} s/d ${formatDisplayDate(endDate)}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [['Member', 'Paket', 'Status', 'Metode', 'Nominal', 'Tanggal']],
      body: rows.map((row) => [
        row['Nama Member'],
        row['Nama Paket'],
        row['Status Membership'],
        row['Metode Pembayaran'],
        row['Nominal Pembayaran'],
        row['Tanggal Transaksi'],
      ]),
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fillColor: [171, 24, 42],
      },
    });

    doc.save(filename);
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting('pdf');
      await exportPdf(
        exportRows,
        `laporan-keuangan-gym-familly-${startDate}-${endDate}.pdf`,
        'Laporan Keuangan Gym Familly',
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting('excel');
      const result = await prepareExcelDownload(
        exportRows,
        `laporan-keuangan-gym-familly-${startDate}-${endDate}.xlsx`,
      );
      if (result === 'clipboard') {
        setExportFeedback(
          'Browser in-app tidak mendukung download Excel langsung. Data CSV sudah disalin ke clipboard sebagai fallback.',
        );
        return;
      }

      setPreparedFinanceExcel((current) => {
        if (current) {
          window.URL.revokeObjectURL(current.url);
        }
        return result;
      });
      setExportFeedback(
        'File CSV kompatibel Excel siap. Klik link download yang muncul lalu buka file itu di Excel.',
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleMemberExportPdf = async () => {
    try {
      setIsExporting('member-pdf');
      await exportPdf(
        memberExportRows,
        `laporan-member-${selectedMember?.nama ?? 'gym-familly'}.pdf`,
        `Laporan Transaksi ${selectedMember?.nama ?? 'Member'}`,
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleMemberExportExcel = async () => {
    try {
      setIsExporting('member-excel');
      const result = await prepareExcelDownload(
        memberExportRows,
        `laporan-member-${selectedMember?.nama ?? 'gym-familly'}.xlsx`,
      );
      if (result === 'clipboard') {
        setExportFeedback(
          'Browser in-app tidak mendukung download Excel langsung. Data CSV member sudah disalin ke clipboard sebagai fallback.',
        );
        return;
      }

      setPreparedMemberExcel((current) => {
        if (current) {
          window.URL.revokeObjectURL(current.url);
        }
        return result;
      });
      setExportFeedback(
        'File CSV member kompatibel Excel siap. Klik link download yang muncul di drawer lalu buka file itu di Excel.',
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleCreateExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseForm.label.trim() || !expenseForm.nominal.trim()) {
      return;
    }

    await adminService.createExpense({
      label: expenseForm.label.trim(),
      nominal: Number(expenseForm.nominal),
      tanggal: expenseForm.tanggal,
      kategori: expenseForm.kategori,
    });

    const nextExpenses = await adminService.expenses();
    setExpenses(nextExpenses);
    setExpenseForm({
      label: '',
      nominal: '',
      tanggal: formatInputDate(today),
      kategori: 'Operasional',
    });
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Keuangan"
        title="Kelola keuangan Gym Familly"
        description="Pantau pemasukan, pengeluaran, transaksi membership, dan performa pembayaran admin."
        actions={
          <div className="dashboard-inline-tools">
            <button
              type="button"
              className="button-filter"
              onClick={handleExportPdf}
              disabled={isExporting !== null}
            >
              {isExporting === 'pdf' ? 'Menyiapkan PDF...' : 'Export PDF'}
            </button>
            <button
              type="button"
              className="button-filter"
              onClick={handleExportExcel}
              disabled={isExporting !== null}
            >
              {isExporting === 'excel' ? 'Menyiapkan Excel...' : 'Export Excel'}
            </button>
            {preparedFinanceExcel ? (
              <a
                className="button-filter"
                href={preparedFinanceExcel.url}
                download={preparedFinanceExcel.filename}
              >
                Download Excel
              </a>
            ) : null}
          </div>
        }
      />
      {exportFeedback ? (
        <section className="section-intro-card finance-export-feedback">
          <div>
            <small>Status export</small>
            <strong>{exportFeedback}</strong>
          </div>
          <button
            type="button"
            className="button-filter"
            onClick={() => setExportFeedback(null)}
          >
            Tutup info
          </button>
        </section>
      ) : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Total Pemasukan</span>
          <strong>{currency.format(financeSummary.totalRevenue)}</strong>
          <p>Akumulasi transaksi aktif sesuai rentang tanggal.</p>
        </article>
        <article className="stat-card">
          <span>Total Pengeluaran</span>
          <strong>{currency.format(financeSummary.totalExpense)}</strong>
          <p>Pengeluaran operasional sederhana pada periode aktif.</p>
        </article>
        <article className="stat-card">
          <span>Laba Bersih</span>
          <strong>{currency.format(financeSummary.profitLoss)}</strong>
          <p>Selisih pemasukan aktif dan total pengeluaran.</p>
        </article>
        <article className="stat-card">
          <span>Pending Verifikasi</span>
          <strong>{financeSummary.pendingCount}</strong>
          <p>Pembayaran yang masih menunggu pengecekan.</p>
        </article>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Filter transaksi</h3>
            <p>Pilih rentang tanggal custom, status, dan metode pembayaran.</p>
          </div>
        </div>
        <div className="finance-filter-grid finance-filter-grid-wide">
          <label>
            <span>Tanggal Mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>Tanggal Akhir</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as FinanceStatusFilter)}
            >
              <option value="semua">Semua status</option>
              <option value="aktif">Aktif</option>
              <option value="menunggu_pembayaran">Menunggu Pembayaran</option>
              <option value="kedaluwarsa">Kedaluwarsa</option>
            </select>
          </label>
          <label>
            <span>Metode</span>
            <select
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value as FinanceMethodFilter)}
            >
              <option value="semua">Semua metode</option>
              <option value="BCA Manual">BCA Manual</option>
              <option value="BRI Manual">BRI Manual</option>
              <option value="Mandiri Manual">Mandiri Manual</option>
            </select>
          </label>
          <div className="finance-total-card">
            <small>Total periode</small>
            <strong>{currency.format(financeSummary.totalRevenue)}</strong>
          </div>
        </div>
      </section>

      <section className="finance-chart-single">
        <article className="panel finance-chart-panel">
          <div className="panel-row">
            <div>
              <h3>Grafik transaksi {financeChartDays} hari</h3>
              <p>
                Menampilkan pemasukan aktif untuk {financeChartDays} hari terakhir dari hari
                ini.
              </p>
            </div>
          </div>
          <div className="finance-month-chart">
            {weeklyChartData.map((item) => (
              <div key={item.label} className="finance-month-item">
                <div className="finance-month-track">
                  <span style={{ height: `${(item.total / weeklyMax) * 100}%` }} />
                </div>
                <strong>{currency.format(item.total)}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>

      </section>

      <section className="chart-layout lower">
        <article className="panel">
          <div className="panel-row">
            <div>
              <h3>Catat pengeluaran</h3>
              <p>Masukkan biaya operasional agar summary laba/rugi ikut terhitung otomatis.</p>
            </div>
          </div>
          <form className="finance-filter-grid finance-filter-grid-wide" onSubmit={handleCreateExpense}>
            <label>
              <span>Nama pengeluaran</span>
              <input
                value={expenseForm.label}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="Contoh: Beli suplemen minibar"
                required
              />
            </label>
            <label>
              <span>Nominal</span>
              <input
                type="number"
                value={expenseForm.nominal}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, nominal: event.target.value }))
                }
                placeholder="50000"
                required
              />
            </label>
            <label>
              <span>Tanggal</span>
              <input
                type="date"
                value={expenseForm.tanggal}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, tanggal: event.target.value }))
                }
                required
              />
            </label>
            <label>
              <span>Kategori</span>
              <select
                value={expenseForm.kategori}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, kategori: event.target.value }))
                }
              >
                <option>Operasional</option>
                <option>Maintenance</option>
                <option>Marketing</option>
                <option>Gaji</option>
              </select>
            </label>
            <div className="finance-total-card">
              <small>Total pengeluaran aktif</small>
              <strong>{currency.format(financeSummary.totalExpense)}</strong>
              <button type="submit" className="table-action-button finance-submit-button">
                Simpan Pengeluaran
              </button>
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panel-row">
            <div>
              <h3>Riwayat pengeluaran</h3>
              <p>Daftar biaya yang masuk ke perhitungan laba/rugi pada periode aktif.</p>
            </div>
          </div>
          <div className="member-transaction-list">
            {filteredExpenses.length === 0 ? (
              <p>Belum ada pengeluaran pada rentang tanggal ini.</p>
            ) : (
              filteredExpenses.map((expense) => (
                <div key={expense.id} className="task-row finance-transaction-row">
                  <div>
                    <strong>{expense.label}</strong>
                    <span>{expense.kategori} - {formatDisplayDate(expense.tanggal)}</span>
                  </div>
                  <div className="finance-transaction-meta">
                    <span className="table-chip subtle">{expense.kategori}</span>
                    <strong>{currency.format(expense.nominal)}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Tabel transaksi pembayaran</h3>
            <p>Rekap seluruh transaksi membership yang sudah masuk ke sistem.</p>
          </div>
          <span className="table-chip">{filteredPayments.length} transaksi</span>
        </div>
        <div className="section-intro-card finance-table-hint">
          <div>
            <small>Akses cepat detail member</small>
            <strong>Klik baris transaksi untuk melihat detail member.</strong>
          </div>
        </div>
        <div className="table-wrap premium-table-wrap">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Paket</th>
                <th>Status</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Periode</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="finance-table-empty">
                      Tidak ada transaksi pada filter yang sedang dipakai.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                const periodLabel = payment.tanggal_mulai
                  ? `${formatDisplayDate(payment.tanggal_mulai)} - ${formatDisplayDate(payment.tanggal_berakhir)}`
                  : 'Menunggu aktivasi';

                return (
                  <tr
                    key={payment.id}
                    className="finance-table-row finance-clickable-row"
                    onClick={() => {
                      setSelectedMemberId(payment.user_id);
                      setIsMemberDrawerOpen(true);
                    }}
                  >
                    <td>
                      <div className="table-primary">
                        <strong>{payment.member?.nama ?? '-'}</strong>
                        <small>{payment.member?.email ?? 'Email belum tersedia'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <strong>{payment.pkg?.nama_paket ?? '-'}</strong>
                        <small>{payment.pkg?.deskripsi ?? 'Membership Gym Familly'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="finance-table-status">
                        <StatusBadge status={payment.status} />
                      </div>
                    </td>
                    <td>
                      <span className="table-chip subtle">{payment.payment_method ?? '-'}</span>
                    </td>
                    <td>
                      <div className="finance-table-amount">
                        <strong>{currency.format(payment.amount)}</strong>
                        <small>Pembayaran member</small>
                      </div>
                    </td>
                    <td>
                      <div className="finance-table-period">
                        <strong>{periodLabel}</strong>
                        <small>
                          {payment.financeDate
                            ? `Dibuat ${formatDisplayDate(payment.financeDate)}`
                            : 'Menunggu laporan'}
                        </small>
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      {isMemberDrawerOpen ? (
        <>
          <div className="finance-drawer-overlay" onClick={() => setIsMemberDrawerOpen(false)} />
          <aside className="finance-drawer-panel">
            <div className="panel-toolbar finance-drawer-header">
              <div>
                <h3>Detail transaksi per member</h3>
                <p>Lihat kontribusi dan histori transaksi sesuai filter aktif.</p>
              </div>
              <button
                type="button"
                className="button-filter"
                onClick={() => setIsMemberDrawerOpen(false)}
              >
                Tutup
              </button>
            </div>
            <div className="finance-member-panel finance-drawer-body">
              <div className="finance-member-header">
                <div className="finance-member-identity">
                  <small>Member terpilih</small>
                  <strong>{selectedMember?.nama ?? '-'}</strong>
                  <span>{selectedMember?.email ?? 'Belum ada email member.'}</span>
                </div>
                <div className="finance-member-highlight">
                  <small>Total kontribusi</small>
                  <strong>{currency.format(memberSummary.total)}</strong>
                </div>
              </div>

              <div className="dashboard-inline-tools finance-export-tools">
                <button
                  type="button"
                  className="button-filter"
                  onClick={handleMemberExportPdf}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'member-pdf' ? 'Menyiapkan PDF...' : 'Export Member PDF'}
                </button>
                <button
                  type="button"
                  className="button-filter"
                  onClick={handleMemberExportExcel}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'member-excel'
                    ? 'Menyiapkan Excel...'
                    : 'Export Member Excel'}
                </button>
                {preparedMemberExcel ? (
                  <a
                    className="button-filter"
                    href={preparedMemberExcel.url}
                    download={preparedMemberExcel.filename}
                  >
                    Download Member Excel
                  </a>
                ) : null}
              </div>

              <div className="mini-metric-grid">
                <div className="mini-metric">
                  <span>Total transaksi</span>
                  <strong>{memberSummary.count}</strong>
                </div>
                <div className="mini-metric">
                  <span>Transaksi aktif</span>
                  <strong>{memberSummary.active}</strong>
                </div>
                <div className="mini-metric">
                  <span>Kontribusi aktif</span>
                  <strong>{currency.format(memberSummary.total)}</strong>
                </div>
                <div className="mini-metric">
                  <span>Status dominan</span>
                  <strong>{memberSummary.active > 0 ? 'Aktif' : 'Belum aktif'}</strong>
                </div>
              </div>

              <div className="member-transaction-list finance-drawer-transaction-list">
                {memberTransactions.length === 0 ? (
                  <p>Belum ada transaksi untuk member ini pada filter yang dipilih.</p>
                ) : (
                  memberTransactions.map((payment) => (
                    <div key={payment.id} className="task-row finance-transaction-row">
                      <div className="finance-transaction-copy">
                        <strong>{payment.pkg?.nama_paket ?? '-'}</strong>
                        <span>{payment.pkg?.deskripsi ?? 'Membership Gym Familly'}</span>
                        <small>
                          {payment.financeDate
                            ? formatDisplayDate(payment.financeDate)
                            : 'Tanpa tanggal'}
                        </small>
                      </div>
                      <div className="finance-transaction-meta">
                        <StatusBadge status={payment.status} />
                        <small>{payment.payment_method ?? 'Manual transfer'}</small>
                        <strong>{currency.format(payment.amount)}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
};
