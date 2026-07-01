<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengirim_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('penerima_id')->constrained('users')->cascadeOnDelete();
            $table->text('isi_pesan');
            $table->dateTime('waktu_kirim');
            $table->timestamps();
            $table->index(['pengirim_id', 'penerima_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
