<?php

namespace App\Services;

use App\Models\Membership;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DuitkuService
{
    private string $merchantCode;
    private string $apiKey;
    private string $baseUrl;
    private string $callbackUrl;
    private string $returnUrl;
    private int $expiryPeriod;

    public function __construct()
    {
        $this->merchantCode = (string) config('services.duitku.merchant_code');
        $this->apiKey = (string) config('services.duitku.api_key');
        $this->baseUrl = rtrim((string) config('services.duitku.base_url'), '/');
        $this->callbackUrl = (string) config('services.duitku.callback_url');
        $this->returnUrl = (string) config('services.duitku.return_url');
        $this->expiryPeriod = (int) config('services.duitku.expiry_period', 1440);
    }

    /**
     * Check apakah Duitku sudah dikonfigurasi.
     */
    public function isConfigured(): bool
    {
        return !empty($this->merchantCode) && !empty($this->apiKey);
    }

    /**
     * Buat transaksi pembayaran di Duitku.
     * Mengembalikan URL pembayaran dan reference number.
     */
    public function createTransaction(Membership $membership, string $paymentMethod, int $amount, string $productDetail): array
    {
        $merchantOrderId = 'GF-' . $membership->id . '-' . time();
        $signature = md5($this->merchantCode . $merchantOrderId . $amount . $this->apiKey);

        $payload = [
            'merchantCode' => $this->merchantCode,
            'paymentAmount' => $amount,
            'paymentMethod' => $paymentMethod,
            'merchantOrderId' => $merchantOrderId,
            'productDetails' => $productDetail,
            'customerVaName' => $membership->user->nama ?? 'Member Gym Familly',
            'email' => $membership->user->email ?? '',
            'phoneNumber' => $membership->user->whatsapp ?? '',
            'callbackUrl' => $this->callbackUrl,
            'returnUrl' => $this->returnUrl,
            'signature' => $signature,
            'expiryPeriod' => $this->expiryPeriod,
        ];

        try {
            $response = Http::timeout(30)
                ->acceptJson()
                ->post("{$this->baseUrl}/v2/inquiry", $payload);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'payment_url' => $data['paymentUrl'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'va_number' => $data['vaNumber'] ?? null,
                    'qr_string' => $data['qrString'] ?? null,
                    'amount' => $data['amount'] ?? $amount,
                    'merchant_order_id' => $merchantOrderId,
                    'status_code' => $data['statusCode'] ?? null,
                    'status_message' => $data['statusMessage'] ?? null,
                ];
            }

            Log::error('Duitku createTransaction failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Gagal membuat transaksi pembayaran. Silakan coba lagi.',
            ];
        } catch (\Throwable $e) {
            Log::error('Duitku createTransaction exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Tidak dapat terhubung ke payment gateway. Silakan coba lagi nanti.',
            ];
        }
    }

    /**
     * Cek status transaksi di Duitku.
     */
    public function checkTransaction(string $merchantOrderId): array
    {
        $signature = md5($this->merchantCode . $merchantOrderId . $this->apiKey);

        $payload = [
            'merchantCode' => $this->merchantCode,
            'merchantOrderId' => $merchantOrderId,
            'signature' => $signature,
        ];

        try {
            $response = Http::timeout(15)
                ->acceptJson()
                ->post("{$this->baseUrl}/transactionStatus", $payload);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'status_code' => $data['statusCode'] ?? null,
                    'status_message' => $data['statusMessage'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'amount' => $data['amount'] ?? null,
                ];
            }

            return [
                'success' => false,
                'message' => 'Gagal mengecek status transaksi.',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Tidak dapat terhubung ke payment gateway.',
            ];
        }
    }

    /**
     * Validasi callback signature dari Duitku.
     */
    public function validateCallback(string $merchantCode, string $amount, string $merchantOrderId, string $signature): bool
    {
        $expectedSignature = md5($merchantCode . $amount . $merchantOrderId . $this->apiKey);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Daftar metode pembayaran yang tersedia dari Duitku.
     */
    public function getPaymentMethods(int $amount): array
    {
        $datetime = now()->format('Y-m-d H:i:s');
        $signature = hash('sha256', $this->merchantCode . $amount . $datetime . $this->apiKey);

        $payload = [
            'merchantcode' => $this->merchantCode,
            'amount' => $amount,
            'datetime' => $datetime,
            'signature' => $signature,
        ];

        try {
            $response = Http::timeout(15)
                ->acceptJson()
                ->post("{$this->baseUrl}/paymentmethod/getpaymentmethod", $payload);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'methods' => $data['paymentFee'] ?? [],
                ];
            }

            return [
                'success' => false,
                'methods' => [],
                'message' => 'Gagal mengambil metode pembayaran.',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'methods' => [],
                'message' => 'Tidak dapat terhubung ke payment gateway.',
            ];
        }
    }
}
