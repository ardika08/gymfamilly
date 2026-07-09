<?php

namespace App\Support;

use App\Models\Attendance;
use App\Models\Membership;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

class GymPayload
{
    public static function user(User $user): array
    {
        return [
            'id' => $user->id,
            'nama' => $user->nama,
            'email' => $user->email,
            'whatsapp' => $user->whatsapp,
            'role' => $user->role,
            'account_status' => $user->account_status,
            'created_at' => optional($user->created_at)->toISOString(),
        ];
    }

    public static function membership(?Membership $membership): ?array
    {
        if (! $membership) {
            return null;
        }

        return [
            'id' => $membership->id,
            'user_id' => $membership->user_id,
            'package_id' => $membership->package_id,
            'created_at' => optional($membership->created_at)->toISOString(),
            'tanggal_mulai' => $membership->tanggal_mulai?->format('Y-m-d'),
            'tanggal_berakhir' => $membership->tanggal_berakhir?->format('Y-m-d'),
            'status' => $membership->status,
            'payment_method' => $membership->payment_method,
            'payment_channel' => $membership->payment_channel,
            'payment_proof' => $membership->payment_proof
                ? Storage::disk('public')->url($membership->payment_proof)
                : null,
            'voucher_id'     => $membership->voucher_id,
            'voucher_diskon' => $membership->voucher_diskon,
            'payment_url'    => $membership->payment_url,
        ];
    }

    public static function attendance(Attendance $attendance): array
    {
        return [
            'id' => $attendance->id,
            'user_id' => $attendance->user_id,
            'waktu_scan' => optional($attendance->waktu_scan)->toISOString(),
            'hasil' => $attendance->hasil,
            'catatan' => $attendance->catatan,
        ];
    }

    public static function message(Message $message): array
    {
        return [
            'id' => $message->id,
            'pengirim_id' => $message->pengirim_id,
            'penerima_id' => $message->penerima_id,
            'isi_pesan' => $message->isi_pesan,
            'waktu_kirim' => optional($message->waktu_kirim)->toISOString(),
        ];
    }
}
