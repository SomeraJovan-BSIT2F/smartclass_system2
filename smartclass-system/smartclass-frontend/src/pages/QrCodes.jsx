import { useEffect, useState, useMemo } from 'react';
import {
  QrCode, Search, RefreshCw, Ban, RotateCcw, AlertTriangle,
  Calendar, Eye, X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner,
  ErrorBanner, SuccessBanner, Input, Select,
} from '../components/UI';

export default function QrCodes() {
  const [data, setData] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [filter, setFilter] = useState({ status: '', semesterId: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.listAllQrs(filter);
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.listSemesters().then(r => setSemesters(r.semesters)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filter.status, filter.semesterId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [filter.q]);

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === data?.qrCodes?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.qrCodes.map(q => q.id)));
    }
  };

  const revokeOne = async (qr) => {
    if (!confirm(`Revoke QR for ${qr.student_name}? They won't be able to scan in until a new QR is issued.`)) return;
    try {
      await api.revokeQr(qr.id);
      setInfo(`Revoked QR for ${qr.student_name}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const restoreOne = async (qr) => {
    try {
      await api.restoreQr(qr.id);
      setInfo(`Restored QR for ${qr.student_name}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const rotateOne = async (qr) => {
    if (!confirm(`Issue a new QR for ${qr.student_name}? The old one will be revoked.`)) return;
    try {
      await api.issueQr(qr.student_id, qr.semester_id);
      setInfo(`New QR issued for ${qr.student_name}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const bulkRevoke = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Revoke ${selectedIds.size} selected QR code${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone except by manual restoration.`)) return;
    try {
      const r = await api.bulkRevokeQrs({ qrIds: [...selectedIds] });
      setInfo(`Revoked ${r.revoked} QR codes.`);
      setSelectedIds(new Set());
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading && !data) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title="QR code management"
        sub="Manage student QR codes."
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      {info && <SuccessBanner onClose={() => setInfo(null)}>{info}</SuccessBanner>}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total QRs"  value={data?.summary?.total || 0}   icon={QrCode} />
        <StatCard label="Active"     value={data?.summary?.active || 0}  icon={QrCode} tone="ok" />
        <StatCard label="Expired"    value={data?.summary?.expired || 0} icon={Calendar} tone="warn" />
        <StatCard label="Revoked"    value={data?.summary?.revoked || 0} icon={Ban} tone="bad" />
      </div>

      {/* Filters + bulk actions bar */}
      <Card className="p-4">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Search by name, number, email…"
            value={filter.q}
            onChange={(e) => setFilter(f => ({ ...f, q: e.target.value }))}
            className="!w-64"
            aria-label="Search QR codes"
          />
          <Select
            value={filter.status}
            onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
            className="!w-auto"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active only</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Select
            value={filter.semesterId}
            onChange={(e) => setFilter(f => ({ ...f, semesterId: e.target.value }))}
            className="!w-auto"
            aria-label="Filter by semester"
          >
            <option value="">All semesters</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>

          {selectedIds.size > 0 && (
            <div className="ml-auto flex gap-2 items-center">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {selectedIds.size} selected
              </span>
              <Button variant="danger" onClick={bulkRevoke}>
                <Ban size={14} /> Revoke selected
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      {!data?.qrCodes || data.qrCodes.length === 0 ? (
        <Card className="p-12 text-center">
          <QrCode size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No QR codes found</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            {filter.q || filter.status || filter.semesterId
              ? 'Try adjusting your filters.'
              : 'Issue QR codes from the Sections page to get started.'}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--cream)' }}>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.qrCodes.length}
                      onChange={selectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Student</th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Semester</th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Status</th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Issued</th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Expires</th>
                  <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Scans</th>
                  <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.qrCodes.map(qr => {
                  const isExpired = new Date(qr.expires_at) < new Date();
                  const status = qr.revoked ? 'revoked' : isExpired ? 'expired' : 'active';
                  const tone = status === 'active' ? 'ok' : status === 'expired' ? 'warn' : 'bad';
                  return (
                    <tr key={qr.id} className="border-b hover:bg-stone-50/50" style={{ borderColor: 'var(--rule)' }}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(qr.id)}
                          onChange={() => toggleSelect(qr.id)}
                          aria-label={`Select QR for ${qr.student_name}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{qr.student_name}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                          {qr.student_number}
                        </div>
                      </td>
                      <td className="p-3 text-xs" style={{ color: 'var(--muted)' }}>
                        {qr.semester_label}
                      </td>
                      <td className="p-3"><Pill tone={tone}>{status}</Pill></td>
                      <td className="p-3 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                        {new Date(qr.issued_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                        {new Date(qr.expires_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 tabular-nums">{qr.scan_count}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {!isExpired && (
                            <button
                              onClick={() => rotateOne(qr)}
                              className="p-1.5 rounded hover:bg-stone-100"
                              aria-label={`Issue new QR for ${qr.student_name}`}
                              title="Issue new QR"
                            >
                              <RefreshCw size={14} style={{ color: 'var(--accent)' }} />
                            </button>
                          )}
                          {qr.revoked && !isExpired ? (
                            <button
                              onClick={() => restoreOne(qr)}
                              className="p-1.5 rounded hover:bg-stone-100"
                              aria-label={`Restore QR for ${qr.student_name}`}
                              title="Restore"
                            >
                              <RotateCcw size={14} style={{ color: 'var(--ok)' }} />
                            </button>
                          ) : !qr.revoked && (
                            <button
                              onClick={() => revokeOne(qr)}
                              className="p-1.5 rounded hover:bg-stone-100"
                              aria-label={`Revoke QR for ${qr.student_name}`}
                              title="Revoke"
                            >
                              <Ban size={14} style={{ color: 'var(--bad)' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
