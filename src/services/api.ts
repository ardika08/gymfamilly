import type {
  AppDatabase,
  Attendance,
  DashboardSummary,
  Expense,
  GymPackage,
  LoginInput,
  Membership,
  Message,
  PaymentMethodSetting,
  PaymentReportInput,
  RegisterInput,
  User,
} from '../types/models';

const SESSION_KEY = 'gym-familly-session';
const PACKAGE_EVENT = 'gymfamilly:packages-updated';
const PACKAGE_STORAGE_KEY = 'gym-familly-packages-updated-at';
const PAYMENT_METHOD_EVENT = 'gymfamilly:payment-methods-updated';
const PAYMENT_METHOD_STORAGE_KEY = 'gym-familly-payment-methods';
const PAYMENT_METHOD_STORAGE_SYNC_KEY = 'gym-familly-payment-methods-updated-at';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiEnvelope<T> = {
  data: T;
  message?: string | null;
};

type SessionState = {
  token: string;
};

const profileCache: AppDatabase = {
  users: [],
  packages: [],
  memberships: [],
  expenses: [],
  attendances: [],
  messages: [],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const readSession = (): SessionState | null => {
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionState) : null;
};

const writeSession = (session: SessionState) => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  window.localStorage.removeItem(SESSION_KEY);
};

const notifyPackagesUpdated = () => {
  window.localStorage.setItem(PACKAGE_STORAGE_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(PACKAGE_EVENT));
};

const defaultPaymentMethods: PaymentMethodSetting[] = [
  {
    code: 'BCA Manual',
    label: 'BCA Manual',
    accountNumber: '',
    accountName: 'Gym Familly',
  },
  {
    code: 'BRI Manual',
    label: 'BRI Manual',
    accountNumber: '',
    accountName: 'Gym Familly',
  },
  {
    code: 'Mandiri Manual',
    label: 'Mandiri Manual',
    accountNumber: '',
    accountName: 'Gym Familly',
  },
];

const readPaymentMethodSettings = (): PaymentMethodSetting[] => {
  const raw = window.localStorage.getItem(PAYMENT_METHOD_STORAGE_KEY);

  if (!raw) {
    return clone(defaultPaymentMethods);
  }

  try {
    const parsed = JSON.parse(raw) as PaymentMethodSetting[];
    return defaultPaymentMethods.map((fallback) => {
      const current = parsed.find((item) => item.code === fallback.code);
      return {
        ...fallback,
        ...current,
      };
    });
  } catch {
    return clone(defaultPaymentMethods);
  }
};

const writePaymentMethodSettings = (items: PaymentMethodSetting[]) => {
  window.localStorage.setItem(PAYMENT_METHOD_STORAGE_KEY, JSON.stringify(items));
  window.localStorage.setItem(PAYMENT_METHOD_STORAGE_SYNC_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(PAYMENT_METHOD_EVENT));
};

const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const syncMembershipStatus = (membership: Membership): Membership => {
  if (
    membership.status === 'aktif' &&
    membership.tanggal_berakhir &&
    membership.tanggal_berakhir < toLocalDateKey()
  ) {
    return {
      ...membership,
      status: 'kedaluwarsa',
    };
  }

  return membership;
};

const getMembershipDaysRemaining = (membership: Membership) => {
  if (!membership.tanggal_berakhir) {
    return null;
  }

  const endDate = parseDateKey(membership.tanggal_berakhir);
  const today = parseDateKey(toLocalDateKey());
  return Math.round((endDate.getTime() - today.getTime()) / 86400000);
};

const unwrap = async <T,>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Terjadi kesalahan saat menghubungi server.');
  }

  return (payload as ApiEnvelope<T>).data;
};

const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const session = readSession();
  const headers = new Headers(init?.headers);

  headers.set('Accept', 'application/json');

  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  }).catch(() => {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  });

  if (response.status === 401) {
    clearSession();
  }

  return unwrap<T>(response);
};

