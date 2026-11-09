import { AccessRecord, AuditRecord, Personnel, GoogleSheetConfig } from '../types';
import { getAccessToken } from './firebaseAuth';

const SPREADSHEET_TITLE = 'Control de Ingreso Embarcación - Base de Datos Central';

export async function fetchUserSpreadsheets(): Promise<Array<{ id: string; name: string }>> {
  const token = await getAccessToken();
  if (!token) throw new Error('No hay sesión activa con Google');

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Drive files error:', errorText);
    throw new Error('Error al buscar hojas de cálculo en Google Drive');
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
  }));
}

export async function createCentralSpreadsheet(): Promise<GoogleSheetConfig> {
  const token = await getAccessToken();
  if (!token) throw new Error('No hay sesión activa con Google');

  const requestBody = {
    properties: {
      title: SPREADSHEET_TITLE,
    },
    sheets: [
      {
        properties: {
          title: 'Registro_Ingresos',
          gridProperties: { rowCount: 1000, columnCount: 10 },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Fecha' } },
                  { userEnteredValue: { stringValue: 'Hora' } },
                  { userEnteredValue: { stringValue: 'ID Personal' } },
                  { userEnteredValue: { stringValue: 'Nombre Completo' } },
                  { userEnteredValue: { stringValue: 'Cargo' } },
                  { userEnteredValue: { stringValue: 'Embarcación' } },
                  { userEnteredValue: { stringValue: 'Resultado' } },
                  { userEnteredValue: { stringValue: 'Método' } },
                  { userEnteredValue: { stringValue: 'Confianza (%)' } },
                  { userEnteredValue: { stringValue: 'Timestamp ISO' } },
                ],
              },
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Log_Auditoria',
          gridProperties: { rowCount: 1000, columnCount: 8 },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Fecha' } },
                  { userEnteredValue: { stringValue: 'Hora' } },
                  { userEnteredValue: { stringValue: 'Resultado' } },
                  { userEnteredValue: { stringValue: 'Motivo' } },
                  { userEnteredValue: { stringValue: 'Detalle de Intento' } },
                  { userEnteredValue: { stringValue: 'Embarcación' } },
                  { userEnteredValue: { stringValue: 'Puesto de Control' } },
                  { userEnteredValue: { stringValue: 'Timestamp ISO' } },
                ],
              },
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Personal_Autorizado',
          gridProperties: { rowCount: 200, columnCount: 7 },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'ID / Cédula' } },
                  { userEnteredValue: { stringValue: 'Nombre Completo' } },
                  { userEnteredValue: { stringValue: 'Cargo' } },
                  { userEnteredValue: { stringValue: 'Embarcación' } },
                  { userEnteredValue: { stringValue: 'Estado' } },
                  { userEnteredValue: { stringValue: 'Fecha Registro' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Error creating spreadsheet:', err);
    throw new Error('No se pudo crear la hoja de cálculo en Google Sheets');
  }

  const data = await res.json();
  const config: GoogleSheetConfig = {
    spreadsheetId: data.spreadsheetId,
    spreadsheetName: data.properties.title,
    spreadsheetUrl: data.spreadsheetUrl,
    lastSyncAt: new Date().toISOString(),
  };

  return config;
}

export async function appendAccessRecordToSheet(
  spreadsheetId: string,
  record: AccessRecord
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const range = 'Registro_Ingresos!A:J';
  const values = [
    [
      record.dateStr,
      record.timeStr,
      record.personnelId,
      record.name,
      record.role,
      record.vessel,
      record.status,
      record.method,
      record.confidence,
      record.timestamp,
    ],
  ];

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error('Failed to append access record to Google Sheets:', err);
    return false;
  }
}

export async function appendAuditRecordToSheet(
  spreadsheetId: string,
  record: AuditRecord
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const range = 'Log_Auditoria!A:H';
  const values = [
    [
      record.dateStr,
      record.timeStr,
      record.status,
      record.reason,
      record.details,
      record.vessel,
      record.checkpoint,
      record.timestamp,
    ],
  ];

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error('Failed to append audit record to Google Sheets:', err);
    return false;
  }
}

export async function syncPersonnelToSheet(
  spreadsheetId: string,
  personnelList: Personnel[]
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const range = 'Personal_Autorizado!A2:F';
  const values = personnelList.map((p) => [
    p.id,
    p.name,
    p.role,
    p.vessel,
    p.isAuthorized ? 'AUTORIZADO' : 'SUSPENDIDO',
    p.registeredAt || new Date().toISOString().split('T')[0],
  ]);

  try {
    // Clear and write fresh rows
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error('Failed to sync personnel to Google Sheets:', err);
    return false;
  }
}
