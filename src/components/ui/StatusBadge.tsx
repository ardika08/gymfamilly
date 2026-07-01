import type { MembershipStatus } from '../../types/models';

const labelMap: Record<MembershipStatus, string> = {
  aktif: 'Aktif',
  menunggu_pembayaran: 'Menunggu Pembayaran',
  kedaluwarsa: 'Kedaluwarsa',
};

export const StatusBadge = ({
  status,
  label,
  tone,
}: {
  status: MembershipStatus;
  label?: string;
  tone?: 'warning';
}) => (
  <span className={`status-badge status-${tone ?? status}`}>{label ?? labelMap[status]}</span>
);
