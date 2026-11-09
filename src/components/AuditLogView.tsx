import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Calendar,
  Clock,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Ship,
  Sparkles,
} from 'lucide-react';
import { AccessRecord, AuditRecord, GoogleSheetConfig } from '../types';

interface AuditLogViewProps {
  accessRecords: AccessRecord[];
  auditRecords: AuditRecord[];
  sheetConfig: GoogleSheetConfig | null;
  onClearLogs: () => Promise<void>;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  accessRecords,
  auditRecords,
  sheetConfig,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'INGRESOS' | 'AUDITORIA'>('INGRESOS');
  const [search, setSearch] = useState('');

  const filteredAccess = accessRecords.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.personnelId.toLowerCase().includes(search.toLowerCase()) ||
      r.role.toLowerCase().includes(search.toLowerCase()) ||
      r.dateStr.includes(search) ||
      r.timeStr.includes(search)
  );

  const filteredAudit = auditRecords.filter(
    (r) =>
      r.reason.toLowerCase().includes(search.toLowerCase()) ||
      r.details.toLowerCase().includes(search.toLowerCase()) ||
      r.dateStr.includes(search) ||
      r.timeStr.includes(search)
  );

  const downloadCSV = () => {
    let csv = '';
    if (activeTab === 'INGRESOS') {
      csv = 'Fecha,Hora,ID Personal,Nombre,Cargo,Embarcacion,Resultado,Metodo\n';
      accessRecords.forEach((r) => {
        csv += `"${r.dateStr}","${r.timeStr}","${r.personnelId}","${r.name}","${r.role}","${r.vessel}","${r.status}","${r.method}"\n`;
      });
    } else {
      csv = 'Fecha,Hora,Resultado,Motivo,Detalles,Embarcacion\n';
      auditRecords.forEach((r) => {
        csv += `"${r.dateStr}","${r.timeStr}","${r.status}","${r.reason}","${r.details}","${r.vessel}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.toLowerCase()}_embarcacion_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
              Ingresos Autorizados
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{accessRecords.length}</span>
            <span className="text-xs font-semibold text-slate-400">registros con fecha y hora</span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-red-400">
              Intentos Denegados (Auditoría)
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{auditRecords.length}</span>
            <span className="text-xs font-semibold text-slate-400">alertas rojas registradas</span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-blue-400">
              Google Sheet Central
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            {sheetConfig ? (
              <a
                href={sheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:text-blue-300 underline"
              >
                Abrir en Google Drive <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs text-slate-400">No vinculado a Sheet aún</span>
            )}
            <p className="text-[11px] text-slate-500 mt-1">Sincronización en tiempo real</p>
          </div>
        </div>
      </div>

      {/* Tabs and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl">
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('INGRESOS')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'INGRESOS'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Registro de Ingresos ({accessRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUDITORIA')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'AUDITORIA'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <XCircle className="h-4 w-4" />
            Log de Auditoría ({auditRecords.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadCSV}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 text-xs font-bold transition-all"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            className="rounded-xl bg-slate-800/80 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 px-3 py-2.5 text-xs font-semibold transition-all"
          >
            Limpiar Vista
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder={`Buscar en ${activeTab === 'INGRESOS' ? 'ingresos autorizados' : 'auditoría de intentos'}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Records Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        {activeTab === 'INGRESOS' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Hora</th>
                  <th className="px-6 py-4">ID / Cédula</th>
                  <th className="px-6 py-4">Nombre Completo</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">Embarcación</th>
                  <th className="px-6 py-4">Resultado</th>
                  <th className="px-6 py-4">Sincronización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredAccess.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No hay registros de ingreso aún. Realice un escaneo en la pantalla de cámara.
                    </td>
                  </tr>
                ) : (
                  filteredAccess.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-bold text-white">
                          <Calendar className="h-3.5 w-3.5 text-blue-400" />
                          {record.dateStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-400">
                          <Clock className="h-3.5 w-3.5" />
                          {record.timeStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-blue-300 font-bold whitespace-nowrap">
                        {record.personnelId}
                      </td>
                      <td className="px-6 py-4 font-bold text-white whitespace-nowrap">{record.name}</td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{record.role}</td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{record.vessel}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            record.syncedToSheet ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              record.syncedToSheet ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {record.syncedToSheet ? 'En Google Sheet' : 'Local'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Hora</th>
                  <th className="px-6 py-4">Resultado</th>
                  <th className="px-6 py-4">Motivo de Rechazo</th>
                  <th className="px-6 py-4">Detalle del Intento</th>
                  <th className="px-6 py-4">Puesto</th>
                  <th className="px-6 py-4">Sincronización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No hay intentos denegados registrados en el log de auditoría.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-bold text-white">
                          <Calendar className="h-3.5 w-3.5 text-blue-400" />
                          {record.dateStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono font-bold text-red-400">
                          <Clock className="h-3.5 w-3.5" />
                          {record.timeStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                          <XCircle className="h-3.5 w-3.5" />
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-red-200 whitespace-nowrap">{record.reason}</td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">{record.details}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">{record.checkpoint}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            record.syncedToSheet ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              record.syncedToSheet ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {record.syncedToSheet ? 'En Google Sheet' : 'Local'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
