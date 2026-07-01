<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function success(mixed $data, ?string $message = null, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'message' => $message,
        ], $status);
    }

    public static function error(string $message, int $status = 422): JsonResponse
    {
        return response()->json([
            'message' => $message,
        ], $status);
    }
}
