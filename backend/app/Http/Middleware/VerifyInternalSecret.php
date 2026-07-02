<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalSecret
{
    /**
     * Verifikasi bahwa request internal menyertakan secret key yang valid.
     * Header: X-Internal-Secret
     * Env: INTERNAL_API_SECRET
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('services.internal.secret');

        if (empty($secret)) {
            return response()->json([
                'message' => 'Internal API belum dikonfigurasi.',
            ], 503);
        }

        if ($request->header('X-Internal-Secret') !== $secret) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 401);
        }

        return $next($request);
    }
}
