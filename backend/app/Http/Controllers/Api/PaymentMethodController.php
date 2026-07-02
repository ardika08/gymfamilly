<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class PaymentMethodController extends Controller
{
    public function index()
    {
        return ApiResponse::success(
            PaymentMethod::where('is_active', true)->get()
        );
    }

    public function save(Request $request)
    {
        $validated = $request->validate([
            'methods' => ['required', 'array', 'min:1'],
            'methods.*.code' => ['required', 'string', 'max:50'],
            'methods.*.label' => ['required', 'string', 'max:100'],
            'methods.*.account_number' => ['nullable', 'string', 'max:50'],
            'methods.*.account_name' => ['nullable', 'string', 'max:100'],
        ]);

        foreach ($validated['methods'] as $method) {
            PaymentMethod::updateOrCreate(
                ['code' => $method['code']],
                [
                    'label' => $method['label'],
                    'account_number' => $method['account_number'] ?? '',
                    'account_name' => $method['account_name'] ?? null,
                    'is_active' => true,
                ],
            );
        }

        return ApiResponse::success(
            PaymentMethod::where('is_active', true)->get(),
            'Metode pembayaran berhasil disimpan.'
        );
    }
}
