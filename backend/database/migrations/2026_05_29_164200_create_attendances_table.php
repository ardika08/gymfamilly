<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->dateTime('waktu_scan');
            $table->enum('hasil', ['berhasil', 'ditolak'])->default('berhasil');
            $table->string('catatan')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'waktu_scan']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
