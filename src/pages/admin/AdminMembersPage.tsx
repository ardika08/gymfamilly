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
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    nama: '',
    email: '',
    whatsapp: '',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('semua');
  usePageTitle('Daftar Member');

  const loadMembers = async () => {
    const items = await adminService.members();
    setMembers(items);
    setSelectedMemberId((current) => current ?? items[0]?.id ?? null);
    const entries = await Promise.all(
      items.map(async (member) => [member.id, await membershipService.currentByUser(member.id)] as const),
    );
    setMemberships(Object.fromEntries(entries));
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const expiringSoonMembers = useMemo(
    () =>
      members.filter((member) => membershipHelpers.isExpiringSoon(memberships[member.id] ?? null)),
    [members, memberships],
  );

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const membership = memberships[member.id] ?? null;
      const expiringSoon = membershipHelpers.isExpiringSoon(membership);

      switch (memberFilter) {
        case 'aktif':
          return membership?.status === 'aktif' && !expiringSoon;
        case 'segera_berakhir':
          return expiringSoon;
        case 'kedaluwarsa':
          return membership?.status === 'kedaluwarsa';
        default:
          return true;
      }
    });
  }, [memberFilter, members, memberships]);

  useEffect(() => {
    if (!selectedMember) {
      setFormState({ nama: '', email: '', whatsapp: '' });
      return;
    }

    setFormState({
      nama: selectedMember.nama,
      email: selectedMember.email,
      whatsapp: selectedMember.whatsapp,
    });
  }, [selectedMember]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember) {
      return;
    }

    try {
      const updated = await adminService.updateMember(selectedMember.id, formState);
      setMembers((current) =>
        current.map((member) => (member.id === updated.id ? updated : member)),
      );
      setFeedback('Data member berhasil diperbarui.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gagal memperbarui member.');
    }
  };

  const handleToggleStatus = async (memberId: number) => {
    setFeedback(null);
    try {
      const updated = await adminService.toggleMemberStatus(memberId);
      setMembers((current) =>
        current.map((member) => (member.id === updated.id ? updated : member)),
      );
      setFeedback(
        updated.account_status === 'aktif'
          ? 'Akun member berhasil diaktifkan kembali.'
          : 'Akun member berhasil dinonaktifkan.',
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gagal mengubah status member.');
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Member"
        title="Daftar member Gym Familly"
        description="Lihat data dasar member beserta status membership terakhir mereka."
      />
      {expiringSoonMembers.length > 0 ? (
        <section className="section-intro-card warning">
          <div>
            <span className="eyebrow">Reminder H-3</span>
            <strong>{expiringSoonMembers.length} member mendekati masa expired.</strong>
            <p>
              Admin bisa langsung follow-up dari halaman ini sebelum membership benar-benar
              berakhir.
            </p>
          </div>
          <div className="section-intro-meta">
            <strong>Segera hubungi</strong>
            <span className="form-helper-note">Prioritaskan member dengan status warning</span>
          </div>
        </section>
      ) : null}
      {selectedMember ? (
        <section className="premium-form-shell">
          <article className="premium-form-intro">
            <span className="eyebrow">Kelola member</span>
            <h3>Perbarui data member tanpa keluar dari dashboard.</h3>
            <p>
              Edit nama, email, dan WhatsApp member. Untuk aksi hapus, versi aman yang
              dipakai saat ini adalah nonaktifkan akun.
            </p>
            <div className="trend-summary">
              <div className="list-item">
                <small>Status akun</small>
                <strong>{selectedMember.account_status === 'aktif' ? 'Aktif' : 'Nonaktif'}</strong>
              </div>
              <div className="list-item">
                <small>Status paket</small>
                <strong>
                  {membershipHelpers.isExpiringSoon(memberships[selectedMember.id] ?? null)
                    ? 'Segera berakhir'
                    : memberships[selectedMember.id]?.status
                      ? memberships[selectedMember.id]!.status
                    : 'Belum ada paket'}
                </strong>
              </div>
            </div>
          </article>

          <article className="panel premium-form-panel">
            <form className="premium-form-grid member-edit-form" onSubmit={handleSubmit}>
              <label>
                <span>Pilih member</span>
                <select
                  value={selectedMemberId ?? ''}
                  onChange={(event) => {
                    setSelectedMemberId(Number(event.target.value));
                    setFeedback(null);
                  }}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nama}
                    </option>
                  ))}
                </select>
              </label>
              <div className="member-action-stack">
                <span className={`table-chip ${selectedMember.account_status === 'aktif' ? '' : 'subtle'}`}>
                  {selectedMember.account_status === 'aktif' ? 'Akun aktif' : 'Akun nonaktif'}
                </span>
                <button
                  type="button"
                  className="button-filter"
                  onClick={() => handleToggleStatus(selectedMember.id)}
                >
                  {selectedMember.account_status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
              <label>
                <span>Nama member</span>
                <input
                  value={formState.nama}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, nama: event.target.value }))
                  }
                  placeholder="Contoh: Raka Pratama"
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="member@email.com"
                  required
                />
              </label>
              <label className="field-span-2">
                <span>WhatsApp</span>
                <input
                  value={formState.whatsapp}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, whatsapp: event.target.value }))
                  }
                  placeholder="08xxxxxxxxxx"
                  required
                />
              </label>
              <div className="form-actions-row field-span-2">
                <button type="submit" className="table-action-button">
                  Simpan perubahan
                </button>
                {feedback ? <span className="form-helper-note">{feedback}</span> : null}
              </div>
            </form>
          </article>
        </section>
      ) : null}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Direktori member</h3>
            <p>Semua akun member yang telah terdaftar pada sistem.</p>
          </div>
          <span className="table-chip">{filteredMembers.length} member</span>
        </div>
        <div className="dashboard-inline-tools member-filter-row">
          <button
            type="button"
            className={`button-filter ${memberFilter === 'semua' ? 'is-active' : ''}`}
            onClick={() => setMemberFilter('semua')}
          >
            Semua
          </button>
          <button
            type="button"
            className={`button-filter ${memberFilter === 'aktif' ? 'is-active' : ''}`}
            onClick={() => setMemberFilter('aktif')}
          >
            Aktif
          </button>
          <button
            type="button"
            className={`button-filter ${memberFilter === 'segera_berakhir' ? 'is-active' : ''}`}
            onClick={() => setMemberFilter('segera_berakhir')}
          >
            Segera berakhir
          </button>
          <button
            type="button"
            className={`button-filter ${memberFilter === 'kedaluwarsa' ? 'is-active' : ''}`}
            onClick={() => setMemberFilter('kedaluwarsa')}
          >
            Kedaluwarsa
          </button>
        </div>
        {members.length === 0 ? (
          <EmptyState title="Belum ada member" description="Member baru akan muncul setelah registrasi." />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            title="Tidak ada member pada filter ini"
            description="Coba ganti filter untuk melihat member dengan status lain."
          />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Tanggal Terdaftar</th>
                  <th>Tanggal Expired</th>
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
                        <small>ID member #{member.id}</small>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>{member.whatsapp}</td>
                    <td>
                      <div className="finance-table-period">
                        <strong>{formatDisplayDate(member.created_at)}</strong>
                        <small>Tanggal akun dibuat</small>
                      </div>
                    </td>
                    <td>
                      <div className="finance-table-period">
                        <strong>{formatDisplayDate(membership?.tanggal_berakhir)}</strong>
                        <small>
                          {expiringSoon
                            ? `Sisa ${daysRemaining} hari`
                            : membership
                              ? 'Masa aktif terakhir'
                              : 'Belum ada membership'}
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
                        <span className="table-chip subtle">Belum ada paket</span>
                      )}
                    </td>
                    <td>
                      <div className="member-table-actions">
                        <button
                          type="button"
                          className="button-filter"
                          onClick={() => {
                            setSelectedMemberId(member.id);
                            setFeedback(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-filter"
                          onClick={() => handleToggleStatus(member.id)}
                        >
                          {member.account_status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