const apiGet = <T,>(path: string) => apiRequest<T>(path);

const apiPost = <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });

const apiPostForm = <T,>(path: string, body: FormData) =>
  apiRequest<T>(path, {
    method: 'POST',
    body,
    headers: {},
  });

const apiPut = <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });

const apiPatch = <T,>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });

const apiDelete = <T,>(path: string) =>
  apiRequest<T>(path, {
    method: 'DELETE',
  });

const setCurrentUser = (user: User | null) => {
  if (!user) {
    profileCache.users = profileCache.users.filter((item) => item.role === 'member');
    return;
  }

  const others = profileCache.users.filter((item) => item.id !== user.id);
  profileCache.users = [...others, user];
};

const cacheMembers = (users: User[]) => {
  const others = profileCache.users.filter((item) => item.role !== 'member');
  profileCache.users = [...others, ...users];
};

export const authService = {
  hasSession() {
    return Boolean(readSession()?.token);
  },
  async currentUser(options?: { throwOnFailure?: boolean }) {
    if (!readSession()) {
      return null;
    }

    try {
      const user = await apiGet<User>('/api/auth/me');
      setCurrentUser(user);
      return user;
    } catch (error) {
      clearSession();
      if (options?.throwOnFailure) {
        throw error instanceof Error
          ? error
          : new Error('Sesi login tidak dapat dipulihkan. Silakan masuk ulang.');
      }
      return null;
    }
  },
  async login(input: LoginInput) {
    const response = await apiPost<{ token: string; user: User }>('/api/auth/login', input);
    writeSession({ token: response.token });
    setCurrentUser(response.user);
    return response.user;
  },
  async register(input: RegisterInput) {
    const response = await apiPost<{ token: string; user: User }>('/api/auth/register', input);
    writeSession({ token: response.token });
    setCurrentUser(response.user);
    return response.user;
  },
  async logout() {
    try {
      await apiPost<boolean>('/api/auth/logout');
    } finally {
      clearSession();
    }
  },
};

export const packageService = {
  events: {
    updated: PACKAGE_EVENT,
    dbKey: PACKAGE_STORAGE_KEY,
  },
  async list() {
    const items = await apiGet<GymPackage[]>('/api/packages');
    profileCache.packages = clone(items);
    return items;
  },
  async get(id: number) {
    const item = await apiGet<GymPackage>(`/api/packages/${id}`);
    const others = profileCache.packages.filter((entry) => entry.id !== id);
    profileCache.packages = [...others, item];
    return item;
  },
  async save(input: Omit<GymPackage, 'id'> & { id?: number }) {
    const payload = input.id
      ? await apiPut<GymPackage>(`/api/admin/packages/${input.id}`, input)
      : await apiPost<GymPackage>('/api/admin/packages', input);

    notifyPackagesUpdated();
    return payload;
  },
  async remove(id: number) {
    await apiDelete<boolean>(`/api/admin/packages/${id}`);
    notifyPackagesUpdated();
  },
};

export const paymentMethodService = {
  events: {
    updated: PAYMENT_METHOD_EVENT,
    dbKey: PAYMENT_METHOD_STORAGE_SYNC_KEY,
  },
  async list() {
    try {
      const items = await apiGet<PaymentMethodSetting[]>('/api/payment-methods');
      writePaymentMethodSettings(items);
      return items;
    } catch {
      return readPaymentMethodSettings();
    }
  },
  async save(input: PaymentMethodSetting[]) {
    try {
      const items = await apiPost<PaymentMethodSetting[]>('/api/admin/payment-methods', {
        methods: input.map((m) => ({
          code: m.code,
          label: m.label,
          account_number: m.accountNumber,
          account_name: m.accountName,
        })),
      });
      const mapped = items.map((item: any) => ({
        code: item.code,
        label: item.label,
        accountNumber: item.account_number ?? '',
        accountName: item.account_name ?? null,
      }));
      writePaymentMethodSettings(mapped);
      return mapped;
    } catch {
      writePaymentMethodSettings(input);
      return readPaymentMethodSettings();
    }
  },
};

