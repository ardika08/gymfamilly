export type Role = 'admin' | 'member';

export type AccountStatus = 'aktif' | 'nonaktif';

export type MembershipStatus =
  | 'aktif'
  | 'menunggu_pembayaran'
  | 'kedaluwarsa';

export interface User {
  id: number;
  nama: string;
  email: string;
  role: Role;
  whatsapp: string;
  account_status: AccountStatus;
  created_at?: string | null;
}

export interface GymPackage {
  id: number;
  nama_paket: string;
  promo_label?: string | null;
  harga_normal: number;
  harga_promo?: number | null;
  deskripsi: string;
  durasi_hari: number;
}

export interface Membership {
  id: number;
  user_id: number;
  package_id: number;
  created_at?: string | null;
  tanggal_mulai?: string | null;
  tanggal_berakhir?: string | null;
  status: MembershipStatus;
  payment_method?: string | null;
  payment_proof?: string | null;
  payment_url?: string | null;
  voucher_id?: number | null;
  voucher_diskon?: number;
}

export interface PaymentMethodSetting {
  code: string;
  label: string;
  accountNumber: string;
  accountName?: string | null;
}

export interface Expense {
  id: number;
  label: string;
  nominal: number;
  tanggal: string;
  kategori: string;
}

export interface Attendance {
  id: number;
  user_id: number;
  waktu_scan: string;
  hasil?: 'berhasil' | 'ditolak';
  catatan?: string | null;
}

export interface Message {
  id: number;
  pengirim_id: number;
  penerima_id: number;
  isi_pesan: string;
  waktu_kirim: string;
}

export interface DashboardSummary {
  activeMembers: number;
  pendingPayments: number;
  monthlyRevenue: number;
  attendanceToday: number;
  expiringSoonCount: number;
}

export interface AppDatabase {
  users: User[];
  packages: GymPackage[];
  memberships: Membership[];
  expenses: Expense[];
  attendances: Attendance[];
  messages: Message[];
}

export interface PaymentReportInput {
  userId: number;
  packageId: number;
  paymentMethod: string;
  paymentProof: File;
  voucherKode?: string;
}

export interface RegisterInput {
  nama: string;
  email: string;
  whatsapp: string;
  password: string;
}

export type VoucherTipe = 'percent' | 'fixed' | 'free' | 'bonus_days';

export interface Voucher {
  id: number;
  kode: string;
  deskripsi?: string | null;
  tipe: VoucherTipe;
  nilai: number;
  maks_penggunaan?: number | null;
  maks_per_user: number;
  valid_dari?: string | null;
  valid_hingga?: string | null;
  status: 'aktif' | 'nonaktif';
  total_digunakan: number;
  created_at?: string | null;
}

export interface VoucherCheckResult {
  kode: string;
  tipe: VoucherTipe;
  nilai: number;
  diskon: number;
  harga_akhir: number;
  bonus_days: number;
  deskripsi?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}
