<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GymPackage extends Model
{
    use HasFactory;

    protected $table = 'packages';

    protected $fillable = [
        'nama_paket',
        'promo_label',
        'harga_normal',
        'harga_promo',
        'deskripsi',
    ];

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class, 'package_id');
    }
}
