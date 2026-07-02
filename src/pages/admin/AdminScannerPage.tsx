import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  adminService,
  attendanceService,
  membershipHelpers,
  membershipService,
  packageService,
} from '../../services/api';
import type { Attendance, GymPackage, Membership, User } from '../../types/models';
import { formatDisplayDate, formatDisplayDateTime } from '../../utils/date';

type ScanResultTone = 'idle' | 'success' | 'warning' | 'danger';
type ScanPulseTone = Exclude<ScanResultTone, 'idle'> | null;
type CameraState = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

const playBeep = (tone: Exclude<ScanResultTone, 'idle'>) => {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;

  const playTone = (frequency: number, startAt: number, duration: number, type: OscillatorType) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.14, startAt + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  };

  if (tone === 'success') {
    playTone(1046, now, 0.16, 'sine');
    playTone(1318, now + 0.09, 0.2, 'sine');
    window.setTimeout(() => {
      void context.close();
    }, 360);
    return;
  }

  playTone(tone === 'warning' ? 620 : 380, now, 0.22, tone === 'warning' ? 'triangle' : 'sawtooth');
  window.setTimeout(() => {
    void context.close();
  }, 320);
};

export const AdminScannerPage = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [packages, setPackages] = useState<GymPackage[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [recentScans, setRecentScans] = useState<Attendance[]>([]);
  const [result, setResult] = useState<{
    message: string;
    tone: ScanResultTone;
    timestamp: string | null;
  } | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraMessage, setCameraMessage] = useState('Kamera siap digunakan untuk scan QR member.');
  const [scanPulseTone, setScanPulseTone] = useState<ScanPulseTone>(null);
  const [lastDetectedCode, setLastDetectedCode] = useState('');
  const [scannedMemberId, setScannedMemberId] = useState<number | null>(null);
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null);
  const rafRef = useRef<number | null>(null);
  const cameraStateRef = useRef<CameraState>('idle');
  const startRequestedRef = useRef(false);
  const processingRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const lastPayloadRef = useRef<{ value: string; at: number } | null>(null);
  usePageTitle('Scan QR Member');

  const currentMember = members.find((member) => member.id === scannedMemberId) ?? null;
  const currentPackage = packages.find((item) => item.id === membership?.package_id) ?? null;
  const isExpiringSoon = membershipHelpers.isExpiringSoon(membership);
  const daysRemaining = membershipHelpers.getDaysRemaining(membership);
  const recentScansView = useMemo(
    () =>
      recentScans.map((scan) => ({
        ...scan,
        member: members.find((member) => member.id === scan.user_id) ?? null,
      })),
    [members, recentScans],
  );

  const triggerScanFeedback = useCallback((tone: Exclude<ScanResultTone, 'idle'>) => {
    setScanPulseTone(tone);
    playBeep(tone);
    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
    }
    pulseTimeoutRef.current = window.setTimeout(() => {
      setScanPulseTone(null);
    }, 900);
  }, []);

  const refreshRecentScans = useCallback(async () => {
    const logs = await attendanceService.listAll();
    setRecentScans(logs.slice(0, 4));
  }, []);

  const refreshScannedMemberContext = useCallback(
    async (userId: number) => {
      setScannedMemberId(userId);
      const activeMembership = await membershipService.currentByUser(userId);
      setMembership(activeMembership);
    },
    [],
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualLoading(true);
    await processQrCode(manualInput.trim());
    setManualInput('');
    setManualLoading(false);
  };

  const stopCamera = useCallback(() => {
    startRequestedRef.current = false;
    cameraStateRef.current = 'idle';

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraState('idle');
    setCameraMessage('Kamera dimatikan. Aktifkan lagi saat ingin scan QR.');
  }, []);

  const processQrCode = useCallback(
    async (qrCode: string) => {
      if (!qrCode.trim() || processingRef.current) {
        return;
      }

      const now = Date.now();
      if (pauseUntilRef.current > now) {
        return;
      }

      if (lastPayloadRef.current?.value === qrCode && now - lastPayloadRef.current.at < 3000) {
        return;
      }

      processingRef.current = true;
      pauseUntilRef.current = now + 1800;
      lastPayloadRef.current = { value: qrCode, at: now };
      setLastDetectedCode(qrCode);
      setLastDetectionAt(now);

      try {
        const log = await attendanceService.createCheckInByQr(qrCode);
        await refreshScannedMemberContext(log.user_id);
        setResult({
          message: log.catatan ?? 'Check-in berhasil dicatat. Member boleh masuk gym.',
          tone: 'success',
          timestamp: log.waktu_scan,
        });
        setCameraMessage('QR berhasil dipindai. Arahkan ke member berikutnya untuk scan berikutnya.');
        triggerScanFeedback('success');
        await refreshRecentScans();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Scan ditolak. Terjadi kendala saat validasi.';
        const tone = message.toLowerCase().includes('kedaluwarsa') ? 'warning' : 'danger';
        setResult({
          message,
          tone,
          timestamp: new Date().toISOString(),
        });
        setCameraMessage('QR terdeteksi tetapi validasi ditolak. Periksa status membership member.');
        triggerScanFeedback(tone);
        await refreshRecentScans();
      } finally {
        window.setTimeout(() => {
          processingRef.current = false;
        }, 900);
      }
    },
    [refreshRecentScans, refreshScannedMemberContext, triggerScanFeedback],
  );

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;

    if (!video || !detector || cameraStateRef.current !== 'ready') {
      return;
    }

    try {
      if (video.readyState >= 2 && !processingRef.current && Date.now() >= pauseUntilRef.current) {
        const codes = await detector.detect(video);
        const qrCode = codes.find((item) => typeof item.rawValue === 'string' && item.rawValue.trim())?.rawValue?.trim();

        if (qrCode) {
          void processQrCode(qrCode);
        }
      }
    } catch (error) {
      setCameraState('error');
      setCameraMessage(
        error instanceof Error
          ? `Scanner QR tidak bisa dijalankan: ${error.message}`
          : 'Scanner QR tidak bisa dijalankan di perangkat ini.',
      );
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      void scanFrame();
    });
  }, [processQrCode]);

  const startCamera = useCallback(async () => {
    if (startRequestedRef.current || cameraStateRef.current === 'ready' || cameraStateRef.current === 'loading') {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraStateRef.current = 'error';
      setCameraState('error');
      setCameraMessage('Browser ini belum mendukung akses kamera.');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      cameraStateRef.current = 'error';
      setCameraState('error');
      setCameraMessage('Kamera hanya bisa dibuka di koneksi aman HTTPS atau localhost.');
      return;
    }

    const BarcodeDetectorClass = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      cameraStateRef.current = 'unsupported';
      setCameraState('unsupported');
      setCameraMessage('Browser ini belum mendukung scan QR otomatis. Gunakan Chrome Android terbaru saat publik nanti.');
      return;
    }

    startRequestedRef.current = true;
    cameraStateRef.current = 'loading';
    setCameraState('loading');
    setCameraMessage('Membuka kamera belakang dan menyiapkan scan QR...');

    try {
      detectorRef.current = new BarcodeDetectorClass({ formats: ['qr_code'] });

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Elemen video tidak tersedia untuk menampilkan kamera.');
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      await video.play();

      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }

      cameraStateRef.current = 'ready';
      setCameraState('ready');
      setCameraMessage('Kamera aktif. Arahkan QR code member ke dalam frame untuk validasi otomatis.');
      rafRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    } catch (error) {
      cameraStateRef.current = 'error';
      setCameraState('error');
      setCameraMessage(
        error instanceof Error
          ? `Kamera belum bisa dibuka: ${error.message}`
          : 'Kamera belum bisa dibuka. Cek izin kamera di browser.',
      );
    } finally {
      startRequestedRef.current = false;
    }
  }, [scanFrame]);

  useEffect(() => {
    adminService.members().then(setMembers);
    packageService.list().then(setPackages);
    void refreshRecentScans();
  }, [refreshRecentScans]);

  useEffect(() => {
    void startCamera();
  }, []);

  useEffect(
    () => () => {
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
      stopCamera();
    },
    [stopCamera],
  );

  const validationLabel = !membership
    ? 'Menunggu QR valid'
    : membership.status === 'kedaluwarsa'
      ? 'Perlu perpanjangan'
      : membership.status === 'menunggu_pembayaran'
        ? 'Menunggu verifikasi'
        : 'Siap validasi';

  const membershipSummary = !membership
    ? 'Belum ada member yang berhasil dipindai. Arahkan QR member ke kamera untuk memulai validasi.'
    : membership.status === 'kedaluwarsa'
      ? 'Masa aktif sudah habis dan member perlu memperpanjang paket.'
      : membership.status === 'menunggu_pembayaran'
        ? 'Pembayaran member masih menunggu verifikasi admin.'
        : isExpiringSoon
          ? 'Membership masih aktif, tetapi mendekati batas akhir masa berlaku.'
          : 'Member siap masuk dan bisa divalidasi dari scanner.';

  const scannerGuidance =
    cameraState === 'loading'
      ? 'Kamera sedang disiapkan. Tunggu beberapa detik sampai pratinjau stabil.'
      : cameraState === 'unsupported'
        ? 'Browser ini belum mendukung pembacaan QR otomatis. Gunakan Chrome Android terbaru untuk hasil terbaik.'
        : cameraState === 'error'
          ? 'Kamera belum siap dipakai. Cek izin kamera, lalu aktifkan ulang scanner.'
          : result?.tone === 'danger'
            ? 'QR berhasil terbaca, tetapi validasi ditolak. Periksa status membership atau coba scan QR member lain.'
            : result?.tone === 'warning'
              ? 'QR berhasil terbaca, tetapi membership membutuhkan tindakan lebih lanjut sebelum check-in.'
              : cameraState === 'ready' && !lastDetectedCode
                ? 'Arahkan QR ke tengah frame, jaga tangan tetap stabil, dan pastikan cahaya cukup agar QR cepat terbaca.'
                : cameraState === 'ready' && lastDetectedCode && !currentMember
                  ? 'QR sudah terdeteksi. Sistem sedang menyiapkan hasil validasi untuk ditampilkan.'
                  : 'Scanner siap dipakai untuk member berikutnya.';

  const scanFreshness =
    lastDetectionAt && Date.now() - lastDetectionAt < 10000
      ? 'QR terakhir baru saja terdeteksi.'
      : 'Belum ada QR baru yang terdeteksi dalam beberapa detik terakhir.';

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Scanner"
        title="Scan QR member"
        description="Arahkan kamera ke QR code member. Sistem akan mendeteksi dan memvalidasi check-in secara otomatis."
      />
      <section className={`section-intro-card ${membership?.status === 'kedaluwarsa' ? 'warning' : ''}`}>
        <div>
          <strong>Scanner QR otomatis</strong>
          <p>Halaman ini langsung membaca QR dari kamera tanpa input manual atau simulasi scan.</p>
        </div>
        <div className="section-intro-meta">
          <small>Member terakhir</small>
          <strong>{currentMember?.nama ?? 'Belum ada hasil scan'}</strong>
        </div>
      </section>
      <section className="scanner-panel">
        <div className="panel scanner-visual-card">
          <div className="scanner-visual-header">
            <div>
              <small>Area validasi</small>
              <strong>Pratinjau scanner</strong>
            </div>
            <div className="scanner-visual-actions">
              <span
                className={`table-chip ${
                  cameraState === 'ready'
                    ? 'success'
                    : cameraState === 'error' || cameraState === 'unsupported'
                      ? 'warning'
                      : 'subtle'
                }`}
              >
                {cameraState === 'ready'
                  ? 'Kamera aktif'
                  : cameraState === 'loading'
                    ? 'Membuka kamera'
                    : cameraState === 'unsupported'
                      ? 'Scanner tidak didukung'
                      : cameraState === 'error'
                        ? 'Perlu izin'
                        : 'Siap scan'}
              </span>
              <button
                type="button"
                className="button-filter"
                onClick={cameraState === 'ready' ? stopCamera : () => void startCamera()}
              >
                {cameraState === 'ready' ? 'Matikan kamera' : 'Aktifkan kamera'}
              </button>
            </div>
          </div>
          <div className={`scanner-frame scanner-frame-premium ${scanPulseTone ? `scanner-frame--${scanPulseTone}` : ''}`}>
            <div className="scanner-corners scanner-corners-top-left" />
            <div className="scanner-corners scanner-corners-top-right" />
            <div className="scanner-corners scanner-corners-bottom-left" />
            <div className="scanner-corners scanner-corners-bottom-right" />
            <div className={`scanner-target ${cameraState === 'ready' ? 'scanner-target--camera' : ''}`}>
              <video ref={videoRef} className="scanner-camera-feed" autoPlay muted playsInline />
              <div className="scanner-target-grid" />
              <div className="scanner-line scanner-line-premium" />
            </div>
            <div className="scanner-stage-card">
              <small>{lastDetectedCode ? 'QR terdeteksi' : 'Menunggu QR code'}</small>
              <strong>{lastDetectedCode || 'Arahkan QR member ke dalam frame'}</strong>
            </div>
          </div>
          <p className="scanner-camera-note">{cameraMessage}</p>

          {/* Manual input fallback — selalu tersedia */}
          <form onSubmit={handleManualSubmit} style={{ padding: '0.75rem', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Paste / ketik QR code manual... (contoh: GF|member:1|membership:1)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid var(--line-soft)',
                fontSize: '0.82rem',
                outline: 'none',
                background: 'var(--bg-card, #fff)',
              }}
            />
            <button
              type="submit"
              className="button-primary"
              disabled={manualLoading || !manualInput.trim()}
              style={{ whiteSpace: 'nowrap', padding: '0.45rem 1rem', fontSize: '0.82rem' }}
            >
              {manualLoading ? '...' : 'Scan'}
            </button>
          </form>
          <div className="scanner-meta-strip">
            <div>
              <small>Validasi</small>
              <strong>{validationLabel}</strong>
            </div>
            <div>
              <small>Sisa masa aktif</small>
              <strong>
                {daysRemaining === null
                  ? '-'
                  : membership?.status === 'kedaluwarsa'
                    ? 'Sudah berakhir'
                    : `${daysRemaining} hari`}
              </strong>
            </div>
            <div>
              <small>Status scan terakhir</small>
              <strong>
                {result?.tone === 'success'
                  ? 'Berhasil'
                  : result?.tone === 'idle' || !result
                    ? 'Menunggu scan'
                    : 'Ditolak'}
              </strong>
            </div>
          </div>
          <div className="scanner-guidance-card">
            <small>Panduan scan</small>
            <strong>{scannerGuidance}</strong>
            <p>{scanFreshness}</p>
          </div>
        </div>
        <div className="panel scanner-control-panel">
          <div className="scanner-control-head">
            <div>
              <small>Hasil validasi</small>
              <h3>Informasi member terdeteksi</h3>
            </div>
            <span
              className={`table-chip ${
                result?.tone === 'success' ? 'success' : result?.tone === 'warning' ? 'warning' : 'subtle'
              }`}
            >
              {result ? 'Hasil terbaru' : 'Menunggu scan'}
            </span>
          </div>
          <div className="scanner-member-card">
            <div className="scanner-member-identity">
              <span>{currentMember?.nama?.slice(0, 2).toUpperCase() ?? 'GF'}</span>
              <div>
                <strong>{currentMember?.nama ?? 'Belum ada member terdeteksi'}</strong>
                <small>{currentMember?.email ?? 'QR member yang valid akan menampilkan data di sini'}</small>
              </div>
            </div>
            <div className="scanner-member-grid">
              <div>
                <small>Status membership</small>
                <strong>
                  {membership ? (
                    isExpiringSoon ? (
                      <StatusBadge status={membership.status} label="Segera berakhir" tone="warning" />
                    ) : (
                      <StatusBadge status={membership.status} />
                    )
                  ) : (
                    'Belum ada data'
                  )}
                </strong>
              </div>
              <div>
                <small>Paket aktif</small>
                <strong>{currentPackage?.nama_paket ?? 'Belum ada paket'}</strong>
              </div>
              <div>
                <small>Berlaku sampai</small>
                <strong>{membership?.tanggal_berakhir ? formatDisplayDate(membership.tanggal_berakhir) : '-'}</strong>
              </div>
              <div>
                <small>Validasi</small>
                <strong>{validationLabel}</strong>
              </div>
            </div>
            <p>{membershipSummary}</p>
          </div>
          {result ? (
            <div className={`scanner-result-card scanner-result-card--${result.tone}`}>
              <small>Hasil scan terbaru</small>
              <strong>{result.message}</strong>
              <p>
                {result.timestamp
                  ? `Tercatat pada ${formatDisplayDateTime(result.timestamp)}`
                  : 'Menunggu proses validasi scanner.'}
              </p>
            </div>
          ) : null}
        </div>
      </section>
      <section className="panel scanner-history-panel">
        <div className="panel-toolbar">
          <div>
            <h3>Riwayat scan terakhir</h3>
            <p>Panel ini membantu admin memantau hasil validasi terbaru.</p>
          </div>
          <span className="table-chip">{recentScansView.length} log terbaru</span>
        </div>
        <div className="scanner-history-grid">
          {recentScansView.length === 0 ? (
            <div className="scanner-history-empty">
              <strong>Belum ada scan terbaru</strong>
              <p>Arahkan kamera ke QR member untuk mulai mengisi panel ini.</p>
            </div>
          ) : (
            recentScansView.map((scan) => (
              <article
                key={scan.id}
                className={`scanner-history-card scanner-history-card--${scan.hasil === 'ditolak' ? 'rejected' : 'success'}`}
              >
                <div className="scanner-history-top">
                  <strong>{scan.member?.nama ?? 'Member tidak ditemukan'}</strong>
                  <span className={`table-chip ${scan.hasil === 'ditolak' ? 'warning' : 'success'}`}>
                    {scan.hasil === 'ditolak' ? 'Ditolak' : 'Berhasil'}
                  </span>
                </div>
                <p>{scan.catatan ?? 'Validasi QR berhasil'}</p>
                <small>{formatDisplayDateTime(scan.waktu_scan)}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
