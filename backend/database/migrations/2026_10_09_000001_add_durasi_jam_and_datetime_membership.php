<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah durasi berbasis jam untuk paket (mis. paket harian 12 jam),
     * dan ubah masa aktif membership dari date menjadi datetime agar
     * bisa menyimpan jam berakhir yang presisi.
     */
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            // durasi_hari jadi nullable supaya paket berbasis jam boleh tanpa hari.
            $table->unsignedInteger('durasi_hari')->nullable()->default(null)->change();
            $table->unsignedInteger('durasi_jam')->nullable()->after('durasi_hari');
        });

        Schema::table('memberships', function (Blueprint $table) {
            $table->dateTime('tanggal_mulai')->nullable()->change();
            $table->dateTime('tanggal_berakhir')->nullable()->change();
        });

        // Data fix khusus MySQL: kolom DATE lama diubah ke DATETIME menjadi
        // 'YYYY-MM-DD 00:00:00', yang akan membuat membership "hangus" di awal
        // hari terakhir. Naikkan ke akhir hari (23:59:59) agar masa aktif lama
        // tetap utuh. SQLite (test) tidak butuh fix ini.
        if (DB::getDriverName() === 'mysql') {
            DB::table('memberships')
                ->whereNotNull('tanggal_berakhir')
                ->update([
                    'tanggal_berakhir' => DB::raw("CONCAT(DATE(tanggal_berakhir), ' 23:59:59')"),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn('durasi_jam');
            $table->unsignedInteger('durasi_hari')->nullable(false)->default(30)->change();
        });

        Schema::table('memberships', function (Blueprint $table) {
            $table->date('tanggal_mulai')->nullable()->change();
            $table->date('tanggal_berakhir')->nullable()->change();
        });
    }
};
