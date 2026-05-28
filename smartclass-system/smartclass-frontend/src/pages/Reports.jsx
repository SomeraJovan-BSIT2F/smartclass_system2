import { useEffect, useState } from 'react';
import { Download, FileText, BarChart3, TrendingUp, Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card, SectionHeader, Button, Spinner, ErrorBanner,
} from '../components/UI';
import { useAuth } from '../context/AppContext';

export default function Reports() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (user?.role === 'student') { setLoading(false); return; }
    (async () => {
      try {
        const { sections } = await api.listSections();
        setSections(sections);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const downloadAttendance = async (section) => {
    setDownloading(section.id);
    try {
      await api.downloadPdf(
        api.attendancePdfUrl(section.id),
        `attendance-${section.code}.pdf`
      );
    } catch (e) { setError(e.message); }
    finally { setDownloading(null); }
  };

  const downloadMyReport = async () => {
    setDownloading('me');
    try {
      await api.downloadPdf(api.myPerformancePdfUrl(), 'my-performance.pdf');
    } catch (e) { setError(e.message); }
    finally { setDownloading(null); }
  };

  if (loading) return <div className="grid place-items-center h-96"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <SectionHeader
                title="Generated documents"
        sub="Download PDF reports."
      />

      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

      {user?.role === 'student' ? (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-16 rounded grid place-items-center text-[10px] font-bold" style={{ background: 'var(--cream)' }}>PDF</div>
            <div className="flex-1">
              <div className="font-serif text-xl">My Performance Report</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                Attendance summary + grades across all subjects this term.
              </div>
            </div>
            <Button
              variant="accent"
              loading={downloading === 'me'}
              onClick={downloadMyReport}
            >
              <Download size={14} /> Download
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {user?.role === 'admin' && (
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-16 rounded grid place-items-center text-[10px] font-bold" style={{ background: 'var(--cream)' }}>PDF</div>
                <div className="flex-1">
                  <div className="font-serif text-xl">Institution-wide Report</div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    Aggregated attendance, sections, and at-risk students across the entire school.
                  </div>
                </div>
                <Button
                  variant="accent"
                  loading={downloading === 'institution'}
                  onClick={async () => {
                    setDownloading('institution');
                    try {
                      await api.downloadPdf(api.institutionPdfUrl(), 'institution-report.pdf');
                    } catch (e) { setError(e.message); }
                    finally { setDownloading(null); }
                  }}
                >
                  <Download size={14} aria-hidden="true" /> Download
                </Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { t: 'Attendance summary', d: 'Daily, weekly, or monthly', icon: FileText },
              { t: 'Performance report', d: 'Grades, quizzes, participation', icon: BarChart3 },
              { t: 'Class analytics', d: 'Trends and comparisons', icon: TrendingUp },
            ].map((c) => (
              <Card key={c.t} className="p-5 hover:shadow-sm transition">
                <c.icon size={20} style={{ color: 'var(--accent)' }} aria-hidden="true" />
                <div className="font-serif text-xl mt-3">{c.t}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{c.d}</div>
              </Card>
            ))}
          </div>

          <Card className="p-6">
            <h3 className="font-serif text-2xl mb-4">Attendance reports per section</h3>
            {sections.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>
                No sections available.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
                {sections.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    <div
                      className="w-10 h-12 rounded grid place-items-center text-[9px] font-bold"
                      style={{ background: 'var(--cream)' }}
                    >
                      PDF
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.code} — {s.subject}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {s.student_count} students · {s.teacher_name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      loading={downloading === s.id}
                      onClick={() => downloadAttendance(s)}
                    >
                      <Download size={14} /> Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
