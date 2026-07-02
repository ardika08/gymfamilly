import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { voucherService } from '../../services/api';
import type { Voucher, VoucherTipe } from '../../types/models';

const TIPE_LABEL: Record<VoucherTipe, string> = {
  percent: 'Persen (%)',
  fixed: 'Nominal (Rp)',
  free: 'Gratis (100%)',
  bonus_days: 'Bonus Hari',
};

const TIPE_HINT: Record<VoucherTipe, string> = {
  percent: 'Diskon dalam persen (1–100)',
  fixed: 'Potongan nominal dalam Rupiah',
  free: 'Gratis, nilai dikunci ke 100',
  bonus_days: 'Tambah hari bonus (tidak mengurangi harga)',
};

const emptyForm = {
  kode: '',
  deskripsi: '',
  tipe: 'percent' as VoucherTipe,
  nilai: 10,
  maks_penggunaan: '' as number | '',
  maks_per_user: 1,
  valid_dari: '',
  valid_hingga: '',
  status: 'aktif' as 'aktif' | 'nonaktif',
};

type FormState = typeof emptyForm;

export const AdminVouchersPage = () => {
  usePageTitle('Voucher');
  const [items, setItems] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Voucher | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Voucher | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await voucherService.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (v: Voucher) => {
    setEditTarget(v);
    setForm({
      kode: v.kode,
      deskripsi: v.deskripsi ?? '',
      tipe: v.tipe,
      nilai: v.nilai,
      maks_penggunaan: v.maks_penggunaan ?? '',
      maks_per_user: v.maks_per_user,
      valid_dari: v.valid_dari ? v.valid_dari.slice(0, 10) : '',
      valid_hingga: v.valid_hingga ? v.valid_hingga.slice(0, 10) : '',
      status: v.status,
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        kode: form.kode.toUpperCase().trim(),
        nilai: form.tipe === 'free' ? 100 : Number(form.nilai),
        maks_penggunaan: form.maks_penggunaan === '' ? null : Number(form.maks_penggunaan),
        maks_per_user: Number(form.maks_per_user),
        valid_dari: form.valid_dari || null,
        valid_hingga: form.valid_hingga || null,
        deskripsi: form.deskripsi || null,
      };

      if (editTarget) {
        await voucherService.update(editTarget.id, payload as any);
        setSuccess('Voucher berhasil diperbarui.');
      } else {
        await voucherService.create(payload as any);
        setSuccess('Voucher berhasil dibuat.');
      }

      setShowForm(false);
      await refresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan voucher.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Voucher) => {
    try {
      await voucherService.remove(v.id);
      setDeleteConfirm(null);
      setSuccess('Voucher berhasil dihapus.');
      await refresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus voucher.');
    }
  };

  const formatNilai = (v: Voucher) => {
    if (v.tipe === 'percent' || v.tipe === 'free') return `${v.nilai}%`;
    if (v.tipe === 'bonus_days') return `+${v.nilai} hari`;
    return `Rp ${v.nilai.toLocaleString('id-ID')}`;
  };

  const formatDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Voucher"
        title="Kelola kode voucher"
        description="Buat dan kelola voucher diskon untuk member gym."
      />

      <section className="section-intro-card">
        <div>
          <small>Total voucher</small>
          <strong>{items.length} voucher terdaftar</strong>
          <p>Buat voucher persen, nominal, gratis, atau bonus hari masa aktif.</p>
        </div>
        <div className="section-intro-meta">
          <span>Aktif</span>
          <strong>{items.filter((v) => v.status === 'aktif').length}</strong>
        </div>
      </section>

      {success ? <p className="form-success">{success}</p> : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Daftar voucher</h3>
            <p>Klik edit untuk mengubah atau nonaktifkan voucher.</p>
          </div>
          <button type="button" className="button-primary" onClick={openCreate}>
            + Buat Voucher
          </button>
        </div>

        {loading ? (
          <p style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Memuat...</p>
        ) : items.length === 0 ? (
          <EmptyState title="Belum ada voucher" description="Klik tombol Buat Voucher untuk memulai." />
        ) : (
          <div className="table-wrap premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tipe</th>
                  <th>Nilai</th>
                  <th>Pemakaian</th>
                  <th>Berlaku</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{v.kode}</strong>
                        <small>{v.deskripsi ?? '—'}</small>
                      </div>
                    </td>
                    <td><span className="table-chip subtle">{TIPE_LABEL[v.tipe]}</span></td>
                    <td><strong>{formatNilai(v)}</strong></td>
                    <td>
                      <div className="table-primary">
                        <strong>{v.total_digunakan}x</strong>
                        <small>maks {v.maks_penggunaan ?? '∞'} / per user {v.maks_per_user}x</small>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <small>Dari: {formatDate(v.valid_dari)}</small>
                        <small>S/d: {formatDate(v.valid_hingga)}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`table-chip ${v.status === 'aktif' ? '' : 'subtle'}`}>
                        {v.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button type="button" className="table-action-button" onClick={() => openEdit(v)}>Edit</button>
                        <button
                          type="button"
                          className="table-action-button"
                          style={{ color: 'var(--color-danger, #ef4444)' }}
                          onClick={() => setDeleteConfirm(v)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Form modal */}
      {showForm ? (
        <div className="proof-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="proof-modal-card" style={{ maxWidth: 520, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-toolbar">
              <div>
                <h3>{editTarget ? 'Edit Voucher' : 'Buat Voucher Baru'}</h3>
                <p>Isi detail voucher di bawah ini.</p>
              </div>
              <button type="button" className="button-filter" onClick={() => setShowForm(false)}>Tutup</button>
            </div>

            <form className="form-grid premium-form-grid" onSubmit={handleSave} style={{ padding: '0 1rem 1rem' }}>
              <label>
                <span>Kode Voucher</span>
                <input
                  type="text"
                  value={form.kode}
                  onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })}
                  placeholder="Contoh: GYM20"
                  required
                  maxLength={50}
                />
              </label>
              <label>
                <span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'aktif' | 'nonaktif' })}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </label>
              <label className="field-span-2">
                <span>Deskripsi <small style={{ fontWeight: 'normal' }}>(opsional)</small></span>
                <input
                  type="text"
                  value={form.deskripsi}
                  onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  placeholder="Contoh: Diskon 20% untuk member baru"
                  maxLength={255}
                />
              </label>
              <label>
                <span>Tipe Diskon</span>
                <select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value as VoucherTipe })}>
                  {(Object.keys(TIPE_LABEL) as VoucherTipe[]).map((t) => (
                    <option key={t} value={t}>{TIPE_LABEL[t]}</option>
                  ))}
                </select>
                <small>{TIPE_HINT[form.tipe]}</small>
              </label>
              <label>
                <span>Nilai</span>
                <input
                  type="number"
                  min={1}
                  max={form.tipe === 'percent' ? 100 : undefined}
                  value={form.tipe === 'free' ? 100 : form.nilai}
                  disabled={form.tipe === 'free'}
                  onChange={(e) => setForm({ ...form, nilai: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                <span>Maks. Total Penggunaan <small style={{ fontWeight: 'normal' }}>(kosong = unlimited)</small></span>
                <input
                  type="number"
                  min={1}
                  value={form.maks_penggunaan}
                  onChange={(e) => setForm({ ...form, maks_penggunaan: e.target.value === '' ? '' : Number(e.target.value) })}
                  placeholder="Unlimited"
                />
              </label>
              <label>
                <span>Maks. Per User</span>
                <input
                  type="number"
                  min={1}
                  value={form.maks_per_user}
                  onChange={(e) => setForm({ ...form, maks_per_user: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                <span>Berlaku Dari <small style={{ fontWeight: 'normal' }}>(opsional)</small></span>
                <input type="date" value={form.valid_dari} onChange={(e) => setForm({ ...form, valid_dari: e.target.value })} />
              </label>
              <label>
                <span>Berlaku Hingga <small style={{ fontWeight: 'normal' }}>(opsional)</small></span>
                <input type="date" value={form.valid_hingga} onChange={(e) => setForm({ ...form, valid_hingga: e.target.value })} />
              </label>

              {error ? <p className="form-error field-span-2">{error}</p> : null}

              <div className="form-actions-row field-span-2">
                <button type="submit" className="button-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Buat Voucher'}
                </button>
                <button type="button" className="button-filter" onClick={() => setShowForm(false)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete confirm modal */}
      {deleteConfirm ? (
        <div className="proof-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="proof-modal-card success-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-badge blocked-modal-badge">Hapus Voucher</div>
            <h3>Yakin hapus voucher <strong>{deleteConfirm.kode}</strong>?</h3>
            <p>Tindakan ini tidak bisa dibatalkan. Riwayat pemakaian juga akan terhapus.</p>
            <div className="inline-actions success-modal-actions">
              <button type="button" className="button-primary" style={{ background: 'var(--color-danger, #ef4444)' }} onClick={() => handleDelete(deleteConfirm)}>
                Ya, Hapus
              </button>
              <button type="button" className="button-filter" onClick={() => setDeleteConfirm(null)}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
