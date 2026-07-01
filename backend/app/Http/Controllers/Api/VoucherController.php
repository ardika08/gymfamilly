<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use App\Models\Voucher;
use App\Services\VoucherService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class VoucherController extends Controller
{
    public function __construct(private readonly VoucherService $service) {}

    // ─── Member: validasi kode voucher ───────────────────────────────────

    public function check(Request $request)
    {
        $validated = $request->validate([
            'kode'       => ['required', 'string'],
            'package_id' => ['required', 'exists:packages,id'],
        ]);

        $package = GymPackage::findOrFail($validated['package_id']);
        $harga   = $package->harga_promo ?? $package->harga_normal;

        $result = $this->service->validate($validated['kode'], $request->user()->id, $harga);

        if (!$result['valid']) {
            return ApiResponse::error($result['message'], 422);
        }

        return ApiResponse::success([
            'kode'        => strtoupper(trim($validated['kode'])),
            'tipe'        => $result['voucher']->tipe,
            'nilai'       => $result['voucher']->nilai,
            'diskon'      => $result['diskon'],
            'harga_akhir' => $result['harga_akhir'],
            'bonus_days'  => $result['bonus_days'],
            'deskripsi'   => $result['voucher']->deskripsi,
        ], 'Voucher valid.');
    }

    // ─── Admin: CRUD ──────────────────────────────────────────────────────

    public function index()
    {
        $vouchers = Voucher::withCount('usages')->latest()->get()->map(fn ($v) => $this->payload($v));
        return ApiResponse::success($vouchers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'kode'            => ['required', 'string', 'max:50', 'unique:vouchers,kode'],
            'deskripsi'       => ['nullable', 'string', 'max:255'],
            'tipe'            => ['required', 'in:percent,fixed,free,bonus_days'],
            'nilai'           => ['required', 'integer', 'min:1'],
            'maks_penggunaan' => ['nullable', 'integer', 'min:1'],
            'maks_per_user'   => ['required', 'integer', 'min:1'],
            'valid_dari'      => ['nullable', 'date'],
            'valid_hingga'    => ['nullable', 'date', 'after_or_equal:valid_dari'],
            'status'          => ['required', 'in:aktif,nonaktif'],
        ]);

        $validated['kode'] = strtoupper($validated['kode']);
        $voucher = Voucher::create($validated);

        return ApiResponse::success($this->payload($voucher->loadCount('usages')), 'Voucher berhasil dibuat.', 201);
    }

    public function update(Request $request, Voucher $voucher)
    {
        $validated = $request->validate([
            'kode'            => ['required', 'string', 'max:50', 'unique:vouchers,kode,' . $voucher->id],
            'deskripsi'       => ['nullable', 'string', 'max:255'],
            'tipe'            => ['required', 'in:percent,fixed,free,bonus_days'],
            'nilai'           => ['required', 'integer', 'min:1'],
            'maks_penggunaan' => ['nullable', 'integer', 'min:1'],
            'maks_per_user'   => ['required', 'integer', 'min:1'],
            'valid_dari'      => ['nullable', 'date'],
            'valid_hingga'    => ['nullable', 'date', 'after_or_equal:valid_dari'],
            'status'          => ['required', 'in:aktif,nonaktif'],
        ]);

        $validated['kode'] = strtoupper($validated['kode']);
        $voucher->update($validated);

        return ApiResponse::success($this->payload($voucher->fresh()->loadCount('usages')), 'Voucher berhasil diperbarui.');
    }

    public function destroy(Voucher $voucher)
    {
        $voucher->delete();
        return ApiResponse::success(null, 'Voucher berhasil dihapus.');
    }

    private function payload(Voucher $v): array
    {
        return [
            'id'              => $v->id,
            'kode'            => $v->kode,
            'deskripsi'       => $v->deskripsi,
            'tipe'            => $v->tipe,
            'nilai'           => $v->nilai,
            'maks_penggunaan' => $v->maks_penggunaan,
            'maks_per_user'   => $v->maks_per_user,
            'valid_dari'      => $v->valid_dari?->toISOString(),
            'valid_hingga'    => $v->valid_hingga?->toISOString(),
            'status'          => $v->status,
            'total_digunakan' => $v->usages_count ?? $v->totalUsed(),
            'created_at'      => $v->created_at?->toISOString(),
        ];
    }
}
