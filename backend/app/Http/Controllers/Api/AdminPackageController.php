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
        $validated = $this->validatePackage($request);

        $package = GymPackage::create($validated);

        return ApiResponse::success($package, 'Paket berhasil dibuat.', 201);
    }

    public function update(Request $request, GymPackage $package)
    {
        $validated = $this->validatePackage($request);

        $package->update($validated);

        return ApiResponse::success($package, 'Paket berhasil diperbarui.');
    }

    public function destroy(GymPackage $package)
    {
        $package->delete();

        return ApiResponse::success(true, 'Paket berhasil dihapus.');
    }

    /**
     * Validasi paket. Durasi bisa dinyatakan dalam hari (durasi_hari) atau
     * jam (durasi_jam) — minimal salah satu wajib terisi.
     */
    private function validatePackage(Request $request): array
    {
        // Normalisasi: input kosong / 0 (kiriman form) dianggap null.
        $request->merge([
            'durasi_hari' => $request->input('durasi_hari') ?: null,
            'durasi_jam'  => $request->input('durasi_jam') ?: null,
        ]);

        $validated = $request->validate([
            'nama_paket' => ['required', 'string', 'max:255'],
            'promo_label' => ['nullable', 'string', 'max:255'],
            'harga_normal' => ['required', 'integer', 'min:0'],
            'harga_promo' => ['nullable', 'integer', 'min:0'],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'durasi_hari' => ['nullable', 'integer', 'min:1'],
            'durasi_jam' => ['nullable', 'integer', 'min:1'],
        ]);

        if (empty($validated['durasi_hari']) && empty($validated['durasi_jam'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'durasi_hari' => ['Isi durasi hari ATAU durasi jam.'],
            ]);
        }

        return $validated;
    }
}