export const membershipService = {
  async listByUser(userId: number) {
    const currentUser = await authService.currentUser();

    if (!currentUser) {
      return [];
    }

    if (currentUser.role === 'member' && currentUser.id === userId) {
      const items = await apiGet<Membership[]>('/api/member/memberships');
      return items.map(syncMembershipStatus);
    }

    const payments = await adminService.payments();
    return payments.filter((item) => item.user_id === userId).map(syncMembershipStatus);
  },
  async currentByUser(userId: number) {
    const currentUser = await authService.currentUser();

    if (!currentUser) {
      return null;
    }

    if (currentUser.role === 'member' && currentUser.id === userId) {
      const membership = await apiGet<Membership | null>('/api/member/memberships/current');
      return membership ? syncMembershipStatus(membership) : null;
    }

    const membership = await apiGet<Membership | null>(`/api/admin/memberships/current/${userId}`);
    return membership ? syncMembershipStatus(membership) : null;
  },
  async createPaymentReport(input: PaymentReportInput) {
    const checkout = await apiPost<Membership>('/api/membership/checkout', {
      packageId: input.packageId,
      paymentMethod: input.paymentMethod,
      voucherKode: input.voucherKode,
    });

    const formData = new FormData();
    formData.append('membershipId', String(checkout.id));
    formData.append('paymentMethod', input.paymentMethod);
    formData.append('payment_proof_file', input.paymentProof);

    const membership = await apiPostForm<Membership>('/api/membership/upload-proof', formData);

    return membership;
  },
  async barcode() {
    return apiGet<{ membership: Membership; barcode: string } | null>('/api/member/barcode');
  },
};

export const duitkuService = {
  async checkout(packageId: number, paymentMethod: string, voucherKode?: string) {
    return apiPost<{
      membership: Membership;
      payment_url: string | null;
      va_number: string | null;
      qr_string: string | null;
      reference: string | null;
      amount: number;
    }>('/api/membership/duitku/checkout', { packageId, paymentMethod, voucherKode });
  },
  async getPaymentMethods(amount: number) {
    return apiGet<
      { paymentMethod: string; paymentName: string; paymentImage: string; totalFee: number }[]
    >(`/api/membership/duitku/payment-methods?amount=${amount}`);
  },
  async checkStatus(membershipId: number) {
    return apiPost<{
      membership: Membership;
      transaction_status: string | null;
      status_message: string | null;
    }>('/api/membership/duitku/check-status', { membershipId });
  },
};

export const attendanceService = {
  async listByUser(_userId: number) {
    const items = await apiGet<Attendance[]>('/api/member/attendances');
    profileCache.attendances = clone(items);
    return items;
  },
  async listAll() {
    const items = await apiGet<Attendance[]>('/api/admin/attendances');
    profileCache.attendances = clone(items);
    return items;
  },
  async createCheckIn(userId: number) {
    return apiPost<Attendance>('/api/admin/scan/barcode', { userId });
  },
  async createCheckInByQr(qrCode: string) {
    return apiPost<Attendance>('/api/admin/scan/barcode', { qr_code: qrCode });
  },
};

export const messageService = {
  async listForUser(_userId: number) {
    const items = await apiGet<Message[]>('/api/member/messages');
    profileCache.messages = clone(items);
    return items;
  },
  async listAll() {
    const items = await apiGet<Message[]>('/api/admin/messages');
    profileCache.messages = clone(items);
    return items;
  },
  async sendMessage(_pengirim_id: number, penerima_id: number, isi_pesan: string) {
    const currentUser = await authService.currentUser();

    if (!currentUser) {
      throw new Error('Pengguna belum login.');
    }

    if (currentUser.role === 'admin') {
      return apiPost<Message>('/api/messages/reply', {
        memberId: penerima_id,
        isi_pesan,
      });
    }

    return apiPost<Message>('/api/messages/send', {
      isi_pesan,
    });
  },
};

