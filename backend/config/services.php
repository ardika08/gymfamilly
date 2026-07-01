<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'starsender' => [
        'base_url' => env('STARSENDER_BASE_URL', 'https://api.starsender.online/api'),
        'api_key' => env('STARSENDER_API_KEY'),
        'device_id' => env('STARSENDER_DEVICE_ID'),
        'webhook_secret' => env('STARSENDER_WEBHOOK_SECRET'),
    ],

    'duitku' => [
        'merchant_code' => env('DUITKU_MERCHANT_CODE'),
        'api_key' => env('DUITKU_API_KEY'),
        'base_url' => env('DUITKU_BASE_URL', 'https://sandbox.duitku.com/webapi/api/merchant'),
        'callback_url' => env('DUITKU_CALLBACK_URL'),
        'return_url' => env('DUITKU_RETURN_URL'),
        'expiry_period' => env('DUITKU_EXPIRY_MINUTES', 1440),
    ],

    'internal' => [
        'secret' => env('INTERNAL_API_SECRET'),
    ],

];
