<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminPackageController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InternalNotificationController;
use App\Http\Controllers\Api\MembershipController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/webhooks/starsender', [WebhookController::class, 'starsender']);
Route::post('/internal/notify/wa', [InternalNotificationController::class, 'send']);
Route::get('/packages', [PackageController::class, 'index']);
Route::get('/packages/{package}', [PackageController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::middleware('role:member')->group(function () {
        Route::get('/member/memberships', [MembershipController::class, 'listForMember']);
        Route::get('/member/memberships/current', [MembershipController::class, 'currentForMember']);
        Route::post('/membership/checkout', [MembershipController::class, 'checkout']);
        Route::post('/membership/upload-proof', [MembershipController::class, 'uploadProof']);
        Route::get('/member/barcode', [MembershipController::class, 'barcode']);
        Route::get('/member/attendances', [AttendanceController::class, 'memberAttendances']);
        Route::get('/member/messages', [MessageController::class, 'memberMessages']);
        Route::post('/messages/send', [MessageController::class, 'sendToAdmin']);
    });

    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/packages', [AdminPackageController::class, 'index']);
        Route::post('/admin/packages', [AdminPackageController::class, 'store']);
        Route::put('/admin/packages/{package}', [AdminPackageController::class, 'update']);
        Route::delete('/admin/packages/{package}', [AdminPackageController::class, 'destroy']);
        Route::get('/admin/dashboard/analytics', [AdminController::class, 'dashboard']);
        Route::get('/admin/members', [AdminController::class, 'members']);
        Route::put('/admin/members/{member}', [AdminController::class, 'updateMember']);
        Route::patch('/admin/members/{member}/toggle-status', [AdminController::class, 'toggleMemberStatus']);
        Route::get('/admin/payments', [AdminController::class, 'payments']);
        Route::post('/admin/membership/verify', [AdminController::class, 'verifyPayment']);
        Route::get('/admin/expiring-members', [AdminController::class, 'expiringMembers']);
        Route::get('/admin/expenses', [AdminController::class, 'expenses']);
        Route::post('/admin/expenses', [AdminController::class, 'createExpense']);
        Route::get('/admin/memberships/current/{userId}', [MembershipController::class, 'currentForAdmin']);
        Route::get('/admin/attendances', [AttendanceController::class, 'allAttendances']);
        Route::post('/admin/scan/barcode', [AttendanceController::class, 'scan']);
        Route::get('/admin/messages', [MessageController::class, 'adminMessages']);
        Route::post('/messages/reply', [MessageController::class, 'reply']);
    });
});
