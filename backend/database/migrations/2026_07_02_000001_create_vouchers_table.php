<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 50)->unique();
            $table->string('deskripsi')->nullable();
            $table->enum('tipe', ['percent', 'fixed', 'free', 'bonus_days']);
            $table->unsignedInteger('nilai'); // persen/nominal/hari
            $table->unsignedInteger('maks_penggunaan')->nullable(); // null = unlimited
            $table->unsignedInteger('maks_per_user')->default(1);
            $table->timestamp('valid_dari')->nullable();
            $table->timestamp('valid_hingga')->nullable();
            $table->enum('status', ['aktif', 'nonaktif'])->default('aktif');
            $table->timestamps();
        });

        Schema::create('voucher_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('memberships')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_usages');
        Schema::dropIfExists('vouchers');
    }
};
