import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, A11yProvider, useAuth } from './context/AppContext';

import Shell from './components/Shell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Scanner from './pages/Scanner';
import Sections from './pages/Sections';
import Users from './pages/Users';
import Excuses from './pages/Excuses';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Gradebook from './pages/Gradebook';
import ClassTools from './pages/ClassTools';
import AttendanceGrid from './pages/AttendanceGrid';
import MyAttendance from './pages/MyAttendance';
import MyTasks from './pages/MyTasks';
import MyTaskDetail from './pages/MyTaskDetail';
import Submissions from './pages/Submissions';
import QuizEditor from './pages/QuizEditor';
import QuizReview from './pages/QuizReview';
import TakeQuiz from './pages/TakeQuiz';
import QuizResults from './pages/QuizResults';
import AtRisk from './pages/AtRisk';
import Ranking from './pages/Ranking';
import QrCodes from './pages/QrCodes';
import Semesters from './pages/Semesters';
import NotFound from './pages/NotFound';

function RequireAuth({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin')   return <AdminDashboard />;
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <A11yProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

          <Route path="/" element={<Landing />} />

          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scanner" element={<RequireAuth roles={['teacher', 'admin']}><Scanner /></RequireAuth>} />
            <Route path="/sections" element={<RequireAuth roles={['teacher', 'admin']}><Sections /></RequireAuth>} />
            <Route path="/gradebook" element={<RequireAuth roles={['teacher', 'admin']}><Gradebook /></RequireAuth>} />
                        <Route path="/gradebook/:itemId/submissions" element={<RequireAuth roles={['teacher', 'admin']}><Submissions /></RequireAuth>} />
            <Route path="/gradebook/:itemId/quiz-editor" element={<RequireAuth roles={['teacher', 'admin']}><QuizEditor /></RequireAuth>} />
            <Route path="/gradebook/:itemId/quiz-review" element={<RequireAuth roles={['teacher', 'admin']}><QuizReview /></RequireAuth>} />
            <Route path="/my-tasks/:itemId/take" element={<RequireAuth roles={['student']}><TakeQuiz /></RequireAuth>} />
            <Route path="/my-tasks/:itemId/results" element={<RequireAuth roles={['student']}><QuizResults /></RequireAuth>} />
            <Route path="/class-tools" element={<RequireAuth roles={['teacher', 'admin']}><ClassTools /></RequireAuth>} />
            <Route path="/attendance-grid" element={<RequireAuth roles={['teacher', 'admin']}><AttendanceGrid /></RequireAuth>} />
            <Route path="/my-attendance" element={<RequireAuth roles={['student']}><MyAttendance /></RequireAuth>} />
            <Route path="/my-tasks" element={<RequireAuth roles={['student']}><MyTasks /></RequireAuth>} />
            <Route path="/my-tasks/:itemId" element={<RequireAuth roles={['student']}><MyTaskDetail /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth roles={['admin']}><Users /></RequireAuth>} />
            <Route path="/excuses" element={<Excuses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/analytics" element={<RequireAuth roles={['teacher', 'admin']}><Analytics /></RequireAuth>} />
            <Route path="/at-risk" element={<RequireAuth roles={['teacher', 'admin']}><AtRisk /></RequireAuth>} />
            <Route path="/ranking" element={<RequireAuth roles={['teacher', 'admin']}><Ranking /></RequireAuth>} />
            <Route path="/qr-codes" element={<RequireAuth roles={['admin']}><QrCodes /></RequireAuth>} />
            <Route path="/semesters" element={<RequireAuth roles={['admin']}><Semesters /></RequireAuth>} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </A11yProvider>
  );
}

// Wrap nested routes inside Shell
function AppShell() {
  return <Shell><Outlet /></Shell>;
}
