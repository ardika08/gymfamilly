<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Carbon\Carbon;

class WhatsAppTemplateService
{
    private const FOOTER = '_Pesan otomatis dari Admin Gym Familly_';

    public function registration(User $user): string
    {
        return $this->compose(
            "Halo {$user->nama},",
            'Terima kasih telah mendaftar di Gym Familly. Akun Anda berhasil dibuat dan sudah siap digunakan untuk memilih paket membership, melakukan pembayaran, serta memantau status keanggotaan Anda.',
        );
    }

    public function paymentVerified(User $user, Membership $membership, GymPackage $package): string
    {
        $startDate = $this->formatDate($membership->tanggal_mulai);
        $endDate   = $this->formatDate($membership->tanggal_berakhir);
        $loginUrl  = rtrim((string) config('app.frontend_url', ''), '/').'/login';

        return $this->compose(
            "Halo {$user->nama},",
            "Pembayaran membership Anda telah kami terima! 🎉",
            "📦 *Detail Membership:*\n• Paket: *{$package->nama_paket}*\n• Durasi: *{$package->durasi_hari} hari*\n• Mulai: *{$startDate}*\n• Berakhir: *{$endDate}*",
            "Silakan login ke dashboard Gym Familly:\n{$loginUrl}\n\n🔑 Email: {$user->email}\n🔑 Password: (password yang Anda daftarkan)",
            'Tunjukkan QR code saat check-in di Gym Familly.',
        );
    }

    public function checkInSuccess(User $user, Attendance $attendance): string
    {
        $scanDateTime = $this->formatDateTime($attendance->waktu_scan);

        return $this->compose(
            "Halo {$user->nama},",
            "Check-in Anda di Gym Familly pada {$scanDateTime} telah berhasil tercatat.",
            'Selamat berlatih dan semoga sesi Anda hari ini menyenangkan.',
        );
    }

    public function membershipExpiryReminder(User $user, Membership $membership): string
    {
        $endDate = $this->formatDate($membership->tanggal_berakhir);
        $paymentUrl = rtrim((string) config('app.frontend_url', ''), '/').'/member/payments';

        return $this->compose(
            "Halo {$user->nama},",
            "Membership Anda akan berakhir pada *{$endDate}*. Segera perpanjang agar akses gym tetap aktif tanpa jeda.",
            "Perpanjang sekarang:\n{$paymentUrl}",
        );
    }

    public function membershipInactive(User $user, Membership $membership): string
    {
        $endDate = $this->formatDate($membership->tanggal_berakhir);
        $paymentUrl = rtrim((string) config('app.frontend_url', ''), '/').'/member/payments';

        return $this->compose(
            "Halo {$user->nama},",
            "Membership Anda telah berakhir pada *{$endDate}*. Akses check-in saat ini tidak aktif.",
            "Aktifkan kembali membership Anda:\n{$paymentUrl}",
        );
    }

    private function compose(string ...$sections): string
    {
        return implode("\n\n", [...$sections, self::FOOTER]);
    }

    private function formatDate(Carbon|string|null $value): string
    {
        if (! $value) {
            return '-';
        }

        return Carbon::parse($value)->timezone('Asia/Jakarta')->translatedFormat('d F Y');
    }

    private function formatDateTime(Carbon|string|null $value): string
    {
        if (! $value) {
            return '-';
        }

        return Carbon::parse($value)->timezone('Asia/Jakarta')->translatedFormat('d F Y, H:i').' WIB';
    }

    private function formatEnglishDate(Carbon|string|null $value): string
    {
        if (! $value) {
            return '-';
        }

        return Carbon::parse($value)->timezone('Asia/Jakarta')->locale('en')->translatedFormat('d F Y');
    }
}
