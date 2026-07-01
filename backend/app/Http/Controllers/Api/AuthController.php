<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StarsenderService;
use App\Services\WhatsAppTemplateService;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(
        private readonly StarsenderService $starsender,
        private readonly WhatsAppTemplateService $templates,
    ) {}

    public function register(Request $request)
    {
        $validated = $request->validate([
            'nama' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'whatsapp' => ['required', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            ...$validated,
            'role' => 'member',
            'account_status' => 'aktif',
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('member-token')->plainTextToken;

        $starsender = $this->starsender;
        $templates = $this->templates;

        app()->terminating(function () use ($starsender, $templates, $user): void {
            try {
                $starsender->send(
                    $user,
                    'register_success',
                    $templates->registration($user),
                );
            } catch (\Throwable) {
                // Jangan ganggu response registrasi jika notifikasi eksternal gagal atau lambat.
            }
        });

        return ApiResponse::success([
            'token' => $token,
            'user' => GymPayload::user($user),
        ], 'Registrasi berhasil.', 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return ApiResponse::error('Email atau password tidak cocok.', 401);
        }

        if ($user->account_status === 'nonaktif') {
            return ApiResponse::error('Akun ini sedang dinonaktifkan oleh admin.', 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken("{$user->role}-token")->plainTextToken;

        return ApiResponse::success([
            'token' => $token,
            'user' => GymPayload::user($user),
        ], 'Login berhasil.');
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return ApiResponse::success(true, 'Logout berhasil.');
    }

    public function me(Request $request)
    {
        return ApiResponse::success(GymPayload::user($request->user()));
    }
}
