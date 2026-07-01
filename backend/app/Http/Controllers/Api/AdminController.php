<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Expense;
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
        $memberUsers = User::query()->where('role', 'member')->get();
        $activeMemberships = $memberUsers
            ->map(fn (User $user) => $this->memberships->currentForUser($user))
            ->filter(fn (?Membership $membership) => $membership?->status === 'aktif');

        $monthlyRevenue = $activeMemberships->sum(function (Membership $membership) {
            $membership->loadMissing('package');

            return $membership->package->harga_promo ?? $membership->package->harga_normal;
        });

        return ApiResponse::success([
            'activeMembers' => $activeMemberships->count(),
            'pendingPayments' => Membership::where('status', 'menunggu_pembayaran')->count(),
            'monthlyRevenue' => $monthlyRevenue,
            'attendanceToday' => Attendance::whereDate('waktu_scan', Carbon::today())->where('hasil', 'berhasil')->count(),
            'expiringSoonCount' => $memberUsers->filter(
                fn (User $user) => $this->memberships->isExpiringSoon($this->memberships->currentForUser($user))
            )->count(),
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

    public function payments()
    {
        return ApiResponse::success(
            Membership::query()->latest('id')->get()->map(
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
            'tanggal_berakhir' => $this->memberships->calculateEndDate($membership->package->nama_paket),
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
}
