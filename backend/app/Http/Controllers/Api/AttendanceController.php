<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\StarsenderService;
use App\Services\WhatsAppTemplateService;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
        private readonly StarsenderService $starsender,
        private readonly WhatsAppTemplateService $templates,
    ) {}

    public function memberAttendances(Request $request)
    {
        $items = $request->user()->attendances()
            ->latest('waktu_scan')
            ->get()
            ->map(fn (Attendance $attendance) => GymPayload::attendance($attendance));

        return ApiResponse::success($items);
    }

    public function allAttendances(Request $request)
    {
        $query = Attendance::query()->latest('waktu_scan');

        if ($request->has('per_page')) {
            $paginated = $query->paginate((int) $request->input('per_page', 20));
            $paginated->getCollection()->transform(
                fn (Attendance $attendance) => GymPayload::attendance($attendance)
            );

            return ApiResponse::success($paginated);
        }

        $items = $query->get()
            ->map(fn (Attendance $attendance) => GymPayload::attendance($attendance));

        return ApiResponse::success($items);
    }

    public function scan(Request $request)
    {
        $validated = $request->validate([
            'userId' => ['nullable', 'integer'],
            'qr_code' => ['nullable', 'string'],
        ]);

        $member = null;

        if (! empty($validated['qr_code'])) {
            if (! preg_match('/^GF\|member:(\d+)\|membership:(\d+)$/', $validated['qr_code'], $matches)) {
                return ApiResponse::error('Format QR code tidak valid.', 422);
            }
            $member = User::where('role', 'member')->find((int) $matches[1]);
        }

        if (! $member && ! empty($validated['userId'])) {
            $member = User::where('role', 'member')->find((int) $validated['userId']);
        }

        if (! $member) {
            return ApiResponse::error('Member tidak ditemukan.', 404);
        }

        if ($member->account_status === 'nonaktif') {
            return $this->rejectAttendance($member->id, 'Akun member sedang dinonaktifkan oleh admin.');
        }

        $membership = $this->memberships->currentForUser($member);

        if (! $membership) {
            return $this->rejectAttendance($member->id, 'Member belum punya membership. Silakan pilih paket terlebih dulu.');
        }

        if ($membership->status === 'kedaluwarsa') {
            return $this->rejectAttendance($member->id, 'Membership kedaluwarsa. Silakan perpanjang membership terlebih dulu.', 'Maaf, membership Anda sudah berakhir. Silakan perpanjang membership Anda.');
        }

        if ($membership->status !== 'aktif') {
            return $this->rejectAttendance($member->id, 'Membership belum aktif. Menunggu verifikasi admin.', 'Membership belum aktif. Silakan tunggu verifikasi admin.');
        }

        $alreadyCheckedIn = Attendance::query()
            ->where('user_id', $member->id)
            ->whereDate('waktu_scan', Carbon::today())
            ->where('hasil', 'berhasil')
            ->exists();

        if ($alreadyCheckedIn) {
            return $this->rejectAttendance($member->id, 'Member sudah check-in hari ini.', 'Member sudah check-in hari ini.');
        }

        $attendance = Attendance::create([
            'user_id' => $member->id,
            'waktu_scan' => now(),
            'hasil' => 'berhasil',
            'catatan' => 'Validasi QR code berhasil',
        ]);

        $this->starsender->send(
            $member,
            'check_in_success',
            $this->templates->checkInSuccess($member, $attendance),
            ['attendance_id' => $attendance->id, 'membership_id' => $membership->id],
        );

        return ApiResponse::success(GymPayload::attendance($attendance), 'Check-in berhasil dicatat.');
    }

    private function rejectAttendance(int $userId, string $catatan, ?string $message = null)
    {
        Attendance::create([
            'user_id' => $userId,
            'waktu_scan' => now(),
            'hasil' => 'ditolak',
            'catatan' => $catatan,
        ]);

        return ApiResponse::error($message ?? $catatan, 422);
    }
}
