<?php

use Illuminate\Support\Facades\Route;

// Catch-all: serve React SPA for all non-API routes
Route::get('/{any}', function () {
    return view('spa');
})->where('any', '.*');
