<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Expense;
use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\StarsenderService;
use App\Services\WhatsAppTemplateService;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
        private readonly StarsenderService $starsender,
        private readonly WhatsAppTemplateService $templates,
    ) {}

    public function dashboard()
    {
        $today = Carbon::today();

        $activeMembers = Membership::where('status', 'aktif')
            ->whereDate('tanggal_berakhir', '>=', $today)
            ->distinct('user_id')
            ->count('user_id');

        $monthlyRevenue = Membership::where('status', 'aktif')
            ->whereDate('tanggal_berakhir', '>=', $today)
            ->join('packages', 'memberships.package_id', '=', 'packages.id')
            ->selectRaw('SUM(COALESCE(packages.harga_promo, packages.harga_normal)) as total')
            ->value('total') ?? 0;

        $expiringSoonCount = Membership::where('status', 'aktif')
            ->whereDate('tanggal_berakhir', '>=', $today)
            ->whereDate('tanggal_berakhir', '<=', $today->copy()->addDays(3))
            ->distinct('user_id')
            ->count('user_id');

        return ApiResponse::success([
            'activeMembers' => $activeMembers,
            'pendingPayments' => Membership::where('status', 'menunggu_pembayaran')->count(),
            'monthlyRevenue' => (int) $monthlyRevenue,
            'attendanceToday' => Attendance::whereDate('waktu_scan', $today)->where('hasil', 'berhasil')->count(),
            'expiringSoonCount' => $expiringSoonCount,
        ]);
    }

    public function members()
    {
        return ApiResponse::success(
            User::query()->where('role', 'member')->orderBy('id')->get()->map(
                fn (User $user) => GymPayload::user($user)
            )
        );
    }

    public function adminProfile(Request $request)
    {
        return ApiResponse::success(GymPayload::user($request->user()));
    }

    public function updateMember(Request $request, User $member)
    {
        if ($member->role !== 'member') {
            return ApiResponse::error('Member tidak ditemukan.', 404);
        }

        $validated = $request->validate([
            'nama' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$member->id],
            'whatsapp' => ['required', 'string', 'max:30'],
        ]);

        $member->update($validated);

        return ApiResponse::success(GymPayload::user($member), 'Data member berhasil diperbarui.');
    }

    public function toggleMemberStatus(User $member)
    {
        if ($member->role !== 'member') {
            return ApiResponse::error('Member tidak ditemukan.', 404);
        }

        $member->update([
            'account_status' => $member->account_status === 'aktif' ? 'nonaktif' : 'aktif',
        ]);

        return ApiResponse::success(GymPayload::user($member), 'Status akun member berhasil diperbarui.');
    }

    public function payments(Request $request)
    {
        $query = Membership::query()->latest('id');

        if ($request->has('per_page')) {
            $paginated = $query->paginate((int) $request->input('per_page', 20));
            $paginated->getCollection()->transform(
                fn (Membership $membership) => GymPayload::membership($membership)
            );

            return ApiResponse::success($paginated);
        }

        return ApiResponse::success(
            $query->get()->map(
                fn (Membership $membership) => GymPayload::membership($membership)
            )
        );
    }

    public function verifyPayment(Request $request)
    {
        $validated = $request->validate([
            'membershipId' => ['required', 'exists:memberships,id'],
        ]);

        $membership = Membership::with(['user', 'package'])->findOrFail($validated['membershipId']);
        $membership->update([
            'status' => 'aktif',
            'tanggal_mulai' => now()->format('Y-m-d'),
            'tanggal_berakhir' => $this->memberships->calculateEndDate($membership->package),
            'verified_at' => now(),
        ]);

        $this->starsender->send(
            $membership->user,
            'payment_verified',
            $this->templates->paymentVerified($membership->user, $membership, $membership->package),
            ['membership_id' => $membership->id],
        );

        return ApiResponse::success(GymPayload::membership($membership->fresh()), 'Pembayaran berhasil diverifikasi.');
    }

    public function expiringMembers()
    {
        $items = User::query()->where('role', 'member')->get()
            ->map(function (User $member) {
                $membership = $this->memberships->currentForUser($member);

                return [
                    'member' => GymPayload::user($member),
                    'membership' => GymPayload::membership($membership),
                ];
            })
            ->filter(function (array $row) {
                if (! $row['membership']) {
                    return false;
                }

                $membership = Membership::find($row['membership']['id']);

                return $this->memberships->isExpiringSoon($membership);
            })
            ->values();

        return ApiResponse::success($items);
    }

    public function expenses()
    {
        return ApiResponse::success(Expense::query()->latest('tanggal')->get());
    }

    public function trends()
    {
        $today = Carbon::today();

        // Attendance per hari (10 hari terakhir)
        $visitTrend = collect(range(9, 0))->map(function ($daysAgo) use ($today) {
            $date = $today->copy()->subDays($daysAgo);

            return [
                'date' => $date->format('d/m'),
                'count' => Attendance::whereDate('waktu_scan', $date)
                    ->where('hasil', 'berhasil')
                    ->count(),
            ];
        })->values();

        // Revenue per bulan (8 bulan terakhir)
        $revenueTrend = collect(range(7, 0))->map(function ($monthsAgo) use ($today) {
            $month = $today->copy()->subMonths($monthsAgo);

            $revenue = Membership::where('status', 'aktif')
                ->whereMonth('verified_at', $month->month)
                ->whereYear('verified_at', $month->year)
                ->join('packages', 'memberships.package_id', '=', 'packages.id')
                ->selectRaw('SUM(COALESCE(packages.harga_promo, packages.harga_normal)) as total')
                ->value('total') ?? 0;

            return [
                'month' => $month->format('M'),
                'revenue' => (int) $revenue,
            ];
        })->values();

        return ApiResponse::success([
            'visitTrend' => $visitTrend,
            'revenueTrend' => $revenueTrend,
        ]);
    }

    public function expenses()
    {
        return ApiResponse::success(Expense::query()->orderByDesc('tanggal')->get());
    }

    public function createExpense(Request $request)
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'nominal' => ['required', 'integer', 'min:0'],
            'tanggal' => ['required', 'date'],
            'kategori' => ['required', 'string', 'max:255'],
        ]);

        $expense = Expense::create($validated);

        return ApiResponse::success($expense, 'Pengeluaran berhasil ditambahkan.', 201);
    }

    public function expiringMembers()
    {
        $today = Carbon::today();
        $threshold = $today->copy()->addDays(3);

        $members = User::query()->where('role', 'member')->get();

        $result = $members->map(function (User $user) use ($today, $threshold) {
            $membership = $user->memberships()
                ->where('status', 'aktif')
                ->whereDate('tanggal_berakhir', '>=', $today)
                ->whereDate('tanggal_berakhir', '<=', $threshold)
                ->latest('id')
                ->first();

            return [
                'member'     => GymPayload::user($user),
                'membership' => $membership ? [
                    'id'                => $membership->id,
                    'tanggal_berakhir'  => $membership->tanggal_berakhir?->format('Y-m-d'),
                    'status'            => $membership->status,
                ] : null,
            ];
        })->filter(fn ($item) => $item['membership'] !== null)->values();

        return ApiResponse::success($result);
    }
}
