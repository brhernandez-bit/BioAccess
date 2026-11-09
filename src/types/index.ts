export interface Personnel {
  id: string; // Document ID / Cédula
  name: string;
  role: string;
  vessel: string;
  isAuthorized: boolean;
  photoUrl: string; // Data URL or reference image
  registeredAt: string;
}

export interface AccessRecord {
  id: string;
  timestamp: string; // ISO
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm:ss
  personnelId: string;
  name: string;
  role: string;
  vessel: string;
  status: 'AUTORIZADO';
  method: 'Reconocimiento Facial';
  confidence: number;
  syncedToSheet: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string; // ISO
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm:ss
  status: 'DENEGADO';
  reason: string;
  details: string;
  vessel: string;
  checkpoint: string;
  confidence?: number;
  syncedToSheet: boolean;
  capturedSnapshot?: string; // Optional thumbnail
}

export interface BiometricVerificationResult {
  hasFace: boolean;
  matched: boolean;
  candidateId?: string;
  candidateName?: string;
  candidateRole?: string;
  candidateVessel?: string;
  confidence: number;
  isAuthorized: boolean;
  reason: string;
}

export interface GoogleSheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  lastSyncAt: string | null;
}
