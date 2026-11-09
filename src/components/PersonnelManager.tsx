import React, { useState, useRef, useEffect } from 'react';
import {
  UserPlus,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Upload,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Ship,
  Sparkles,
} from 'lucide-react';
import { Personnel } from '../types';
import { createSyntheticPortrait } from '../utils/avatarGenerator';

interface PersonnelManagerProps {
  personnelList: Personnel[];
  onAddPersonnel: (person: Personnel) => Promise<void>;
  onToggleAuthorization: (id: string) => Promise<void>;
  onDeletePersonnel: (id: string) => Promise<void>;
  onSyncAllToSheet: () => Promise<void>;
  isSyncing: boolean;
  sheetConnected: boolean;
}

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  personnelList,
  onAddPersonnel,
  onToggleAuthorization,
  onDeletePersonnel,
  onSyncAllToSheet,
  isSyncing,
  sheetConnected,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New personnel form state
  const [idDoc, setIdDoc] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Marinero de Cubierta');
  const [vessel, setVessel] = useState('B/M Atlántico Express');
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal camera capture
  const [modalCameraActive, setModalCameraActive] = useState(false);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [modalStream, setModalStream] = useState<MediaStream | null>(null);

  // Ensure stream is properly attached to video element as soon as it mounts
  useEffect(() => {
    if (modalCameraActive && modalStream && modalVideoRef.current) {
      modalVideoRef.current.srcObject = modalStream;
      modalVideoRef.current.play().catch((err) => console.warn('Play error:', err));
    }
  }, [modalCameraActive, modalStream]);

  const handleModalVideoRef = (node: HTMLVideoElement | null) => {
    modalVideoRef.current = node;
    if (node && modalStream) {
      node.srcObject = modalStream;
      node.play().catch(() => {});
    }
  };

  const startModalCamera = async () => {
    try {
      setFormError(null);
      if (!navigator?.mediaDevices?.getUserMedia) {
        setFormError('Cámara no disponible en este dispositivo. Puede subir un archivo de imagen o generar una foto.');
        return;
      }
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
      } catch {
        media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }
      setModalStream(media);
      setModalCameraActive(true);
    } catch (e: any) {
      setFormError('No se pudo acceder a la cámara para la foto de registro');
    }
  };

  const stopModalCamera = () => {
    if (modalStream) {
      modalStream.getTracks().forEach((t) => t.stop());
      setModalStream(null);
    }
    setModalCameraActive(false);
  };

  const takeSnapshot = () => {
    if (!modalVideoRef.current || !modalCanvasRef.current) return;
    const canvas = modalCanvasRef.current;
    const video = modalVideoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhoto(dataUrl);
    stopModalCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedPhoto(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idDoc.trim() || !fullName.trim()) {
      setFormError('Por favor complete la Cédula/ID y el Nombre');
      return;
    }
    if (!capturedPhoto) {
      setFormError('Debe tomar o cargar una foto de referencia para el reconocimiento facial');
      return;
    }

    setIsRegistering(true);
    setFormError(null);

    try {
      const newPerson: Personnel = {
        id: idDoc.trim(),
        name: fullName.trim(),
        role: role.trim() || 'Tripulante',
        vessel: vessel.trim() || 'B/M Atlántico Express',
        isAuthorized,
        photoUrl: capturedPhoto,
        registeredAt: new Date().toISOString().split('T')[0],
      };

      await onAddPersonnel(newPerson);

      // Reset form
      setIdDoc('');
      setFullName('');
      setCapturedPhoto(null);
      setShowAddModal(false);
      stopModalCamera();
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar personal');
    } finally {
      setIsRegistering(false);
    }
  };

  const filtered = personnelList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-blue-400" />
            Base de Datos de Personal Autorizado
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Cada usuario debe estar previamente registrado para que el reconocimiento facial habilite su acceso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sheetConnected && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncAllToSheet}
              className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 font-bold text-sm transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
              Sincronizar con Google Sheets
            </button>
          )}

          {/* BIG ADD BUTTON */}
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setFormError(null);
            }}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3.5 font-black uppercase text-sm tracking-wider shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95"
          >
            <UserPlus className="h-5 w-5" />
            + Registrar Nuevo Personal
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por Nombre, Cédula o Cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="text-xs font-semibold text-slate-400">
          Mostrando {filtered.length} de {personnelList.length} registros
        </div>
      </div>

      {/* Personnel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((person) => (
          <div
            key={person.id}
            className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xl ${
              person.isAuthorized
                ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                : 'bg-red-950/20 border-red-900/40 hover:border-red-800/60'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={person.photoUrl}
                  alt={person.name}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
                />
                <span
                  className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 text-white ${
                    person.isAuthorized ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  title={person.isAuthorized ? 'Autorizado para Ingreso' : 'Acceso Denegado / Bloqueado'}
                >
                  {person.isAuthorized ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-400">{person.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                      person.isAuthorized
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}
                  >
                    {person.isAuthorized ? 'AUTORIZADO' : 'SUSPENDIDO'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white truncate mt-1">{person.name}</h3>
                <p className="text-xs font-semibold text-slate-400">{person.role}</p>

                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <Ship className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{person.vessel}</span>
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onToggleAuthorization(person.id)}
                className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all border ${
                  person.isAuthorized
                    ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {person.isAuthorized ? 'Denegar / Bloquear' : 'Habilitar Acceso'}
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteId(person.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 transition-all"
                title="Eliminar tripulante"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal for Delete (per destructive action safety) */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">¿Eliminar registro de personal?</h3>
            <p className="text-sm text-slate-300 mb-6">
              Esta acción eliminará los datos de referencia biométrica de este tripulante del puesto de control.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  await onDeletePersonnel(id);
                }}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 text-sm"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW PERSONNEL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-slate-700 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-black text-white">Registrar Nuevo Personal</h3>
                <p className="text-xs text-slate-400">Captura de rostro para habilitar reconocimiento facial</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopModalCamera();
                  setShowAddModal(false);
                }}
                className="rounded-lg p-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePersonnel} className="mt-5 flex flex-col gap-4">
              {formError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Photo Capture Section */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 p-4">
                <canvas ref={modalCanvasRef} className="hidden" />

                {modalCameraActive ? (
                  <div className="relative aspect-square w-48 overflow-hidden rounded-2xl border-2 border-blue-500">
                    <video
                      ref={handleModalVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        transform: 'scaleX(-1) translateZ(0)',
                        WebkitBackfaceVisibility: 'hidden',
                        backfaceVisibility: 'hidden',
                        imageRendering: '-webkit-optimize-contrast',
                      }}
                      className="h-full w-full object-contain bg-black"
                    />
                    <div className="absolute inset-0 border-2 border-blue-400/50 rounded-2xl pointer-events-none" />
                  </div>
                ) : capturedPhoto ? (
                  <div className="relative aspect-square w-48 overflow-hidden rounded-2xl border-2 border-emerald-500 shadow-lg">
                    <img src={capturedPhoto} alt="Foto referencia" className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 right-2 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      Foto Lista
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 w-48 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 text-slate-400">
                    <Camera className="h-12 w-12 text-slate-500 mb-2" />
                    <span className="text-xs font-semibold">Sin foto de referencia</span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {modalCameraActive ? (
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 text-xs shadow-md"
                    >
                      <Camera className="h-4 w-4" />
                      Capturar Foto Ahora
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startModalCamera}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 text-xs shadow-md"
                    >
                      <Camera className="h-4 w-4" />
                      {capturedPhoto ? 'Tomar Otra Foto' : 'Usar Cámara Web'}
                    </button>
                  )}

                  <label className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 text-xs cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Subir Imagen
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const sample = createSyntheticPortrait(
                        fullName || 'Tripulante',
                        role || 'Oficial',
                        'm',
                        '#e0ac69',
                        '#374151',
                        false
                      );
                      setCapturedPhoto(sample);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-bold px-4 py-2 text-xs transition-all"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generar Foto Muestra
                  </button>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Cédula / Documento ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1042789123 o TRIP-901"
                    value={idDoc}
                    onChange={(e) => setIdDoc(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Carlos Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Cargo / Función</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Capitán de Navío">Capitán de Navío</option>
                    <option value="Jefe de Máquinas">Jefe de Máquinas</option>
                    <option value="Oficial de Cubierta">Oficial de Cubierta</option>
                    <option value="Marinero de Cubierta">Marinero de Cubierta</option>
                    <option value="Motorista / Electricista">Motorista / Electricista</option>
                    <option value="Inspector Portuario">Inspector Portuario</option>
                    <option value="Oficial de Seguridad PBIP">Oficial de Seguridad PBIP</option>
                    <option value="Contratista Autorizado">Contratista Autorizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Embarcación</label>
                  <input
                    type="text"
                    value={vessel}
                    onChange={(e) => setVessel(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Authorization toggle */}
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">Estado de Autorización</span>
                  <span className="text-xs text-slate-400">
                    {isAuthorized ? 'Permite el acceso a bordo' : 'Acceso restringido (activará alerta roja)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthorized(!isAuthorized)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase border transition-all ${
                    isAuthorized
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                  }`}
                >
                  {isAuthorized ? '✓ Autorizado' : '✕ Bloqueado'}
                </button>
              </div>

              {/* Submit Button */}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopModalCamera();
                    setShowAddModal(false);
                  }}
                  className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase text-sm py-3 shadow-lg shadow-blue-600/30"
                >
                  {isRegistering ? 'Guardando...' : 'Guardar y Habilitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
