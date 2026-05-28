import { useEffect, useState } from 'react';
import {
  Dice5, Users2, Sparkles, Shuffle, Scale, RefreshCw, History, X,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, SectionHeader, Button, Spinner, ErrorBanner, Empty,
  Select,
} from '../components/UI';

export default function ClassTools() {
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [tab, setTab] = useState('recitation');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { sections } = await api.listSections();
        setSections(sections);
        if (sections[0]) setActiveSection(sections[0]);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  if (sections.length === 0) {
    return (
      <Empty
        title="No sections assigned"
        sub="You don't have any sections yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Class tools · ${activeSection?.code}`}
        title="Recitation & groups"
        sub="Pick a student to recite or split the class into groups."
        action={
          sections.length > 1 && (
            <Select
              value={activeSection?.id || ''}
              onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
              className="!w-auto"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </Select>
          )
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      <div className="flex gap-1 p-1 rounded-full inline-flex border w-fit" style={{ borderColor: 'var(--rule)', background: 'var(--cream)' }}>
        {[
          { id: 'recitation', label: 'Recitation picker', icon: Dice5 },
          { id: 'groups',     label: 'Group generator',  icon: Users2 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all"
            style={{
              background: tab === t.id ? 'var(--ink)' : 'transparent',
              color: tab === t.id ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeSection && tab === 'recitation' && <Recitation section={activeSection} />}
      {activeSection && tab === 'groups' && <Groups section={activeSection} />}
    </div>
  );
}

function Recitation({ section }) {
  const [pick, setPick] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('fair');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [animating, setAnimating] = useState(false);

  const loadHistory = async () => {
    try {
      const { history } = await api.recitationHistory(section.id);
      setHistory(history);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { setPick(null); loadHistory(); }, [section.id]);

  const draw = async () => {
    setBusy(true); setErr(null); setAnimating(true);
    try {
      // Show animation for ~1 second before reveal
      setTimeout(async () => {
        try {
          const { student } = await api.recitationCall(section.id, mode);
          setPick(student);
          loadHistory();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); setAnimating(false); }
      }, 900);
    } catch (e) { setErr(e.message); setBusy(false); setAnimating(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 p-8 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
              {section.subject}
            </div>
            <h3 className="font-serif text-2xl mt-1">Who's up next?</h3>
          </div>
          <div className="flex gap-1 p-1 rounded-full border text-xs" style={{ borderColor: 'var(--rule)' }}>
            <button
              onClick={() => setMode('fair')}
              className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
              style={{
                background: mode === 'fair' ? 'var(--ink)' : 'transparent',
                color: mode === 'fair' ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              <Scale size={12} /> Fair
            </button>
            <button
              onClick={() => setMode('random')}
              className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
              style={{
                background: mode === 'random' ? 'var(--ink)' : 'transparent',
                color: mode === 'random' ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              <Shuffle size={12} /> Random
            </button>
          </div>
        </div>

        {err && <div className="mb-4"><ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner></div>}

        <div
          className="rounded-2xl p-10 text-center min-h-[300px] grid place-items-center"
          style={{ background: 'var(--cream)' }}
        >
          {animating ? (
            <div className="space-y-3">
              <div
                className="font-serif text-5xl animate-pulse"
                style={{ color: 'var(--accent)' }}
              >
                <Sparkles size={48} className="inline-block animate-spin-slow" />
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Picking a student…
              </p>
            </div>
          ) : pick ? (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
                Called for recitation
              </div>
              <div className="font-serif text-5xl lg:text-6xl leading-tight">
                {pick.name}
              </div>
              <div className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                {pick.student_number}
              </div>
              {pick.previous_calls > 0 && (
                <Pill tone="muted">Called {pick.previous_calls}× before</Pill>
              )}
            </div>
          ) : (
            <div className="space-y-3" style={{ color: 'var(--muted)' }}>
              <Dice5 size={42} className="mx-auto opacity-50" />
              <div className="text-sm">Click <strong>Pick a student</strong> to begin.</div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="accent" loading={busy} onClick={draw} className="flex-1">
            <Dice5 size={14} /> {pick ? 'Pick another' : 'Pick a student'}
          </Button>
          {pick && (
            <Button variant="ghost" onClick={() => setPick(null)}>
              Clear
            </Button>
          )}
        </div>

        <div className="text-xs mt-3 text-center" style={{ color: 'var(--muted)' }}>
          {mode === 'fair' ? (
            <>Fair mode prefers students who haven't been called yet this term.</>
          ) : (
            <>Random mode picks uniformly — anyone can be picked again.</>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <History size={14} style={{ color: 'var(--muted)' }} />
          <h4 className="font-serif text-lg">Recent calls</h4>
        </div>
        <div className="space-y-1 max-h-[450px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
              No calls yet.
            </div>
          ) : (
            history.map(h => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2 px-2 rounded text-sm border-b"
                style={{ borderColor: 'var(--rule)' }}
              >
                <div>
                  <div className="font-medium text-sm">{h.name}</div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                    {h.student_number}
                  </div>
                </div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {new Date(h.called_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function Groups({ section }) {
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState('random');
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const { groups } = await api.generateGroups(section.id, groupCount, mode);
      setGroups(groups);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Auto-generate on mount and when section changes
  useEffect(() => { setGroups(null); }, [section.id]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Number of groups
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupCount(Math.max(2, groupCount - 1))}
                className="w-9 h-9 rounded-full border grid place-items-center"
                style={{ borderColor: 'var(--rule)' }}
              >–</button>
              <div className="font-serif text-3xl tabular-nums w-12 text-center">
                {groupCount}
              </div>
              <button
                onClick={() => setGroupCount(Math.min(20, groupCount + 1))}
                className="w-9 h-9 rounded-full border grid place-items-center"
                style={{ borderColor: 'var(--rule)' }}
              >+</button>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Mode
            </div>
            <div className="flex gap-1 p-1 rounded-full border text-sm" style={{ borderColor: 'var(--rule)' }}>
              <button
                onClick={() => setMode('random')}
                className="px-4 py-2 rounded-full flex items-center gap-1.5"
                style={{
                  background: mode === 'random' ? 'var(--ink)' : 'transparent',
                  color: mode === 'random' ? 'var(--paper)' : 'var(--ink)',
                }}
              >
                <Shuffle size={13} /> Random
              </button>
              <button
                onClick={() => setMode('balanced')}
                className="px-4 py-2 rounded-full flex items-center gap-1.5"
                style={{
                  background: mode === 'balanced' ? 'var(--ink)' : 'transparent',
                  color: mode === 'balanced' ? 'var(--paper)' : 'var(--ink)',
                }}
              >
                <Scale size={13} /> Performance-balanced
              </button>
            </div>
          </div>

          <Button variant="accent" loading={busy} onClick={generate} className="ml-auto">
            {groups ? <><RefreshCw size={14} /> Regenerate</> : <><Sparkles size={14} /> Generate groups</>}
          </Button>
        </div>

        <div className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
          {mode === 'random'
            ? 'Random mode shuffles students uniformly across groups.'
            : 'Balanced mode distributes high and low performers evenly using a snake-draft based on current averages.'}
        </div>
      </Card>

      {err && <ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner>}

      {groups && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-serif text-xl">{g.name}</h4>
                {g.avg != null && (
                  <Pill tone={g.avg >= 85 ? 'ok' : g.avg >= 75 ? 'warn' : 'bad'}>
                    avg {g.avg}
                  </Pill>
                )}
              </div>
              <div className="space-y-2">
                {g.members.map((m, j) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold"
                      style={{ background: 'var(--cream)' }}
                    >
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{m.name}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                        {m.student_number}
                      </div>
                    </div>
                    {m.average != null && (
                      <div className="text-xs font-mono tabular-nums" style={{ color: 'var(--muted)' }}>
                        {Math.round(m.average)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!groups && !busy && (
        <Card className="p-12 text-center">
          <Users2 size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No groups yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Pick the number of groups and the mode, then click <strong>Generate groups</strong>.
          </p>
        </Card>
      )}
    </div>
  );
}