export const adminService = {
  async dashboardSummary(): Promise<DashboardSummary> {
    return apiGet<DashboardSummary>('/api/admin/dashboard/analytics');
  },
  async trends() {
    return apiGet<{
      visitTrend: { date: string; count: number }[];
      revenueTrend: { month: string; revenue: number }[];
    }>('/api/admin/dashboard/trends');
  },
  async members() {
    const items = await apiGet<User[]>('/api/admin/members');
    cacheMembers(items);
    return items;
  },
  async updateMember(
    memberId: number,
    input: Pick<User, 'nama' | 'email' | 'whatsapp'>,
  ) {
    const updated = await apiPut<User>(`/api/admin/members/${memberId}`, input);
    cacheMembers(
      profileCache.users
        .filter((user) => user.role === 'member' && user.id !== memberId)
        .concat(updated),
    );
    return updated;
  },
  async toggleMemberStatus(memberId: number) {
    const updated = await apiPatch<User>(`/api/admin/members/${memberId}/toggle-status`);
    cacheMembers(
      profileCache.users
        .filter((user) => user.role === 'member' && user.id !== memberId)
        .concat(updated),
    );
    return updated;
  },
  async payments() {
    const items = await apiGet<Membership[]>('/api/admin/payments');
    profileCache.memberships = clone(items);
    return items.map(syncMembershipStatus);
  },
  async expiringMembers() {
    return apiGet<{ member: User; membership: Membership | null }[]>('/api/admin/expiring-members');
  },
  async verifyPayment(membershipId: number) {
    return apiPost<Membership>('/api/admin/membership/verify', { membershipId });
  },
  async expenses(): Promise<Expense[]> {
    const items = await apiGet<Expense[]>('/api/admin/expenses');
    profileCache.expenses = clone(items);
    return items;
  },
  async createExpense(input: Omit<Expense, 'id'>): Promise<Expense> {
    return apiPost<Expense>('/api/admin/expenses', input);
  },
  async adminProfile() {
    return apiGet<User>('/api/admin/profile');
  },
};

export const voucherService = {
  async check(kode: string, packageId: number) {
    return apiPost<import('../types/models').VoucherCheckResult>('/api/voucher/check', { kode, package_id: packageId });
  },
  async list() {
    return apiGet<import('../types/models').Voucher[]>('/api/admin/vouchers');
  },
  async create(data: Omit<import('../types/models').Voucher, 'id' | 'total_digunakan' | 'created_at'>) {
    return apiPost<import('../types/models').Voucher>('/api/admin/vouchers', data);
  },
  async update(id: number, data: Omit<import('../types/models').Voucher, 'id' | 'total_digunakan' | 'created_at'>) {
    return apiPut<import('../types/models').Voucher>(`/api/admin/vouchers/${id}`, data);
  },
  async remove(id: number) {
    return apiDelete(`/api/admin/vouchers/${id}`);
  },
};

export const profileHelpers = {
  getAdmin(db: AppDatabase) {
    return db.users.find((user) => user.role === 'admin')!;
  },
  readSnapshot() {
    return clone(profileCache);
  },
};

export const membershipHelpers = {
  getDaysRemaining(membership: Membership | null) {
    if (!membership) {
      return null;
    }

    return getMembershipDaysRemaining(syncMembershipStatus(membership));
  },
  isExpiringSoon(membership: Membership | null) {
    if (!membership) {
      return false;
    }

    const normalized = syncMembershipStatus(membership);
    const daysRemaining = getMembershipDaysRemaining(normalized);
    return normalized.status === 'aktif' && daysRemaining !== null && daysRemaining <= 3;
  },
};
