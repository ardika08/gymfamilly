import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, membershipHelpers, membershipService } from '../../services/api';
import type { Membership, User } from '../../types/models';
import { formatDisplayDate } from '../../utils/date';

type MemberFilter = 'semua' | 'aktif' | 'segera_berakhir' | 'kedaluwarsa';

export const AdminMembersPage = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [memberships, setMemberships] = useState<Record<number, Membership | null>>({});
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal state
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [formState, setFormState] = useState({ nama: '', email: '', whatsapp: '' });
  const [editFeedback, setEditFeedback] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Toggle status confirm modal
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);

  usePageTitle('Daftar Member');

  const loadMembers = async () => {
    const items = await adminService.members();
    setMembers(items);
    const entries = await Promise.all(
      items.map(async (member) => [member.id, await membershipService.currentByUser(member.id)] as const),
    );
    setMemberships(Object.fromEntries(entries));
  };

  useEffect(() => { loadMembers(); }, []);

  const expiringSoonMembers = useMemo(
    () => members.filter((m) => membershipHelpers.isExpiringSoon(memberships[m.id] ?? null)),
    [members, memberships],
  );

  const filteredMembers = useMemo(() => {
    return members
      .filter((member) => {
        const membership = memberships[member.id] ?? null;
        const expiringSoon = membershipHelpers.isExpiringSoon(membership);
        switch (memberFilter) {
          case 'aktif': return membership?.status === 'aktif' && !expiringSoon;
          case 'segera_berakhir': return expiringSoon;
          case 'kedaluwarsa': return membership?.status === 'kedaluwarsa';
          default: return true;
        }
      })
      .filter((member) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          member.nama.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q) ||
          member.whatsapp.includes(q)
        );
      });
  }, [memberFilter, searchQuery, members, memberships]);

  // Buka modal edit
  const openEdit = (member: User) => {
    setEditTarget(member);
    setFormState({ nama: member.nama, email: member.email, whatsapp: member.whatsapp });
    setEditFeedback('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditFeedback('');
    try {
      const updated = await adminService.updateMember(editTarget.id, formState);
      setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m)));
      setEditFeedback('✓ Data berhasil diperbarui.');
      setTimeout(() => setEditTarget(null), 800);
    } catch (error) {
      setEditFeedback(error instanceof Error ? error.message : 'Gagal memperbarui data.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    try {
      const updated = await adminService.toggleMemberStatus(toggleTarget.id);
      setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    } catch {}
    setToggleTarget(null);
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Member"
        title="Daftar member Gym Familly"
        description="Lihat, cari, dan kelola data member beserta status membership mereka."
      />

      {expiringSoonMembers.length > 0 ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Jatuh tempo H-3</span>
            <strong>{expiringSoonMembers.length} member mendekati akhir masa aktif.</strong>
            <p>Segera hubungi mereka agar tidak terlambat memperpanjang membership.</p>
          </div>
          <div className="section-intro-meta">
            <strong>Segera hubungi</strong>
            <span className="form-helper-note">{expiringSoonMembers.map((m) => m.nama).join(', ')}</span>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Direktori member</h3>
            <p>Semua akun member yang terdaftar.</p>
          </div>
          <span className="table-chip">{filteredMembers.length} member</span>
        </div>

        {/* Search + Filter */}
        <div className="dashboard-inline-tools member-filter-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            type="search"
            placeholder="Cari nama, email, atau WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 200px',
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid var(--line-soft)',
              fontSize: '0.85rem',
              outline: 'none',
              background: 'var(--bg-card, #fff)',
            }}
          />
          {(['semua', 'aktif', 'segera_berakhir', 'kedaluwarsa'] as MemberFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`button-filter ${memberFilter === f ? 'is-active' : ''}`}
              onClick={() => setMemberFilter(f)}
            >
              {f === 'semua' ? 'Semua'
                : f === 'aktif' ? 'Aktif'
                : f === 'segera_berakhir' ? 'Segera berakhir'
                : 'Kedaluwarsa'}
            </button>
          ))}
        </div>

        {members.length === 0 ? (
          <EmptyState title="Belum ada member" description="Member baru akan muncul setelah registrasi." />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            title="Tidak ada hasil"
            description={searchQuery ? `Tidak ada member yang cocok dengan "${searchQuery}".` : 'Coba ganti filter untuk melihat member lain.'}
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Terdaftar</th>
                  <th>Expired</th>
                  <th>Status Akun</th>
                  <th>Status Membership</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const membership = memberships[member.id] ?? null;
                  const expiringSoon = membershipHelpers.isExpiringSoon(membership);
                  const daysRemaining = membershipHelpers.getDaysRemaining(membership);
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{member.nama}</strong>
                        </div>
                      </td>
                      <td>{member.email}</td>
                      <td>{member.whatsapp}</td>
                      <td>
                        <strong>{formatDisplayDate(member.created_at)}</strong>
                      </td>
                      <td>
                        <div className="finance-table-period">
                          <strong>{formatDisplayDate(membership?.tanggal_berakhir)}</strong>
                          <small>
                            {expiringSoon
                              ? `Sisa ${daysRemaining} hari`
                              : membership
                                ? 'Masa aktif terakhir'
                                : '—'}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span className={`table-chip ${member.account_status === 'aktif' ? '' : 'subtle'}`}>
                          {member.account_status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        {membership ? (
                          expiringSoon ? (
                            <StatusBadge status={membership.status} label="Segera berakhir" tone="warning" />
                          ) : (
                            <StatusBadge status={membership.status} />
                          )
                        ) : (
                          <span className="table-chip subtle">—</span>
                        )}
                      </td>
                      <td>
                        <div className="member-table-actions">
                          <button
                            type="button"
                            className="button-filter"
                            onClick={() => openEdit(member)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-filter"
                            onClick={() => setToggleTarget(member)}
                          >
                            {member.account_status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
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

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      {editTarget ? (
        <div className="proof-modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="proof-modal-card" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-toolbar">
              <div>
                <h3>Edit Data Member</h3>
                <p>{editTarget.nama}</p>
              </div>
              <button type="button" className="button-filter" onClick={() => setEditTarget(null)}>Tutup</button>
            </div>
            <form className="form-grid premium-form-grid" onSubmit={handleEditSubmit} style={{ padding: '0 1rem 1rem' }}>
              <label className="field-span-2">
                <span>Nama Lengkap</span>
                <input
                  value={formState.nama}
                  onChange={(e) => setFormState((s) => ({ ...s, nama: e.target.value }))}
                  required
                  placeholder="Nama lengkap member"
                />
              </label>
              <label className="field-span-2">
                <span>Email</span>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                  required
                  placeholder="member@email.com"
                />
              </label>
              <label className="field-span-2">
                <span>WhatsApp</span>
                <input
                  value={formState.whatsapp}
                  onChange={(e) => setFormState((s) => ({ ...s, whatsapp: e.target.value }))}
                  required
                  placeholder="08xxxxxxxxxx"
                />
              </label>
              {editFeedback ? (
                <p className={`field-span-2 ${editFeedback.startsWith('✓') ? 'form-success' : 'form-error'}`}>
                  {editFeedback}
                </p>
              ) : null}
              <div className="form-actions-row field-span-2">
                <button type="submit" className="button-primary" disabled={editSaving}>
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button type="button" className="button-filter" onClick={() => setEditTarget(null)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Konfirmasi Toggle Status ────────────────────────────── */}
      {toggleTarget ? (
        <div className="proof-modal-overlay" onClick={() => setToggleTarget(null)}>
          <div className="proof-modal-card success-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className={`success-modal-badge ${toggleTarget.account_status === 'aktif' ? 'blocked-modal-badge' : ''}`}>
              {toggleTarget.account_status === 'aktif' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
            </div>
            <h3>
              {toggleTarget.account_status === 'aktif'
                ? `Nonaktifkan akun ${toggleTarget.nama}?`
                : `Aktifkan kembali akun ${toggleTarget.nama}?`}
            </h3>
            <p>
              {toggleTarget.account_status === 'aktif'
                ? 'Member tidak akan bisa login dan menggunakan barcode sampai diaktifkan kembali.'
                : 'Member akan bisa login dan menggunakan layanan Gym Familly kembali.'}
            </p>
            <div className="inline-actions success-modal-actions">
              <button
                type="button"
                className="button-primary"
                style={toggleTarget.account_status === 'aktif' ? { background: 'var(--color-danger, #ef4444)' } : {}}
                onClick={handleToggleConfirm}
              >
                {toggleTarget.account_status === 'aktif' ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
              <button type="button" className="button-filter" onClick={() => setToggleTarget(null)}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
