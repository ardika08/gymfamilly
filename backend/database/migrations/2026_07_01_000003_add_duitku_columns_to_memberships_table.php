<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('memberships', function (Blueprint $table) {
            $table->string('merchant_order_id')->nullable()->after('payment_proof');
            $table->string('duitku_reference')->nullable()->after('merchant_order_id');
            $table->string('payment_channel')->nullable()->after('duitku_reference');
            $table->timestamp('paid_at')->nullable()->after('payment_channel');

            $table->index('merchant_order_id');
            $table->index('duitku_reference');
        });
    }

    public function down(): void
    {
        Schema::table('memberships', function (Blueprint $table) {
            $table->dropIndex(['merchant_order_id']);
            $table->dropIndex(['duitku_reference']);
            $table->dropColumn(['merchant_order_id', 'duitku_reference', 'payment_channel', 'paid_at']);
        });
    }
};
