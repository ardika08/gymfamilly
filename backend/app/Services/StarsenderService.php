<?php

namespace App\Services;

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Http;

class StarsenderService
{
    public function send(User $user, string $type, string $message, array $meta = []): NotificationLog
    {
        return $this->sendToTarget($user->whatsapp, $type, $message, $meta, $user);
    }

    public function sendToTarget(string $target, string $type, string $message, array $meta = [], ?User $user = null): NotificationLog
    {
        $log = NotificationLog::create([
            'user_id' => $user?->id,
            'channel' => 'whatsapp',
            'type' => $type,
            'target' => $target,
            'status' => 'queued',
            'message' => $message,
            'meta' => $meta,
        ]);

        $apiKey = config('services.starsender.api_key');
        $deviceId = config('services.starsender.device_id');
        $baseUrl = rtrim((string) config('services.starsender.base_url', ''), '/');

        if (! $apiKey || ! $deviceId || ! $baseUrl) {
            $log->update([
                'status' => 'skipped',
                'meta' => array_merge($meta, ['reason' => 'missing_credentials']),
            ]);

            return $log->fresh();
        }

        if (app()->environment('testing')) {
            $log->update([
                'status' => 'skipped',
                'meta' => array_merge($meta, ['reason' => 'testing_environment']),
            ]);

            return $log->fresh();
        }

        try {
            $normalizedTarget = $this->normalizePhoneNumber($target);
            $response = Http::timeout(15)
                ->acceptJson()
                ->withHeaders([
                    'Authorization' => $apiKey,
                ])
                ->post("{$baseUrl}/send", [
                    'messageType' => 'text',
                    'to' => $normalizedTarget,
                    'body' => $message,
                ]);

            $log->update([
                'status' => $response->successful() ? 'sent' : 'failed',
                'sent_at' => $response->successful() ? now() : null,
                'meta' => array_merge($meta, [
                    'device_id' => $deviceId,
                    'normalized_target' => $normalizedTarget,
                    'http_status' => $response->status(),
                    'response' => $response->json() ?? $response->body(),
                ]),
            ]);
        } catch (\Throwable $exception) {
            $log->update([
                'status' => 'failed',
                'meta' => array_merge($meta, ['error' => $exception->getMessage()]),
            ]);
        }

        return $log->fresh();
    }

    public function hasSentForMembership(string $type, int $membershipId): bool
    {
        return NotificationLog::query()
            ->where('type', $type)
            ->where(function (Builder $query) use ($membershipId) {
                $query->where('meta->membership_id', $membershipId)
                    ->orWhere('meta->membership_id', (string) $membershipId);
            })
            ->exists();
    }

    private function normalizePhoneNumber(string $target): string
    {
        $digits = preg_replace('/\D+/', '', $target) ?? '';

        if ($digits === '') {
            return $target;
        }

        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        if (str_starts_with($digits, '62')) {
            return $digits;
        }

        return $digits;
    }
}
