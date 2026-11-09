import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  XCircle,
  Scan,
  RefreshCw,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldAlert,
  Ship,
  Clock,
  Calendar,
  UserCheck,
  AlertTriangle,
  Upload,
  UserX,
  Play,
  Sun,
  Moon,
  Sliders,
  RotateCcw,
  Eye,
  Zap,
} from 'lucide-react';
import { Personnel, BiometricVerificationResult } from '../types';
import { playSuccessChime, playDeniedBuzzer } from '../utils/audioAlerts';
import {
  matchFaceAgainstCandidates,
  extractFaceDescriptor,
  preprocessCanvasImageData,
  analyzeAmbientLighting,
  ImagePreprocessOptions,
  AmbientLightInfo,
} from '../utils/faceBiometrics';
import { createSyntheticPortrait } from '../utils/avatarGenerator';

interface CameraViewProps {
  personnelList: Personnel[];
  vesselName: string;
  onAuthorizedEntry: (matchedPerson: Personnel, result: BiometricVerificationResult) => Promise<void>;
  onDeniedEntry: (reason: string, details: string, confidence?: number, snapshot?: string) => Promise<void>;
  isSyncingSheet: boolean;
  sheetConnected: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  personnelList,
  vesselName,
  onAuthorizedEntry,
  onDeniedEntry,
  isSyncingSheet,
  sheetConnected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [liveFaceDetected, setLiveFaceDetected] = useState<boolean | null>(null);

  // Maximum Quality Camera Resolution & Device State
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [streamResolution, setStreamResolution] = useState<{
    width: number;
    height: number;
    label: string;
    fps?: number;
  }>({
    width: 1920,
    height: 1080,
    label: 'Negociando Máxima Resolución...',
  });
  const [viewMode, setViewMode] = useState<'contain' | 'cover'>('contain'); // Default 100% optical sensor fidelity without crop distortion

  // Image Pre-Processing & Low-Light Enhancement State
  const [autoLowLightBoost, setAutoLowLightBoost] = useState(true);
  const [brightness, setBrightness] = useState(0); // -50 to +50
  const [contrast, setContrast] = useState(100); // 70 to 180 (%)
  const [nightMode, setNightMode] = useState(false);
  const [showEnhancementPanel, setShowEnhancementPanel] = useState(false);
  const [ambientLight, setAmbientLight] = useState<AmbientLightInfo>({
    avgLuminance: 120,
    status: 'OPTIMAL',
    description: 'Iluminación adecuada para reconocimiento facial',
    isLowLight: false,
    appliedGamma: 1.0,
  });

  // Active Alert Display States
  const [activeAlert, setActiveAlert] = useState<{
    type: 'GREEN' | 'RED';
    title: string;
    subtitle: string;
    personName?: string;
    personRole?: string;
    personId?: string;
    dateStr: string;
    timeStr: string;
    confidence?: number;
    reason?: string;
    capturedPhoto?: string;
    matchedPhoto?: string;
  } | null>(null);

