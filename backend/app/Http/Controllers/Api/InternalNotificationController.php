<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StarsenderService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class InternalNotificationController extends Controller
{
    public function __construct(private readonly StarsenderService $starsender) {}

    public function send(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'exists:users,id'],
            'target' => ['nullable', 'string', 'max:30'],
            'type' => ['nullable', 'string'],
            'message' => ['required', 'string'],
        ]);

        $user = isset($validated['user_id'])
            ? User::find($validated['user_id'])
            : User::where('whatsapp', $validated['target'] ?? '')->first();

        if (! $user && empty($validated['target'])) {
            return ApiResponse::error('Target notifikasi tidak ditemukan.', 404);
        }

        $log = $user
            ? $this->starsender->send(
                $user,
                $validated['type'] ?? 'manual_trigger',
                $validated['message'],
            )
            : $this->starsender->sendToTarget(
                $validated['target'],
                $validated['type'] ?? 'manual_trigger',
                $validated['message'],
                ['source' => 'internal_notify'],
            );

        return ApiResponse::success($log, 'Notifikasi WA masuk ke antrean.');
    }
}
