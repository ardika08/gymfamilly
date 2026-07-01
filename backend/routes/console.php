<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('gym:send-membership-reminders')->dailyAt('08:00');
Schedule::command('gym:send-inactive-membership-notifications')->dailyAt('08:05');
