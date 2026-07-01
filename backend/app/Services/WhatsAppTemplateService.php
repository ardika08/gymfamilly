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
        $endDate = $this->formatEnglishDate($membership->tanggal_berakhir);
        $loginUrl = rtrim((string) config('app.frontend_url', ''), '/').'/login';

        return $this->compose(
            "Halo {$user->nama},",
            "Pembayaran membership Anda telah kami terima dan verifikasi. Membership paket {$package->nama_paket} saat ini sudah aktif dan berlaku sampai {$endDate}.",
            "Silahkan login dashboard:\n{$loginUrl}",
            'Gunakan QR check-in Anda saat datang ke Gym Familly.',
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

        return $this->compose(
            "Halo {$user->nama},",
            "Membership Anda akan berakhir pada {$endDate}. Agar akses gym tetap aktif tanpa jeda, silakan lakukan perpanjangan sebelum masa aktif berakhir.",
            'Anda dapat memperpanjang membership melalui akun Gym Familly Anda.',
        );
    }

    public function membershipInactive(User $user, Membership $membership): string
    {
        $endDate = $this->formatDate($membership->tanggal_berakhir);

        return $this->compose(
            "Halo {$user->nama},",
            "Membership Anda telah berakhir pada {$endDate} dan saat ini status keanggotaan Anda tidak aktif.",
            'Untuk kembali menggunakan akses check-in Gym Familly, silakan lakukan perpanjangan membership melalui akun Anda.',
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
