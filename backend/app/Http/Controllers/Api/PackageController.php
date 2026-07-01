<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use App\Support\ApiResponse;

class PackageController extends Controller
{
    public function index()
    {
        return ApiResponse::success(GymPackage::query()->orderBy('id')->get());
    }

    public function show(GymPackage $package)
    {
        return ApiResponse::success($package);
    }
}
