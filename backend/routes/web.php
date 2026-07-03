<?php

use Illuminate\Support\Facades\Route;

// Serve JS/CSS assets via PHP dengan Content-Type yang benar (bypass LiteSpeed MIME issue)
Route::get('/assets/{file}', function ($file) {
    $path = public_path('assets/' . $file);

    if (!file_exists($path)) {
        abort(404);
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mime = match($ext) {
        'js', 'mjs' => 'application/javascript',
        'css'       => 'text/css',
        'png'       => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'svg'       => 'image/svg+xml',
        'woff'      => 'font/woff',
        'woff2'     => 'font/woff2',
        default     => mime_content_type($path) ?: 'application/octet-stream',
    };

    return response()->file($path, [
        'Content-Type'  => $mime,
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
})->where('file', '[a-zA-Z0-9._\-]+');

// Catch-all: serve React SPA untuk semua non-API routes
Route::get('/{any}', function () {
    return view('spa');
})->where('any', '.*');
