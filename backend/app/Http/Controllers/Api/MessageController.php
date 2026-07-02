<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function memberMessages(Request $request)
    {
        $userId = $request->user()->id;

        $items = Message::query()
            ->where(function ($query) use ($userId) {
                $query->where('pengirim_id', $userId)
                    ->orWhere('penerima_id', $userId);
            })
            ->orderBy('waktu_kirim')
            ->get()
            ->map(fn (Message $message) => GymPayload::message($message));

        return ApiResponse::success($items);
    }

    public function adminMessages()
    {
        $items = Message::query()
            ->orderBy('waktu_kirim')
            ->get()
            ->map(fn (Message $message) => GymPayload::message($message));

        return ApiResponse::success($items);
    }

    public function sendToAdmin(Request $request)
    {
        $validated = $request->validate([
            'isi_pesan' => ['required', 'string'],
        ]);

        $admin = User::query()->where('role', 'admin')->firstOrFail();

        $message = Message::create([
            'pengirim_id' => $request->user()->id,
            'penerima_id' => $admin->id,
            'isi_pesan' => $validated['isi_pesan'],
            'waktu_kirim' => now(),
        ]);

        return ApiResponse::success(GymPayload::message($message), 'Pesan berhasil dikirim ke admin.', 201);
    }

    public function reply(Request $request)
    {
        $validated = $request->validate([
            'memberId' => ['required', 'exists:users,id'],
            'isi_pesan' => ['required', 'string'],
        ]);

        $member = User::query()->where('role', 'member')->findOrFail($validated['memberId']);

        $message = Message::create([
            'pengirim_id' => $request->user()->id,
            'penerima_id' => $member->id,
            'isi_pesan' => $validated['isi_pesan'],
            'waktu_kirim' => now(),
        ]);

        return ApiResponse::success(GymPayload::message($message), 'Balasan berhasil dikirim.', 201);
    }
}
