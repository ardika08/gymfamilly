<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AdminPackageController extends Controller
{
    public function index()
    {
        return ApiResponse::success(GymPackage::query()->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama_paket' => ['required', 'string', 'max:255'],
            'promo_label' => ['nullable', 'string', 'max:255'],
            'harga_normal' => ['required', 'integer', 'min:0'],
            'harga_promo' => ['nullable', 'integer', 'min:0'],
            'deskripsi' => ['required', 'string'],
            'durasi_hari' => ['required', 'integer', 'min:1'],
        ]);

        $package = GymPackage::create($validated);

        return ApiResponse::success($package, 'Paket berhasil dibuat.', 201);
    }

    public function update(Request $request, GymPackage $package)
    {
        $validated = $request->validate([
            'nama_paket' => ['required', 'string', 'max:255'],
            'promo_label' => ['nullable', 'string', 'max:255'],
            'harga_normal' => ['required', 'integer', 'min:0'],
            'harga_promo' => ['nullable', 'integer', 'min:0'],
            'deskripsi' => ['required', 'string'],
            'durasi_hari' => ['required', 'integer', 'min:1'],
        ]);

        $package->update($validated);

        return ApiResponse::success($package, 'Paket berhasil diperbarui.');
    }

    public function destroy(GymPackage $package)
    {
        $package->delete();

        return ApiResponse::success(true, 'Paket berhasil dihapus.');
    }
}
