import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../hooks/usePageTitle";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    nama: "",
    email: "",
    whatsapp: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  usePageTitle("Daftar");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setSubmitting(true);

    try {
      await register(form);
      navigate("/member");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Terjadi kesalahan saat registrasi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="panel auth-showcase-card register">
        <span className="eyebrow">Daftar</span>
        <h1>Buat akun member dan mulai membership lebih cepat.</h1>
        <p>
          Setelah akun dibuat, kamu bisa pilih paket, kirim pembayaran, dan cek
          status dari dashboard.
        </p>
        <div className="task-list">
          <div className="task-row">
            <strong>1. Isi data dasar</strong>
            <span>Nama, email, WhatsApp</span>
          </div>
          <div className="task-row">
            <strong>2. Pilih paket</strong>
            <span>Sesuaikan dengan kebutuhan latihan</span>
          </div>
          <div className="task-row">
            <strong>3. Kirim pembayaran</strong>
            <span>Admin akan verifikasi membership</span>
          </div>
        </div>
        <div className="auth-trust-row">
          <span className="table-chip success">Registrasi mandiri</span>
          <span className="table-chip subtle">Pilih paket</span>
          <span className="table-chip warning">Verifikasi admin</span>
        </div>
      </div>

      <div className="auth-card premium-auth-card">
        <div className="auth-card-header">
          <span className="eyebrow">Registrasi Member</span>
          <h2>Buat akun</h2>
          <p>Isi data dasar untuk mulai menggunakan sistem.</p>
        </div>
        <form className="form-grid premium-auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Nama Lengkap</span>
            <input
              value={form.nama}
              onChange={(event) =>
                setForm({ ...form, nama: event.target.value })
              }
              placeholder="Contoh: Ariel Noah"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              type="email"
              placeholder="contoh@email.com"
              required
            />
          </label>
          <label>
            <span>Nomor WhatsApp</span>
            <input
              value={form.whatsapp}
              onChange={(event) =>
                setForm({ ...form, whatsapp: event.target.value })
              }
              placeholder="08xxxxxxxxxx"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                type={showPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            type="submit"
            className="button-primary"
            disabled={submitting}
          >
            {submitting ? "Mendaftarkan..." : "Daftar"}
          </button>
        </form>
        <div className="auth-benefit-list">
          <div className="auth-benefit-item">
            <strong>Langsung pilih paket</strong>
            <small>Data akun tetap dipakai saat lanjut membership.</small>
          </div>
          <div className="auth-benefit-item">
            <strong>Barcode aktif setelah verifikasi</strong>
            <small>
              Status membership akan diperbarui setelah dicek admin.
            </small>
          </div>
        </div>
        <div className="auth-footer-line">
          <small>Sudah punya akun?</small>
          <Link to="/login" className="button-filter">
            Masuk
          </Link>
        </div>
      </div>
    </section>
  );
};
