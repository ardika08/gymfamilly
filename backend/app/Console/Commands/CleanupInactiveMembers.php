<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CleanupInactiveMembers extends Command
{
    protected $signature = 'gym:cleanup-inactive-members {--execute : Lakukan penghapusan sungguhan. Tanpa flag ini hanya preview.}';

    protected $description = 'Hapus member non-demo yang seluruh membership-nya hanya kedaluwarsa atau menunggu_pembayaran (tanpa membership aktif)';

    public const DEMO_EMAIL = 'member@gymfamilly.id';

    public function handle(): int
    {
        $targets = User::query()
            ->where('role', 'member')
            ->where('email', '!=', self::DEMO_EMAIL)
            ->whereDoesntHave('memberships', fn ($q) => $q->where('status', 'aktif'))
            ->whereHas('memberships')
            ->orderBy('id')
            ->get();

        if ($targets->isEmpty()) {
            $this->info('Tidak ada member yang memenuhi kriteria untuk dihapus.');
            return self::SUCCESS;
        }

        $rows = $targets->map(fn (User $u) => [
            'id' => $u->id,
            'email' => $u->email,
            'nama' => $u->nama,
            'membership_count' => $u->memberships()->count(),
        ])->values()->toArray();

        if (!$this->option('execute')) {
            $this->warn('Preview saja — gunakan --execute untuk menghapus.');
            $this->table(['ID', 'Email', 'Nama', 'Membership'], $rows);
            $this->info('Total target: '.count($rows));
            return self::SUCCESS;
        }

        $backupPath = storage_path('app/cleanup-inactive-members-'.now()->format('Ymd-His').'.json');
        File::ensureDirectoryExists(dirname($backupPath));
        File::put($backupPath, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $deleted = 0;
        DB::transaction(function () use ($targets, &$deleted) {
            foreach ($targets as $user) {
                $user->delete();
                $deleted++;
            }
        });

        $this->info("Backup: {$backupPath}");
        $this->info("Dihapus: {$deleted} member.");

        return self::SUCCESS;
    }
}