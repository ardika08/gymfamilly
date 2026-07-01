<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->unsignedInteger('durasi_hari')->default(30)->after('deskripsi');
        });

        // Update durasi berdasarkan nama paket yang sudah ada
        DB::table('packages')->where('nama_paket', 'like', '%Harian%')->update(['durasi_hari' => 1]);
        DB::table('packages')->where('nama_paket', 'like', '%1 Bulan%')->update(['durasi_hari' => 30]);
        DB::table('packages')->where('nama_paket', 'like', '%3 Bulan%')->update(['durasi_hari' => 90]);
        DB::table('packages')->where('nama_paket', 'like', '%6 Bulan%')->update(['durasi_hari' => 180]);
        DB::table('packages')->where('nama_paket', 'like', '%12 Bulan%')->update(['durasi_hari' => 365]);
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn('durasi_hari');
        });
    }
};
