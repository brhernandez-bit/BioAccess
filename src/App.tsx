import React, { useState, useEffect } from 'react';
import {
  Ship,
  Scan,
  Users,
  ClipboardList,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Anchor,
  Clock,
  Calendar,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Personnel,
  AccessRecord,
  AuditRecord,
  GoogleSheetConfig,
  BiometricVerificationResult,
} from './types';
import { INITIAL_PERSONNEL } from './data/initialPersonnel';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
} from './services/firebaseAuth';
import {
  appendAccessRecordToSheet,
  appendAuditRecordToSheet,
  syncPersonnelToSheet,
} from './services/googleSheets';
import { CameraView } from './components/CameraView';
import { PersonnelManager } from './components/PersonnelManager';
import { AuditLogView } from './components/AuditLogView';
import { SheetSettingsModal } from './components/SheetSettingsModal';

const LOCAL_STORAGE_PERSONNEL_KEY = 'vessel_access_personnel_v1';
const LOCAL_STORAGE_ACCESS_KEY = 'vessel_access_records_v1';
const LOCAL_STORAGE_AUDIT_KEY = 'vessel_audit_records_v1';
const LOCAL_STORAGE_SHEET_KEY = 'vessel_sheet_config_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'KIOSK' | 'PERSONNEL' | 'AUDIT'>('KIOSK');
  const [vesselName, setVesselName] = useState('B/M Atlántico Express');

  // Database States
  const [personnelList, setPersonnelList] = useState<Personnel[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PERSONNEL_KEY);
      if (saved) {
        const parsed: Personnel[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isValid = parsed.every((p) => typeof p.photoUrl === 'string' && p.photoUrl.length > 50);
          if (isValid) return parsed;
        }
      }
      return INITIAL_PERSONNEL;
    } catch {
      return INITIAL_PERSONNEL;
    }
  });

  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ACCESS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHEET_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth & UI Modal States
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<string | null>(null);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PERSONNEL_KEY, JSON.stringify(personnelList));
  }, [personnelList]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_ACCESS_KEY, JSON.stringify(accessRecords));
  }, [accessRecords]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_AUDIT_KEY, JSON.stringify(auditRecords));
  }, [auditRecords]);

  useEffect(() => {
    if (sheetConfig) {
      localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, JSON.stringify(sheetConfig));
    }
  }, [sheetConfig]);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setSyncStatusBanner('Sesión de Google iniciada. Conectando con Google Sheets...');
        setTimeout(() => setSyncStatusBanner(null), 4000);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const isPopupBlocked = err?.code === 'auth/popup-blocked' || err?.message?.includes('popup');
      setSyncStatusBanner(
        isPopupBlocked
          ? 'Ventana emergente bloqueada por el navegador. Habilite popups para conectar Google Sheets.'
          : `Error de inicio de sesión: ${err.message || 'Intente nuevamente'}`
      );
      setTimeout(() => setSyncStatusBanner(null), 6000);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setSyncStatusBanner('Sesión cerrada.');
    setTimeout(() => setSyncStatusBanner(null), 3000);
  };

  // Helper to format exact date and time
  const getTimestampParts = () => {
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
    return { iso: now.toISOString(), dateStr, timeStr };
  };

  // Automated Entry Registration (Green Alert Action)
  const handleAuthorizedEntry = async (
    person: Personnel,
    result: BiometricVerificationResult
  ) => {
    const { iso, dateStr, timeStr } = getTimestampParts();

    const newRecord: AccessRecord = {
      id: `ACC-${Date.now()}`,
      timestamp: iso,
      dateStr,
      timeStr,
      personnelId: person.id,
      name: person.name,
      role: person.role,
      vessel: person.vessel || vesselName,
      status: 'AUTORIZADO',
      method: 'Reconocimiento Facial',
      confidence: Math.round(result.confidence || 95),
      syncedToSheet: false,
    };

    // Attempt Google Sheet Sync if configured
    if (sheetConfig?.spreadsheetId && googleUser) {
      setIsSyncing(true);
      const ok = await appendAccessRecordToSheet(sheetConfig.spreadsheetId, newRecord);
      newRecord.syncedToSheet = ok;
      setIsSyncing(false);
    }

    setAccessRecords((prev) => [newRecord, ...prev]);
  };

  // Automated Denied Attempt Registration (Red Alert Action)
  const handleDeniedEntry = async (
    reason: string,
    details: string,
    confidence?: number,
    snapshot?: string
  ) => {
    const { iso, dateStr, timeStr } = getTimestampParts();

    const newAudit: AuditRecord = {
      id: `DEN-${Date.now()}`,
      timestamp: iso,
      dateStr,
      timeStr,
      status: 'DENEGADO',
      reason,
      details,
      vessel: vesselName,
      checkpoint: 'Pasarela Principal',
      confidence,
      syncedToSheet: false,
      capturedSnapshot: snapshot,
    };

    // Attempt Google Sheet Sync to Log_Auditoria
    if (sheetConfig?.spreadsheetId && googleUser) {
      setIsSyncing(true);
      const ok = await appendAuditRecordToSheet(sheetConfig.spreadsheetId, newAudit);
      newAudit.syncedToSheet = ok;
      setIsSyncing(false);
    }

    setAuditRecords((prev) => [newAudit, ...prev]);
  };

  // Personnel Management Handlers
  const handleAddPersonnel = async (person: Personnel) => {
    setPersonnelList((prev) => [person, ...prev]);

    // If connected to Google Sheet, sync new personnel list
    if (sheetConfig?.spreadsheetId && googleUser) {
      setIsSyncing(true);
      await syncPersonnelToSheet(sheetConfig.spreadsheetId, [person, ...personnelList]);
      setIsSyncing(false);
    }
  };

  const handleToggleAuthorization = async (id: string) => {
    const updated = personnelList.map((p) =>
      p.id === id ? { ...p, isAuthorized: !p.isAuthorized } : p
    );
    setPersonnelList(updated);

    if (sheetConfig?.spreadsheetId && googleUser) {
      setIsSyncing(true);
      await syncPersonnelToSheet(sheetConfig.spreadsheetId, updated);
      setIsSyncing(false);
    }
  };

  const handleDeletePersonnel = async (id: string) => {
    const updated = personnelList.filter((p) => p.id !== id);
    setPersonnelList(updated);

    if (sheetConfig?.spreadsheetId && googleUser) {
      setIsSyncing(true);
      await syncPersonnelToSheet(sheetConfig.spreadsheetId, updated);
      setIsSyncing(false);
    }
  };

  const handleSyncAllPersonnelToSheet = async () => {
    if (!sheetConfig?.spreadsheetId || !googleUser) return;
    setIsSyncing(true);
    await syncPersonnelToSheet(sheetConfig.spreadsheetId, personnelList);
    setIsSyncing(false);
    setSyncStatusBanner('Lista de personal sincronizada con Google Sheet');
    setTimeout(() => setSyncStatusBanner(null), 3500);
  };

  const handleClearLogs = async () => {
    setAccessRecords([]);
    setAuditRecords([]);
    localStorage.removeItem(LOCAL_STORAGE_ACCESS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_AUDIT_KEY);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Banner Notice (if any) */}
      {syncStatusBanner && (
        <div className="bg-blue-600 px-4 py-2 text-center text-xs font-bold text-white shadow-md flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {syncStatusBanner}
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-700/30 border border-blue-400/30">
              <Anchor className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase text-blue-400">
                  Control Biométrico Marítimo
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Control de Acceso Facial - Embarcación
              </h1>
            </div>
          </div>

          {/* Navigation Tabs - Large Touch-Friendly Buttons */}
          <nav className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('KIOSK')}
              className={`flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'KIOSK'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Scan className="h-4 w-4" />
              Puesto de Control
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PERSONNEL')}
              className={`flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'PERSONNEL'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              Personal ({personnelList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUDIT')}
              className={`flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'AUDIT'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Bitácora & Auditoría
            </button>
          </nav>

          {/* Google Sheets Connection Status Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all border ${
                googleUser && sheetConfig
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Base de Datos</span>
                <span>{googleUser && sheetConfig ? 'Google Sheet Conectado' : 'Vincular Google Sheet'}</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'KIOSK' && (
          <CameraView
            personnelList={personnelList}
            vesselName={vesselName}
            onAuthorizedEntry={handleAuthorizedEntry}
            onDeniedEntry={handleDeniedEntry}
            isSyncingSheet={isSyncing}
            sheetConnected={!!(googleUser && sheetConfig)}
          />
        )}

        {activeTab === 'PERSONNEL' && (
          <PersonnelManager
            personnelList={personnelList}
            onAddPersonnel={handleAddPersonnel}
            onToggleAuthorization={handleToggleAuthorization}
            onDeletePersonnel={handleDeletePersonnel}
            onSyncAllToSheet={handleSyncAllPersonnelToSheet}
            isSyncing={isSyncing}
            sheetConnected={!!(googleUser && sheetConfig)}
          />
        )}

        {activeTab === 'AUDIT' && (
          <AuditLogView
            accessRecords={accessRecords}
            auditRecords={auditRecords}
            sheetConfig={sheetConfig}
            onClearLogs={handleClearLogs}
          />
        )}
      </main>

      {/* Google Sheet Setup & Sync Modal */}
      <SheetSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={googleUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        sheetConfig={sheetConfig}
        onSelectSheetConfig={(cfg) => {
          setSheetConfig(cfg);
          setShowSettingsModal(false);
          setSyncStatusBanner(`Hoja conectada: "${cfg.spreadsheetName}"`);
          setTimeout(() => setSyncStatusBanner(null), 3500);
        }}
      />
    </div>
  );
}
