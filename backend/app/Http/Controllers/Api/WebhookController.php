<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function starsender(Request $request)
    {
        $payload = $request->all();

        NotificationLog::create([
            'channel' => 'whatsapp',
            'type' => 'webhook',
            'target' => data_get($payload, 'phone'),
            'status' => data_get($payload, 'status', 'received'),
            'message' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'meta' => $payload,
        ]);

        return ApiResponse::success(['received' => true], 'Webhook Starsender diterima.');
    }
}
