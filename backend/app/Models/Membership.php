<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Membership extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'package_id',
        'tanggal_mulai',
        'tanggal_berakhir',
        'status',
        'payment_method',
        'payment_proof',
        'verified_at',
        'merchant_order_id',
        'duitku_reference',
        'payment_channel',
        'paid_at',
    ];

    protected $casts = [
        'tanggal_mulai' => 'date:Y-m-d',
        'tanggal_berakhir' => 'date:Y-m-d',
        'verified_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(GymPackage::class, 'package_id');
    }
}
