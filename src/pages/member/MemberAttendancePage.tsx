import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { attendanceService } from '../../services/api';
import type { Attendance } from '../../types/models';
import { formatDisplayDate, formatDisplayTime } from '../../utils/date';

export const MemberAttendancePage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Attendance[]>([]);
  usePageTitle('Riwayat Kehadiran');

  useEffect(() => {
    if (!user) {
      return;
    }
    attendanceService.listByUser(user.id).then(setItems);
  }, [user]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Kehadiran"
        title="Riwayat datang ke gym"
        description="Setiap scan barcode yang valid akan tercatat otomatis di sini."
      />
      <section className="section-intro-card">
        <div>
          <small>Total check-in</small>
          <strong>{items.length} kunjungan tercatat</strong>
          <p>Riwayat kehadiran kamu di Gym Familly. Setiap scan barcode yang berhasil akan muncul di sini.</p>
        </div>
        <div className="section-intro-meta">
          <span>Status</span>
          <strong>Tersimpan otomatis</strong>
        </div>
      </section>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Riwayat scan member</h3>
            <p>Waktu scan terbaru akan tampil di bagian atas.</p>
          </div>
          <span className="table-chip">{items.length} scan</span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="Belum ada riwayat scan"
            description="Datang ke gym dan lakukan scan barcode untuk melihat histori kehadiran."
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(item.waktu_scan)}</strong>
                          <small>Scan member</small>
                        </div>
                      </td>
                      <td>
                        <span className="table-chip subtle">{formatDisplayTime(item.waktu_scan)}</span>
                      </td>
                      <td>
                        <span className="table-chip">Berhasil</span>
                      </td>
                      <td>
                        <div className="table-primary">
                          <strong>Check-in Gym Familly</strong>
                          <small>Scan barcode valid tercatat otomatis.</small>
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
    </div>
  );
};
