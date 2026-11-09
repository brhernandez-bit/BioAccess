import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  LogOut,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { GoogleSheetConfig } from '../types';
import {
  fetchUserSpreadsheets,
  createCentralSpreadsheet,
} from '../services/googleSheets';

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  sheetConfig: GoogleSheetConfig | null;
  onSelectSheetConfig: (config: GoogleSheetConfig) => void;
}

export const SheetSettingsModal: React.FC<SheetSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  sheetConfig,
  onSelectSheetConfig,
}) => {
  const [driveSheets, setDriveSheets] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadDriveSheets();
    }
  }, [isOpen, currentUser]);

  const loadDriveSheets = async () => {
    setIsLoadingSheets(true);
    setErrorMsg(null);
    try {
      const sheets = await fetchUserSpreadsheets();
      setDriveSheets(sheets);
    } catch (err: any) {
      console.warn('Failed to load drive sheets:', err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleCreateNewSheet = async () => {
    setIsCreatingSheet(true);
    setErrorMsg(null);
    try {
      const newConfig = await createCentralSpreadsheet();
      onSelectSheetConfig(newConfig);
      await loadDriveSheets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la hoja en Google Sheets');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSelectExisting = (sheet: { id: string; name: string }) => {
    const config: GoogleSheetConfig = {
      spreadsheetId: sheet.id,
      spreadsheetName: sheet.name,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
      lastSyncAt: new Date().toISOString(),
    };
    onSelectSheetConfig(config);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-slate-700 p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Sincronización con Google Sheet</h3>
              <p className="text-xs text-slate-400">Base de datos centralizada para ingresos y auditoría</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6">
          {errorMsg && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* User Auth Section */}
          <div className="rounded-2xl bg-slate-950 p-5 border border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Cuenta de Google
            </span>

            {currentUser ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Usuario'}
                      className="h-10 w-10 rounded-full border border-emerald-500"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                      {currentUser.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">{currentUser.displayName || 'Usuario Google'}</h4>
                    <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 text-xs font-bold transition-all border border-slate-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <p className="text-sm text-slate-300 mb-4 max-w-sm">
                  Inicie sesión con su cuenta corporativa o de Google para sincronizar los registros de la embarcación con Google Sheets.
                </p>

                {/* Official Material Google Sign-In Button */}
                <button
                  type="button"
                  onClick={onLogin}
                  className="flex items-center gap-3 rounded-xl bg-white text-slate-900 px-6 py-3 font-bold text-sm shadow-xl hover:bg-slate-100 transition-all border border-slate-200"
                >
                  <svg className="h-5 w-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Iniciar sesión con Google</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Spreadsheet Status */}
          {currentUser && (
            <div className="rounded-2xl bg-slate-950 p-5 border border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                Hoja de Cálculo Activa
              </span>

              {sheetConfig ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 p-4">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
                      <div>
                        <h4 className="text-sm font-bold text-white">{sheetConfig.spreadsheetName}</h4>
                        <p className="text-xs text-slate-500 font-mono">ID: {sheetConfig.spreadsheetId}</p>
                      </div>
                    </div>

                    <a
                      href={sheetConfig.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold hover:bg-emerald-600/30 transition-all"
                    >
                      Abrir <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Schema breakdown */}
                  <div className="text-xs text-slate-400 rounded-xl bg-slate-900/60 p-3 border border-slate-800/80">
                    <span className="font-bold text-slate-300 block mb-1">Estructura configurada:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li><strong className="text-slate-300">Registro_Ingresos:</strong> Fecha, Hora, ID Personal, Nombre, Cargo, Resultado, Método</li>
                      <li><strong className="text-slate-300">Log_Auditoria:</strong> Fecha, Hora, Resultado (DENEGADO), Motivo, Detalle de Intento</li>
                      <li><strong className="text-slate-300">Personal_Autorizado:</strong> Cédula, Nombre, Cargo, Embarcación, Estado</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-sm text-slate-400 mb-4">
                    No hay una hoja seleccionada. Puede crear una hoja centralizada automáticamente o vincular una existente.
                  </p>

                  <button
                    type="button"
                    disabled={isCreatingSheet}
                    onClick={handleCreateNewSheet}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {isCreatingSheet ? 'Creando Hoja Central...' : 'Crear Hoja Central Automáticamente'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Existing sheets list in Drive */}
          {currentUser && (
            <div className="rounded-2xl bg-slate-950 p-5 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Hojas en su Google Drive
                </span>
                <button
                  type="button"
                  onClick={loadDriveSheets}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                  Actualizar lista
                </button>
              </div>

              {isLoadingSheets ? (
                <div className="p-4 text-center text-xs text-slate-500">Cargando hojas de Google Drive...</div>
              ) : driveSheets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No se encontraron hojas de cálculo recientes en su Google Drive.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {driveSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 p-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-white truncate">{sheet.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectExisting(sheet)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                          sheetConfig?.spreadsheetId === sheet.id
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sheetConfig?.spreadsheetId === sheet.id ? 'Seleccionada' : 'Seleccionar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2.5 text-xs transition-all"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
