import { useEffect, useState } from 'react';
import { Trophy, Award, Medal, Download, Crown } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, Pill, StatCard, SectionHeader, Button, Spinner, ErrorBanner, Empty,
  Select,
} from '../components/UI';

export default function Ranking() {
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('top10');
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

  useEffect(() => {
    if (!activeSection) return;
    (async () => {
      try {
        setData(await api.classRanking(activeSection.id));
      } catch (e) { setError(e.message); }
    })();
  }, [activeSection]);

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  if (sections.length === 0) {
    return (
      <Empty
        title="No sections assigned"
        sub="No graded sections yet."
      />
    );
  }

  const ranked = data?.ranking || [];
  const display = view === 'top10' ? ranked.slice(0, 10) : ranked;
  const ungraded = ranked.filter(r => r.average == null);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Class ranking · ${activeSection?.code}`}
        title="Performance leaderboard"
        sub="Students ranked by their average score."
        action={
          <div className="flex gap-2">
            {sections.length > 1 && (
              <Select
                value={activeSection?.id || ''}
                onChange={(e) => setActiveSection(sections.find(s => s.id == e.target.value))}
                className="!w-auto"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </Select>
            )}
            {activeSection && (
              <Button
                variant="ghost"
                onClick={() =>
                  api.downloadPdf(
                    api.attendancePdfUrl(activeSection.id),
                    `ranking-${activeSection.code}.pdf`
                  )
                }
              >
                <Download size={14} /> Export PDF
              </Button>
            )}
          </div>
        }
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      {/* Class statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Class average"
          value={data?.stats?.mean ?? '—'}
          icon={Award}
        />
        <StatCard
          label="Median"
          value={data?.stats?.median ?? '—'}
          icon={Trophy}
        />
        <StatCard
          label="Highest"
          value={data?.stats?.highest ?? '—'}
          icon={Crown}
        />
        <StatCard
          label="Graded students"
          value={`${data?.stats?.graded || 0}/${data?.stats?.total || 0}`}
          icon={Medal}
        />
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-full border w-fit" style={{ borderColor: 'var(--rule)', background: 'var(--cream)' }}>
        {[
          { id: 'top10', label: 'Top 10' },
          { id: 'all',   label: `All ${ranked.length}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: view === t.id ? 'var(--ink)' : 'transparent',
              color: view === t.id ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Ranking list */}
      {ranked.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No students in this section</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Enroll students first, then post grades to see the ranking.
          </p>
        </Card>
      ) : data?.stats?.graded === 0 ? (
        <Card className="p-12 text-center">
          <Award size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <div className="font-serif text-xl">No grades posted yet</div>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Go to the Gradebook and post some scores. Then ranking will appear here.
          </p>
        </Card>
      ) : (
        <>
          {/* Top 3 podium (only on top10 view, and only if there are 3+ ranked) */}
          {view === 'top10' && display.filter(r => r.rank !== null).length >= 3 && (
            <Card className="p-6 mb-4 relative overflow-hidden">
              <div
                className="absolute -top-12 -right-12 w-64 h-64 rounded-full opacity-30 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, var(--accent), transparent 70%)',
                }}
              />
              <div className="relative grid grid-cols-3 gap-2 md:gap-4">
                {[1, 0, 2].map((idx) => {
                  const r = display[idx];
                  if (!r) return <div key={idx} />;
                  const height = idx === 0 ? 'h-32' : idx === 1 ? 'h-24' : 'h-20';
                  return (
                    <div key={r.id} className="flex flex-col items-center">
                      <div
                        className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full grid place-items-center font-serif text-xl md:text-2xl shrink-0 ${idx === 0 ? 'ring-4' : ''}`}
                        style={{
                          background: idx === 0 ? 'var(--accent)' : idx === 1 ? '#9CA3AF' : '#A8825C',
                          color: '#fff',
                          ringColor: 'var(--accent)',
                        }}
                      >
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        {idx === 0 && (
                          <Crown
                            size={20}
                            className="absolute -top-2 left-1/2 -translate-x-1/2"
                            style={{ color: 'var(--accent)' }}
                            fill="var(--accent)"
                          />
                        )}
                      </div>
                      <div className="text-center mt-2 md:mt-3">
                        <div className="font-serif text-sm md:text-base font-medium truncate max-w-[120px]">
                          {r.name}
                        </div>
                        <div className="font-serif text-2xl md:text-3xl mt-1">
                          {r.average}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--muted)' }}>
                          Rank #{r.rank}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Full table */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--cream)' }}>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Rank</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Student</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Average</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Attendance</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Items graded</th>
                  </tr>
                </thead>
                <tbody>
                  {display.map((r, i) => (
                    <tr
                      key={r.id}
                      className="border-b hover:bg-stone-50/50 transition"
                      style={{ borderColor: 'var(--rule)' }}
                    >
                      <td className="py-3 px-4">
                        {r.rank ? (
                          <div className="flex items-center gap-2">
                            {r.rank === 1 && <Crown size={14} style={{ color: 'var(--accent)' }} />}
                            <span
                              className="font-serif text-lg"
                              style={{ color: r.rank <= 3 ? 'var(--accent)' : 'var(--ink)' }}
                            >
                              #{r.rank}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold"
                            style={{
                              background: r.rank === 1 ? 'var(--accent)' : 'var(--cream)',
                              color: r.rank === 1 ? '#fff' : 'var(--ink)',
                            }}
                          >
                            {r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                              {r.student_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.average != null ? (
                          <span
                            className="font-serif text-xl tabular-nums"
                            style={{
                              color: r.average >= 85 ? 'var(--ok)'
                                : r.average >= 75 ? 'var(--warn)'
                                : 'var(--bad)',
                            }}
                          >
                            {r.average}
                          </span>
                        ) : (
                          <Pill tone="muted">Not graded</Pill>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.attendance_pct != null ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-16 h-1.5 rounded-full overflow-hidden"
                              style={{ background: 'var(--rule)' }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${r.attendance_pct}%`,
                                  background: r.attendance_pct >= 85 ? 'var(--ok)'
                                    : r.attendance_pct >= 75 ? 'var(--warn)'
                                    : 'var(--bad)',
                                }}
                              />
                            </div>
                            <span className="text-xs tabular-nums">{r.attendance_pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
                        {r.items_graded || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Note about ungraded students */}
          {ungraded.length > 0 && (
            <div
              className="p-3 rounded-xl border text-xs"
              style={{ background: 'var(--cream)', borderColor: 'var(--rule)', color: 'var(--muted)' }}
            >
              <strong>{ungraded.length} student{ungraded.length !== 1 ? 's are' : ' is'}</strong> not yet
              ranked because they have no grades posted. They appear at the bottom of the list with a "Not graded" pill.
            </div>
          )}
        </>
      )}
    </div>
  );
}