  const handleMainVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && stream) {
      node.srcObject = stream;
      node.play().catch(() => {});
    }
  };

  // Safe Maximum Hardware Quality Camera Initialization
  const startCamera = useCallback(async (preferredDeviceId?: string) => {
    try {
      setCameraError(null);
      setUploadedPreview(null);

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Navegador o entorno sin acceso a cámara web.');
      }

      const deviceIdToUse = preferredDeviceId !== undefined ? preferredDeviceId : selectedCameraId;

      // 1. Progressively negotiate maximum optical hardware resolution (4K -> 1080p -> 720p)
      let media: MediaStream | null = null;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
            facingMode: deviceIdToUse ? undefined : 'user',
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
      } catch {
        // Fallback with ideal 1080p if strict min is rejected by hardware driver
        try {
          media = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
              facingMode: deviceIdToUse ? undefined : 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          // General fallback
          media = await navigator.mediaDevices.getUserMedia({
            video: deviceIdToUse ? { deviceId: { exact: deviceIdToUse } } : true,
            audio: false,
          });
        }
      }

      if (!media) throw new Error('No se pudo inicializar la cámara en alta definición.');

      setStream(media);
      setSimulationMode(false);

      if (videoRef.current) {
        videoRef.current.srcObject = media;
        videoRef.current.play().catch(() => {});
      }

      // Read actual hardware stream resolution
      const videoTrack = media.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        const width = settings.width || 1920;
        const height = settings.height || 1080;
        const fps = settings.frameRate ? Math.round(settings.frameRate) : 30;

        let qualityBadge = '1080p Full HD';
        if (width >= 3840 || height >= 2160) {
          qualityBadge = '4K Ultra HD';
        } else if (width >= 2560 || height >= 1440) {
          qualityBadge = '2K QHD';
        } else if (width >= 1920 || height >= 1080) {
          qualityBadge = '1080p Full HD';
        } else if (width >= 1280 || height >= 720) {
          qualityBadge = '720p HD';
        } else {
          qualityBadge = `${width}×${height}`;
        }

        setStreamResolution({
          width,
          height,
          label: `${qualityBadge} (${width}×${height} @ ${fps}fps)`,
          fps,
        });

        // Try applying continuous auto-focus and auto-exposure if supported by device
        try {
          if (videoTrack.applyConstraints) {
            await videoTrack.applyConstraints({
              advanced: [
                { focusMode: 'continuous' } as any,
                { exposureMode: 'continuous' } as any,
                { whiteBalanceMode: 'continuous' } as any,
              ],
            });
          }
        } catch {
          // Hardware advanced constraints are optional
        }
      }

      // Enumerate connected video cameras
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoInputs);
        if (videoTrack && !selectedCameraId && videoTrack.getSettings) {
          const activeDevId = videoTrack.getSettings().deviceId;
          if (activeDevId) setSelectedCameraId(activeDevId);
        }
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setCameraError(
        'Cámara web no disponible en este dispositivo o permisos bloqueados en el navegador.'
      );
      setSimulationMode(true);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Active pre-processing options configuration
  const currentPreprocessOpts: ImagePreprocessOptions = {
    autoLowLightBoost,
    brightnessOffset: brightness,
    contrastMultiplier: contrast / 100,
    nightMode,
  };

  // Real-time live face detection & ambient lighting monitor
  useEffect(() => {
    if (!stream || cameraError || isVerifying || activeAlert || uploadedPreview) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const video = videoRef.current;
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 120;
        testCanvas.height = 150;
        const tctx = testCanvas.getContext('2d', { willReadFrequently: true });
        if (!tctx) return;
        tctx.drawImage(video, 0, 0, 120, 150);

        const lightInfo = analyzeAmbientLighting(video, currentPreprocessOpts);
        const desc = await extractFaceDescriptor(testCanvas, currentPreprocessOpts);

        if (isMounted) {
          setAmbientLight(lightInfo);
          setLiveFaceDetected(desc.hasFace);
        }
        testCanvas.width = 0;
        testCanvas.height = 0;
      } catch {
        // Silent check
      }
    }, 850);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    stream,
    cameraError,
    isVerifying,
    activeAlert,
    uploadedPreview,
    autoLowLightBoost,
    brightness,
    contrast,
    nightMode,
  ]);

  // Compute live CSS video filter matching current calibration
  const computedFilter = (() => {
    let b = 100 + brightness;
    let c = contrast;
    if (nightMode) {
      b += 26;
      c = Math.max(c, 132);
    } else if (autoLowLightBoost && ambientLight.isLowLight) {
      const boostAmount = ambientLight.status === 'VERY_DARK' ? 34 : 20;
      b += boostAmount;
      c = Math.round(c * 1.15);
    }
    return `brightness(${Math.min(220, Math.max(40, b))}%) contrast(${Math.min(240, Math.max(50, c))}%)`;
  })();

  // Format Date and Time
  const getNowFormatted = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return { dateStr, timeStr };
  };

  // Capture fresh frame from video, applying pre-processing adjustments directly to image pixels
  const captureFrame = (): string | null => {
    // If a manual photo was uploaded for this scan, consume and clear it immediately
    if (uploadedPreview) {
      const img = uploadedPreview;
      setUploadedPreview(null);
      return img;
    }

    if (videoRef.current && stream && !cameraError) {
      const video = videoRef.current;
      // Ensure video is actively streaming
      if (video.readyState < 2 || !video.videoWidth) {
        return null;
      }

      // Capture at true native optical resolution of the camera (up to 1080p/4K)
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);

        // Pre-process image: lift dark areas with adaptive gamma & adjust contrast
        preprocessCanvasImageData(ctx, width, height, currentPreprocessOpts);

        // Crystal clear 95% JPEG encoding
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        // Wipe canvas memory immediately
        ctx.clearRect(0, 0, width, height);
        canvas.width = 0;
        canvas.height = 0;
        return dataUrl;
      }
    }

    return null;
  };

  // Perform Biometric Verification
  const handleVerify = async (manualImage?: string) => {
    if (isVerifying) return;
    setIsVerifying(true);

    try {
      const imageToVerify = manualImage || captureFrame();
      if (!imageToVerify) {
        throw new Error('No se detectó imagen en vivo. Por favor ubíquese frente a la cámara web o cargue una foto.');
      }

      // 1. Run client-side computer vision biometric match engine with low-light pre-processing
      const clientMatch = await matchFaceAgainstCandidates(
        imageToVerify,
        personnelList,
        currentPreprocessOpts
      );

      // 2. Prepare payload for server synchronization
      const candidatePayload = personnelList.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        vessel: p.vessel,
        isAuthorized: p.isAuthorized,
        photoBase64: p.photoUrl,
      }));

      let result: BiometricVerificationResult = {
        hasFace: clientMatch.hasFace,
        matched: clientMatch.matched,
        candidateId: clientMatch.candidateId,
        candidateName: clientMatch.candidateName,
        candidateRole: clientMatch.candidateRole,
        candidateVessel: clientMatch.candidateVessel,
        confidence: clientMatch.confidence,
        isAuthorized: clientMatch.isAuthorized,
        reason: clientMatch.reason,
      };

      try {
        const res = await fetch('/api/verify-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capturedImage: imageToVerify,
            candidates: candidatePayload,
            clientMatchResult: clientMatch,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json') && res.ok) {
          const serverResult = await res.json();
          // Merge server verification if provided
          if (serverResult && typeof serverResult.hasFace === 'boolean') {
            result = {
              hasFace: serverResult.hasFace,
              matched: serverResult.matched,
              candidateId: serverResult.candidateId || clientMatch.candidateId,
              candidateName: serverResult.candidateName || clientMatch.candidateName,
              candidateRole: serverResult.candidateRole || clientMatch.candidateRole,
              candidateVessel: serverResult.candidateVessel || clientMatch.candidateVessel,
              confidence: serverResult.confidence || clientMatch.confidence,
              isAuthorized: serverResult.isAuthorized !== undefined ? serverResult.isAuthorized : clientMatch.isAuthorized,
              reason: serverResult.reason || clientMatch.reason,
            };
          }
        }
      } catch {
        // Fallback gracefully to the high-accuracy client biometric engine
      }

      const { dateStr, timeStr } = getNowFormatted();

      // Check access permission:
      // Must have detected face, matched with a candidate, AND candidate must be AUTHORIZED
      if (result.hasFace && result.matched && result.candidateId && result.isAuthorized) {
        const matchedPerson = personnelList.find((p) => p.id === result.candidateId);
        if (matchedPerson && matchedPerson.isAuthorized) {
          // GREEN ALERT: ACCESS GRANTED
          if (soundEnabled) playSuccessChime();

          setActiveAlert({
            type: 'GREEN',
            title: 'ACCESO AUTORIZADO',
            subtitle: 'Bienvenido a bordo de la embarcación',
            personName: matchedPerson.name,
            personRole: matchedPerson.role,
            personId: matchedPerson.id,
            dateStr,
            timeStr,
            confidence: Math.round(result.confidence || 95),
            reason: result.reason || 'Identidad verificada exitosamente',
            capturedPhoto: imageToVerify,
            matchedPhoto: matchedPerson.photoUrl,
          });

          // Save automatic entry to Google Sheet
          await onAuthorizedEntry(matchedPerson, result);

          // Auto-clear alert after 4.5 seconds
          setTimeout(() => {
            setActiveAlert((curr) => (curr?.type === 'GREEN' ? null : curr));
          }, 4500);

          return;
        }
      }

      // RED ALERT: ACCESS DENIED
      if (soundEnabled) playDeniedBuzzer();

      const reasonDenied = !result.hasFace
        ? 'No se detectó un rostro humano claro frente a la cámara (verifique iluminación y centre su rostro en el óvalo guía)'
        : !result.matched
        ? 'Rostro no coincide con el personal registrado en la base de datos'
        : 'Personal identificado pero su acceso está SUSPENDIDO';

      const matchedCand = result.candidateId
        ? personnelList.find((p) => p.id === result.candidateId)
        : undefined;

      setActiveAlert({
        type: 'RED',
        title: 'ACCESO DENEGADO',
        subtitle: 'Ingreso no permitido a la embarcación',
        personName: result.candidateName || 'Desconocido / No Registrado',
        personRole: result.candidateRole || 'Sin acreditación',
        personId: result.candidateId || 'N/A',
        dateStr,
        timeStr,
        confidence: Math.round(result.confidence || 0),
        reason: result.reason || reasonDenied,
        capturedPhoto: imageToVerify,
        matchedPhoto: matchedCand?.photoUrl,
      });

      // Save automatic denied attempt to Google Sheet Log_Auditoria
      await onDeniedEntry(
        result.reason || reasonDenied,
        `Intento de ingreso facial denegado (${reasonDenied}). Confianza: ${result.confidence || 0}%.`,
        result.confidence,
        imageToVerify
      );

      // Auto-clear alert after 5 seconds
      setTimeout(() => {
        setActiveAlert((curr) => (curr?.type === 'RED' ? null : curr));
      }, 5000);
    } catch (err: any) {
      console.error('Verification error:', err);
      if (soundEnabled) playDeniedBuzzer();
      const { dateStr, timeStr } = getNowFormatted();

      setActiveAlert({
        type: 'RED',
        title: 'ALERTA DE SEGURIDAD',
        subtitle: 'No se pudo validar el acceso',
        dateStr,
        timeStr,
        reason: err.message || 'Error técnico durante la verificación facial',
      });

      await onDeniedEntry(
        'Fallo de verificación',
        err.message || 'Error en puesto de acceso'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedPreview(dataUrl);
      // Auto verify uploaded photo immediately
      handleVerify(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Continuous Auto Scan loop if enabled
  useEffect(() => {
    if (!autoScanEnabled || activeAlert || isVerifying) return;
    const interval = setInterval(() => {
      if (!isVerifying && !activeAlert) {
        handleVerify();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [autoScanEnabled, activeAlert, isVerifying, personnelList]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top vessel header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Puesto de Pasarela</span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                Sistema Operativo
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{vesselName}</h2>
          </div>
        </div>

        {/* Controls: Audio, AutoScan & Pre-processing */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pre-Processing & Low-Light Calibration Button */}
          <button
            type="button"
            onClick={() => setShowEnhancementPanel(!showEnhancementPanel)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all border ${
              showEnhancementPanel
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
                : nightMode || brightness !== 0 || contrast !== 100 || ambientLight.isLowLight
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Ajustar brillo, contraste y realce adaptativo para poca luz"
          >
            <Sliders className="h-4 w-4 text-amber-400" />
            <span>Pre-Procesamiento Luz</span>
            {ambientLight.isLowLight && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 text-xs font-bold transition-all"
          >
            <Upload className="h-4 w-4 text-blue-400" />
            Cargar Foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
              soundEnabled
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? 'Sonido ON' : 'Silencio'}
          </button>

          <button
            type="button"
            onClick={() => setAutoScanEnabled(!autoScanEnabled)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
              autoScanEnabled
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {autoScanEnabled ? 'Auto-Scan ACTIVO' : 'Escaneo Manual'}
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE PRE-PROCESSING & LOW-LIGHT CALIBRATION PANEL */}
      {showEnhancementPanel && (
        <div className="rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Pre-Procesamiento de Imagen & Realce para Poca Luz</h3>
                <p className="text-xs text-slate-400">
                  Compensación de gamma no lineal y estiramiento de contraste para pasarelas oscuras
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBrightness(0);
                  setContrast(100);
                  setAutoLowLightBoost(true);
                  setNightMode(false);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 border border-slate-700 transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                Restablecer
              </button>
              <button
                type="button"
                onClick={() => setShowEnhancementPanel(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setBrightness(0);
                setContrast(100);
                setAutoLowLightBoost(true);
                setNightMode(false);
              }}
              className={`rounded-xl p-3 text-left border transition-all ${
                !nightMode && brightness === 0 && contrast === 100
                  ? 'bg-blue-600/25 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold block">☀️ Balance Estándar</span>
              <span className="text-[11px] text-slate-400">Diurno / Iluminación natural</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNightMode(true);
                setAutoLowLightBoost(true);
                setBrightness(22);
                setContrast(135);
              }}
              className={`rounded-xl p-3 text-left border transition-all ${
                nightMode
                  ? 'bg-amber-600/30 border-amber-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold block flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-amber-400" />
                Pasarela Nocturna
              </span>
              <span className="text-[11px] text-amber-300/80">Realce gamma 0.50</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNightMode(false);
                setAutoLowLightBoost(true);
                setBrightness(10);
                setContrast(150);
              }}
              className={`rounded-xl p-3 text-left border transition-all ${
                !nightMode && contrast === 150
                  ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold block">⚡ Alto Contraste</span>
              <span className="text-[11px] text-slate-400">Para niebla, lluvia o contraluz</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNightMode(false);
                setAutoLowLightBoost(true);
                setBrightness(30);
                setContrast(120);
              }}
              className={`rounded-xl p-3 text-left border transition-all ${
                !nightMode && brightness === 30
                  ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold block">💡 Brillo Máximo</span>
              <span className="text-[11px] text-slate-400">Espacios con sombra densa</span>
            </button>
          </div>

          {/* Sliders & Automatic Boost Toggle */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-slate-800">
            {/* Auto Adaptive Boost Switch */}
            <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Auto-Realce Poca Luz</span>
                <span className="text-[11px] text-slate-400">Ajusta gamma dinámicamente</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoLowLightBoost(!autoLowLightBoost)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                  autoLowLightBoost
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoLowLightBoost ? '✓ ACTIVO' : '✕ INACTIVO'}
              </button>
            </div>

            {/* Brightness Slider */}
            <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-bold text-slate-300">Brillo de Cámara</span>
                <span className="font-mono font-bold text-amber-400">
                  {brightness > 0 ? `+${brightness}` : brightness}%
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="2"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Contrast Slider */}
            {/* Contrast Slider */}
            <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-bold text-slate-300">Contraste Anatómico</span>
                <span className="font-mono font-bold text-blue-400">{contrast}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="180"
                step="5"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Camera Device Selector & Hardware Quality Info */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Resolución Óptica Negociada:</span>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-0.5">
                {streamResolution.label}
              </span>
            </div>

            {availableCameras.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Entrada de Video:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const devId = e.target.value;
                    setSelectedCameraId(devId);
                    startCamera(devId);
                  }}
                  className="rounded-lg bg-slate-950 border border-slate-700 text-xs text-white px-2.5 py-1 font-bold focus:outline-none focus:border-blue-500"
                >
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Cámara #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Camera Viewfinder and Biometric Station */}
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-black border-4 border-slate-800 shadow-2xl">
        {/* Hidden processing canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Video / Simulator View */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
          {/* Top-Left Live Ambient Lighting & Sensor Badges */}
          <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 text-xs font-bold text-white flex items-center gap-2 shadow-lg">
              {ambientLight.isLowLight ? (
                <Moon className="h-4 w-4 text-amber-400 animate-pulse" />
              ) : (
                <Sun className="h-4 w-4 text-amber-400" />
              )}
              <span>{ambientLight.description}</span>
              <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700/50">
                {ambientLight.avgLuminance} Y
              </span>
            </div>

            {autoLowLightBoost && ambientLight.isLowLight && (
              <div className="rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 animate-pulse shadow-lg">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Realce Activo (γ {ambientLight.appliedGamma})
              </div>
            )}

            {nightMode && (
              <div className="rounded-xl bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 shadow-lg">
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                Modo Nocturno
              </div>
            )}
          </div>

          {/* Top-Right Resolution & Quality Badge */}
          <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-slate-950/85 backdrop-blur-md border border-emerald-500/50 px-3 py-1.5 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shadow-lg">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{streamResolution.label}</span>
            </div>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'contain' ? 'cover' : 'contain')}
              className="rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-all flex items-center gap-1"
              title={
                viewMode === 'contain'
                  ? 'Modo: Nitidez Óptica 100% (Sin Recorte/Sin Zoom). Clic para Llenar'
                  : 'Modo: Llenar Pantalla (Zoom). Clic para Óptico 100%'
              }
            >
              {viewMode === 'contain' ? '🔍 Óptico 100%' : '↔ Llenar'}
            </button>
          </div>

          {uploadedPreview ? (
            <div className="relative h-full w-full flex items-center justify-center bg-slate-950">
              <img
                src={uploadedPreview}
                alt="Foto cargada"
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-4 right-4 rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-xs font-bold text-white flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-blue-400" />
                Foto cargada manualmente
                <button
                  type="button"
                  onClick={() => {
                    setUploadedPreview(null);
                    startCamera();
                  }}
                  className="ml-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Volver a cámara
                </button>
              </div>
            </div>
          ) : !cameraError && stream ? (
            <video
              ref={handleMainVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                filter: computedFilter,
                transform: 'scaleX(-1) translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                imageRendering: '-webkit-optimize-contrast',
              }}
              className={`h-full w-full ${
                viewMode === 'contain' ? 'object-contain' : 'object-cover'
              } bg-black`}
            />
          ) : (
            /* Simulation Feed */
            <div className="relative h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 p-6 text-center">
              <div className="relative h-56 w-44 rounded-3xl overflow-hidden border-2 border-blue-500/60 shadow-2xl mb-4 bg-slate-900">
                {personnelList.length > 0 ? (
                  <img
                    src={personnelList[0].photoUrl}
                    alt="Simulación de rostro"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Camera className="h-16 w-16 text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                <div className="absolute bottom-2 inset-x-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-blue-300">
                  Modo Simulación / Prueba
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 text-xs font-bold transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reintentar Cámara Web
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold transition-all shadow-md"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Cargar Imagen de Prueba
                </button>
              </div>
            </div>
          )}

          {/* Biometric Face Target Reticle Overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {/* Rounded Oval Guide */}
            <div
              className={`relative h-64 w-52 rounded-[45px] border-2 transition-all duration-300 ${
                isVerifying
                  ? 'border-blue-400 shadow-[0_0_35px_rgba(59,130,246,0.6)] animate-pulse'
                  : activeAlert?.type === 'GREEN'
                  ? 'border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.8)]'
                  : activeAlert?.type === 'RED'
                  ? 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]'
                  : liveFaceDetected
                  ? 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6)]'
                  : 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
              }`}
            >
              {/* Scanner line animation when analyzing */}
              {isVerifying && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-[bounce_1.5s_infinite]" />
              )}

              {/* Corner marks */}
              <div
                className={`absolute -top-2 -left-2 h-6 w-6 border-t-4 border-l-4 rounded-tl-lg ${
                  liveFaceDetected ? 'border-cyan-400' : 'border-blue-400'
                }`}
              />
              <div
                className={`absolute -top-2 -right-2 h-6 w-6 border-t-4 border-r-4 rounded-tr-lg ${
                  liveFaceDetected ? 'border-cyan-400' : 'border-blue-400'
                }`}
              />
              <div
                className={`absolute -bottom-2 -left-2 h-6 w-6 border-b-4 border-l-4 rounded-bl-lg ${
                  liveFaceDetected ? 'border-cyan-400' : 'border-blue-400'
                }`}
              />
              <div
                className={`absolute -bottom-2 -right-2 h-6 w-6 border-b-4 border-r-4 rounded-br-lg ${
                  liveFaceDetected ? 'border-cyan-400' : 'border-blue-400'
                }`}
              />
            </div>

            <div className="mt-4 rounded-full bg-slate-950/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-300 border border-slate-700/60 backdrop-blur-md flex items-center gap-2">
              {isVerifying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>Analizando rasgos biométricos...</span>
                </>
              ) : liveFaceDetected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-cyan-300 font-bold">✓ Rostro enfocado en cámara (Listo)</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  <span>Alinee el rostro dentro del óvalo guía</span>
                </>
              )}
            </div>
          </div>

          {/* ACTIVE FULLSCREEN VISUAL ALERT (GREEN OR RED) */}
          {activeAlert && (
            <div
              className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-95 ${
                activeAlert.type === 'GREEN'
                  ? 'bg-emerald-950/95 border-8 border-emerald-500 text-white'
                  : 'bg-red-950/95 border-8 border-red-500 text-white'
              }`}
            >
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full mb-4 shadow-2xl animate-bounce ${
                  activeAlert.type === 'GREEN'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/50'
                    : 'bg-red-500 text-white shadow-red-500/50'
                }`}
              >
                {activeAlert.type === 'GREEN' ? (
                  <CheckCircle2 className="h-16 w-16" strokeWidth={3} />
                ) : (
                  <XCircle className="h-16 w-16" strokeWidth={3} />
                )}
              </div>

              {/* HUGE ALERT TITLE */}
              <h1
                className={`text-4xl md:text-5xl font-black tracking-tight mb-2 ${
                  activeAlert.type === 'GREEN' ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {activeAlert.title}
              </h1>

              <p className="text-lg md:text-xl font-medium text-slate-200 mb-6">
                {activeAlert.subtitle}
              </p>

              {/* Detailed Badge Box */}
              <div
                className={`w-full max-w-lg rounded-2xl p-5 border text-left shadow-2xl ${
                  activeAlert.type === 'GREEN'
                    ? 'bg-emerald-900/60 border-emerald-500/50'
                    : 'bg-red-900/60 border-red-500/50'
                }`}
              >
                {/* Visual Face Comparison Row */}
                <div className="mb-4 pb-4 border-b border-white/10 flex items-center justify-around gap-4 bg-black/40 rounded-2xl p-3">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-300 mb-1.5">
                      Rostro en Cámara
                    </span>
                    {activeAlert.capturedPhoto ? (
                      <img
                        src={activeAlert.capturedPhoto}
                        alt="Rostro capturado"
                        className="h-20 w-20 rounded-xl object-cover border-2 border-white/50 shadow-md"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                        N/A
                      </div>
                    )}
                  </div>

                  <div className="text-center font-bold text-xs px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-slate-300">
                    {activeAlert.type === 'GREEN' ? '✓ Coincide' : '✕ No Coincide'}
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-300 mb-1.5">
                      Foto Registrada
                    </span>
                    {activeAlert.matchedPhoto ? (
                      <img
                        src={activeAlert.matchedPhoto}
                        alt="Foto referencia"
                        className="h-20 w-20 rounded-xl object-cover border-2 border-white/50 shadow-md"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col items-center justify-center text-[10px] text-slate-400 p-1 text-center">
                        <UserX className="h-6 w-6 text-red-400 mb-1" />
                        Sin Registro
                      </div>
                    )}
                  </div>
                </div>
                {activeAlert.type === 'GREEN' && activeAlert.personName && (
                  <div className="mb-4 pb-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-bold tracking-wider text-emerald-300">
                        Tripulante Identificado
                      </span>
                      <h3 className="text-2xl font-black text-white">{activeAlert.personName}</h3>
                      <p className="text-sm font-semibold text-emerald-200">{activeAlert.personRole}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase font-bold tracking-wider text-emerald-300">ID / Cédula</span>
                      <p className="text-base font-mono font-bold text-white">{activeAlert.personId}</p>
                    </div>
                  </div>
                )}

                {activeAlert.type === 'RED' && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <span className="text-xs uppercase font-bold tracking-wider text-red-300">
                      Motivo del Rechazo
                    </span>
                    <p className="text-lg font-bold text-red-100 mt-1">{activeAlert.reason}</p>
                    {activeAlert.personName && activeAlert.personName !== 'Desconocido / No Registrado' && (
                      <p className="text-sm text-red-200 mt-1">
                        Sujeto: {activeAlert.personName} ({activeAlert.personRole})
                      </p>
                    )}
                  </div>
                )}

                {/* EXACT DATE AND TIME (Core Requirement) */}
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-black/40 p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-slate-300" />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Fecha</span>
                      <p className="text-base font-bold text-white">{activeAlert.dateStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-300" />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Hora</span>
                      <p className="text-base font-mono font-bold text-white">{activeAlert.timeStr}</p>
                    </div>
                  </div>
                </div>

                {/* Central Sheet Status indicator */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeAlert.type === 'GREEN' ? 'bg-emerald-400 animate-ping' : 'bg-red-400'
                      }`}
                    />
                    {activeAlert.type === 'GREEN'
                      ? 'Registro guardado automáticamente en Google Sheet'
                      : 'Intento registrado en Log de Auditoría de Google Sheet'}
                  </span>
                  {activeAlert.confidence !== undefined && (
                    <span className="font-mono text-slate-300">Confianza: {activeAlert.confidence}%</span>
                  )}
                </div>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => {
                  setActiveAlert(null);
                  setUploadedPreview(null);
                }}
                className="mt-6 rounded-xl bg-white/20 hover:bg-white/30 text-white px-8 py-2.5 font-bold text-sm tracking-wider uppercase transition-all backdrop-blur-md"
              >
                Continuar
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR - LARGE TOUCH BUTTONS */}
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* HUGE SCAN BUTTON */}
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => handleVerify()}
              className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-4 rounded-2xl py-5 px-8 text-xl font-black uppercase tracking-wider text-white shadow-2xl transition-all transform active:scale-95 ${
                isVerifying
                  ? 'bg-blue-800 cursor-wait opacity-80'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
              }`}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-8 w-8 animate-spin" />
                  <span>Verificando Identidad...</span>
                </>
              ) : (
                <>
                  <Scan className="h-8 w-8" />
                  <span>ESCANEAR ROSTRO / REGISTRAR INGRESO</span>
                </>
              )}
            </button>
          </div>

          {/* Quick simulation / test options for the registered crew */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-400" />
                Probar Casos de Verificación con 1 Clic:
              </span>
              <span className="text-xs text-slate-500">
                {personnelList.length} tripulantes registrados
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {personnelList.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerify(person.photoUrl)}
                  className={`group flex items-center gap-2 rounded-xl p-2 text-left border transition-all ${
                    person.isAuthorized
                      ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-500/60 hover:bg-slate-800'
                      : 'bg-red-950/20 border-red-900/50 hover:border-red-500'
                  }`}
                  title={`Simular escaneo de ${person.name} (${person.isAuthorized ? 'Autorizado' : 'Denegado'})`}
                >
                  <img
                    src={person.photoUrl}
                    alt={person.name}
                    className="h-9 w-9 rounded-lg object-cover border border-slate-600 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-blue-400">
                      {person.name.split(' ')[0]}
                    </p>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase ${
                        person.isAuthorized ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {person.isAuthorized ? 'Autorizado' : 'Suspendido'}
                    </span>
                  </div>
                </button>
              ))}

              {/* Explicit test button for Unknown Stranger (Must trigger Red Alert) */}
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => {
                  const strangerPhoto = createSyntheticPortrait(
                    'Visitante Desconocido',
                    'Sin Acreditación',
                    'm',
                    '#d2b48c',
                    '#111827',
                    false
                  );
                  handleVerify(strangerPhoto);
                }}
                className="group flex items-center gap-2 rounded-xl p-2 text-left border border-amber-900/50 bg-amber-950/20 hover:border-amber-500 transition-all"
                title="Probar rostro de persona desconocida / no registrada (debe generar alerta roja)"
              >
                <div className="h-9 w-9 rounded-lg bg-amber-900/40 border border-amber-700 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <UserX className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-amber-200 truncate">Desconocido</p>
                  <span className="inline-block text-[10px] font-bold uppercase text-amber-400">
                    No Registrado
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                sheetConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {sheetConnected
              ? 'Base de datos Google Sheets Conectada'
              : 'Google Sheets Desconectado (guardando en caché local)'}
          </span>
          {isSyncingSheet && (
            <span className="flex items-center gap-1 text-blue-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sincronizando fila en la nube...
            </span>
          )}
        </div>
        <div>
          <span>Normativa SOLAS / ISPS - Control de Acceso Biométrico Marítimo</span>
        </div>
      </div>
    </div>
  );
};
