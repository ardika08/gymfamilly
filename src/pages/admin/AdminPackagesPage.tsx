import { useEffect, useState } from 'react';
import { PackageCard } from '../../components/ui/PackageCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePageTitle } from '../../hooks/usePageTitle';
import { packageService } from '../../services/api';
import type { GymPackage } from '../../types/models';

export const AdminPackagesPage = () => {
  const [items, setItems] = useState<GymPackage[]>([]);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GymPackage | null>(null);
  const [form, setForm] = useState({
    nama_paket: '',
    promo_label: 'Promo',
    harga_normal: '',
    harga_promo: '',
    deskripsi: '',
  });
  usePageTitle('Kelola Paket');

  const refresh = () => {
    packageService.list().then(setItems);
  };

  useEffect(() => {
    refresh();
  }, []);

  const resetForm = () => {
    setEditingPackageId(null);
    setForm({
      nama_paket: '',
      promo_label: 'Promo',
      harga_normal: '',
      harga_promo: '',
      deskripsi: '',
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await packageService.save({
      id: editingPackageId ?? undefined,
      nama_paket: form.nama_paket,
      promo_label: form.promo_label,
      harga_normal: Number(form.harga_normal),
      harga_promo: form.harga_promo ? Number(form.harga_promo) : null,
      deskripsi: form.deskripsi,
    });
    resetForm();
    refresh();
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Paket & Promo"
        title="Kelola katalog Gym Familly"
        description="Admin bisa menambah paket baru dan memperbarui penawaran promo dari dashboard."
      />
      <section className="premium-form-shell">
        <div className="premium-form-intro">
          <span className="eyebrow">Editor Paket</span>
          <h3>
            {editingPackageId
              ? 'Perbarui paket aktif tanpa mengubah struktur katalog.'
              : 'Tambahkan paket baru dengan harga dan positioning promo yang jelas.'}
          </h3>
          <p>
            {editingPackageId
              ? 'Edit paket dari katalog aktif, lalu simpan perubahan agar langsung sinkron ke dashboard lokal.'
              : 'Gunakan area ini untuk menjaga katalog Gym Familly tetap rapi, gampang dibaca member, dan selaras dengan benefit utamanya.'}
          </p>
          <div className="form-stat-card">
            <small>Total paket aktif</small>
            <strong>{items.length}</strong>
          </div>
        </div>
        <section className="panel premium-form-panel">
          <form className="form-grid premium-form-grid" onSubmit={handleSubmit}>
            <label>
              <span>Nama Paket</span>
              <input
                value={form.nama_paket}
                onChange={(event) => setForm({ ...form, nama_paket: event.target.value })}
                placeholder="Contoh: Paket 3 Bulan Intensif"
                required
              />
              <small>Nama harus langsung menjelaskan durasi atau segmen paket.</small>
            </label>
            <label>
              <span>Label Promo</span>
              <input
                value={form.promo_label}
                onChange={(event) => setForm({ ...form, promo_label: event.target.value })}
                placeholder="Contoh: Promo"
                required
              />
              <small>Label kecil yang tampil di badge card paket.</small>
            </label>
            <label>
              <span>Harga Normal</span>
              <input
                value={form.harga_normal}
                onChange={(event) => setForm({ ...form, harga_normal: event.target.value })}
                type="number"
                placeholder="330000"
                required
              />
              <small>Harga dasar sebelum promo dicoret di halaman katalog.</small>
            </label>
            <label>
              <span>Harga Promo</span>
              <input
                value={form.harga_promo}
                onChange={(event) => setForm({ ...form, harga_promo: event.target.value })}
                type="number"
                placeholder="299000"
              />
              <small>Kosongkan jika paket tidak sedang promo.</small>
            </label>
            <label className="field-span-2">
              <span>Deskripsi Benefit</span>
              <input
                value={form.deskripsi}
                onChange={(event) => setForm({ ...form, deskripsi: event.target.value })}
                required
              />
              <small>Contoh: Akses harian atau bonus fasilitas.</small>
            </label>
            <div className="form-actions-row field-span-2">
              <button type="submit" className="button-primary">
                {editingPackageId ? 'Update Paket' : 'Simpan Paket'}
              </button>
              {editingPackageId ? (
                <button type="button" className="button-filter" onClick={resetForm}>
                  Batal Edit
                </button>
              ) : null}
              <span className="form-helper-note">Perubahan langsung sinkron ke aplikasi.</span>
            </div>
          </form>
        </section>
      </section>
      <div className="card-grid">
        {items.map((item) => (
          <PackageCard
            key={item.id}
            item={item}
            adminAction={
              <div className="package-admin-actions">
                <button
                  type="button"
                  className="package-menu-trigger button-reset"
                  onClick={() =>
                    setOpenMenuId((current) => (current === item.id ? null : item.id))
                  }
                >
                  &#8942;
                </button>
                {openMenuId === item.id ? (
                  <div className="package-action-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPackageId(item.id);
                        setForm({
                          nama_paket: item.nama_paket,
                          promo_label: item.promo_label ?? 'Promo',
                          harga_normal: String(item.harga_normal),
                          harga_promo: item.harga_promo ? String(item.harga_promo) : '',
                          deskripsi: item.deskripsi,
                        });
                        setOpenMenuId(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit Paket
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setDeleteTarget(item);
                        setOpenMenuId(null);
                      }}
                    >
                      Hapus Paket
                    </button>
                  </div>
                ) : null}
              </div>
            }
          />
        ))}
      </div>
      {deleteTarget ? (
        <div className="proof-modal-overlay">
          <div className="proof-modal-card success-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="success-modal-badge">Konfirmasi Hapus</div>
            <h3>Hapus paket dari katalog?</h3>
            <p>
              Paket <strong>{deleteTarget.nama_paket}</strong> akan dihapus dari katalog aktif.
              Tindakan ini langsung mengubah data aplikasi.
            </p>
            <div className="inline-actions success-modal-actions">
              <button
                type="button"
                className="button-filter"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="table-action-button"
                onClick={async () => {
                  await packageService.remove(deleteTarget.id);
                  setDeleteTarget(null);
                  if (editingPackageId === deleteTarget.id) {
                    resetForm();
                  }
                  refresh();
                }}
              >
                Hapus Paket
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
