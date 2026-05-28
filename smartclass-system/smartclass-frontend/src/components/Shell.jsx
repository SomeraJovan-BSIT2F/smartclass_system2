import { useEffect, useState, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  QrCode, Bell, Search, Menu, X, Eye, Type, Contrast, Keyboard,
  ShieldCheck, LogOut, Sparkles, Home, Camera, BarChart3, FileText,
  Settings, Mail, Users, BookOpen, ChevronRight, AlertTriangle,
  Trophy, CalendarDays, ClipboardList, Shuffle, CheckCircle2,
  Zap, RefreshCcw, Archive,
} from 'lucide-react';
import { useAuth, useA11y, useFocusTrap } from '../context/AppContext';
import { api } from '../lib/api';
import { Card, Pill } from './UI';

const NAV = {
  admin: [
    { to: '/dashboard',      icon: Home,         label: 'Dashboard' },
    { to: '/sections',       icon: BookOpen,     label: 'Sections' },
    { to: '/users',          icon: Users,        label: 'Users' },
    { to: '/qr-codes',       icon: QrCode,       label: 'QR Codes' },
    { to: '/semesters',      icon: Archive,      label: 'Semesters' },
    { to: '/analytics',      icon: BarChart3,    label: 'Analytics' },
    { to: '/at-risk',        icon: AlertTriangle, label: 'At-risk students' },
    { to: '/ranking',        icon: Trophy,       label: 'Class ranking' },
    { to: '/reports',        icon: FileText,     label: 'Reports' },
    { to: '/settings',       icon: Settings,     label: 'Settings' },
  ],
  teacher: [
    { to: '/dashboard',       icon: Home,         label: 'Dashboard' },
    { to: '/scanner',         icon: Camera,       label: 'QR Scanner', badge: 'Live' },
    { to: '/attendance-grid', icon: CalendarDays, label: 'Attendance' },
    { to: '/gradebook',       icon: ClipboardList, label: 'Gradebook' },
    { to: '/class-tools',     icon: Shuffle,      label: 'Class tools' },
    { to: '/analytics',       icon: BarChart3,    label: 'Analytics' },
    { to: '/at-risk',         icon: AlertTriangle, label: 'At-risk students' },
    { to: '/ranking',         icon: Trophy,       label: 'Class ranking' },
    { to: '/sections',        icon: BookOpen,     label: 'My Sections' },
    { to: '/excuses',         icon: Mail,         label: 'Excuse Letters' },
    { to: '/reports',         icon: FileText,     label: 'Reports' },
    { to: '/settings',        icon: Settings,     label: 'Settings' },
  ],
  student: [
    { to: '/dashboard',     icon: Home,         label: 'Dashboard' },
    { to: '/my-tasks',      icon: ClipboardList, label: 'My Tasks' },
    { to: '/my-attendance', icon: CalendarDays, label: 'My Attendance' },
    { to: '/excuses',       icon: Mail,         label: 'Excuse Letter' },
    { to: '/reports',       icon: FileText,     label: 'My Reports' },
    { to: '/settings',      icon: Settings,     label: 'Settings' },
  ],
};

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const { announce } = useA11y();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const lastUnreadRef = useRef(0);

  // Close mobile menu on navigation
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Announce page navigation
  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'home';
    const label = path.replace('-', ' ');
    announce(`Navigated to ${label}`);
  }, [location.pathname, announce]);

  // Poll notifications + announce new ones
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { notifications: list, unread } = await api.notifications();
        if (!mounted) return;
        setNotifications(list);
        if (unread > lastUnreadRef.current) {
          const diff = unread - lastUnreadRef.current;
          announce(
            `${diff} new notification${diff !== 1 ? 's' : ''}`,
            'assertive'
          );
        }
        lastUnreadRef.current = unread;
        setUnread(unread);
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [announce]);

  const navItems = NAV[user?.role] || [];

  const onLogout = () => {
    logout();
    announce('Signed out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Skip link — visible on focus */}
      <a href="#main" className="skip-link">Skip to main content</a>

      <TopBar
        user={user}
        unread={unread}
        onMenu={() => setMenuOpen(true)}
        onA11y={() => setA11yOpen(true)}
        onNotif={() => setNotifOpen(true)}
        onLogout={onLogout}
      />

      <div className="mx-auto max-w-[1400px] w-full flex flex-1">
        <SideNav
          items={navItems}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          currentPath={location.pathname}
        />

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 min-w-0 p-4 lg:p-8"
        >
          {children}
        </main>
      </div>

      {a11yOpen && <A11yPanel onClose={() => setA11yOpen(false)} />}
      {notifOpen && (
        <NotifPanel
          onClose={() => setNotifOpen(false)}
          notifications={notifications}
          onMarkAll={async () => {
            await api.markAllRead();
            const { notifications, unread } = await api.notifications();
            setNotifications(notifications);
            setUnread(unread);
            lastUnreadRef.current = unread;
            announce('All notifications marked as read');
          }}
        />
      )}
    </div>
  );
}

function TopBar({ user, unread, onMenu, onA11y, onNotif, onLogout }) {
  const initials = (user?.name || '')
    .split(' ').map(s => s[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        background: 'rgba(250,247,242,0.85)',
        borderColor: 'var(--rule)',
      }}
    >
      <div className="mx-auto max-w-[1400px] px-4 lg:px-8 h-16 flex items-center gap-4">
        <button
          onClick={onMenu}
          className="lg:hidden p-2 -ml-2 rounded"
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="SmartClass QR home">
          <div
            className="w-8 h-8 rounded-md grid place-items-center decorative-element"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            aria-hidden="true"
          >
            <QrCode size={16} />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-[17px] tracking-tight">
              SmartClass <span style={{ color: 'var(--accent)' }}>QR</span>
            </div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2 ml-6 flex-1 max-w-md">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full border"
            style={{ borderColor: 'var(--rule)', background: '#fff' }}>
            <Search size={14} style={{ color: 'var(--muted)' }} aria-hidden="true" />
            <span className="sr-only">Search</span>
            <input
              type="search"
              className="bg-transparent outline-none text-sm flex-1"
              placeholder="Search…"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1.5" role="toolbar" aria-label="Account toolbar">
          <button
            onClick={onA11y}
            className="p-2 rounded-full border hover:bg-white transition"
            style={{ borderColor: 'var(--rule)' }}
            aria-label="Open accessibility settings"
          >
            <Eye size={16} aria-hidden="true" />
          </button>
          <button
            onClick={onNotif}
            className="relative p-2 rounded-full border hover:bg-white transition"
            style={{ borderColor: 'var(--rule)' }}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ', no unread'}`}
          >
            <Bell size={16} aria-hidden="true" />
            {unread > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] grid place-items-center font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}
                aria-hidden="true"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div
            className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l"
            style={{ borderColor: 'var(--rule)' }}
          >
            <div
              className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                {user?.role}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="ml-2 p-2 rounded-full border hover:bg-white transition"
              style={{ borderColor: 'var(--rule)' }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function SideNav({ items, open, onClose, currentPath }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed lg:sticky top-0 lg:top-16 left-0 z-40 lg:z-0
          h-screen lg:h-[calc(100vh-4rem)] w-[260px] shrink-0
          border-r p-4 transition-transform
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--paper)', borderColor: 'var(--rule)' }}
        aria-label="Primary navigation"
      >
        <div className="lg:hidden flex justify-end mb-2">
          <button onClick={onClose} aria-label="Close menu" className="p-1">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          className="text-[10px] uppercase tracking-[0.18em] px-3 mb-3 decorative"
          style={{ color: 'var(--muted)' }}
        >
          Workspace
        </div>

        <nav>
          <ul className="space-y-1 list-none m-0 p-0">
            {items.map((it) => {
              const isActive = currentPath === it.to;
              return (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        isActive ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-[var(--cream)]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <it.icon
                          size={16}
                          aria-hidden="true"
                          style={{ color: isActive ? 'var(--paper)' : 'var(--muted)' }}
                        />
                        <span className="flex-1 text-left">{it.label}</span>
                        {it.badge && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{
                              background: isActive ? 'var(--accent)' : 'var(--cream)',
                              color: isActive ? '#fff' : 'var(--ink)',
                            }}
                          >
                            {it.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

function A11yPanel({ onClose }) {
  const { settings, update, reset, announce } = useA11y();
  const trapRef = useFocusTrap(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-heading"
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        className="relative w-full max-w-md h-full overflow-y-auto p-6 animate-fadeIn"
        style={{ background: 'var(--paper)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
              Settings
            </div>
            <h2 id="a11y-heading" className="font-serif text-2xl mt-1">Accessibility</h2>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="p-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Font size */}
          <fieldset className="border-0 p-0">
            <legend className="flex items-center gap-2 mb-2">
              <Type size={14} style={{ color: 'var(--accent)' }} aria-hidden="true" />
              <span className="text-sm font-medium">Text size</span>
            </legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Text size">
              {[
                { v: 0.9,  label: 'Small'  },
                { v: 1.0,  label: 'Medium' },
                { v: 1.15, label: 'Large'  },
                { v: 1.3,  label: 'Extra large' },
              ].map((opt, i) => (
                <button
                  key={opt.v}
                  onClick={() => { update({ fontScale: opt.v }); announce(`Text size set to ${opt.label}`); }}
                  className="flex-1 py-3 rounded-xl border transition-all"
                  style={{
                    borderColor: settings.fontScale === opt.v ? 'var(--ink)' : 'var(--rule)',
                    background: settings.fontScale === opt.v ? 'var(--ink)' : '#fff',
                    color: settings.fontScale === opt.v ? 'var(--paper)' : 'var(--ink)',
                    fontSize: `${10 + i * 3}px`,
                  }}
                  role="radio"
                  aria-checked={settings.fontScale === opt.v}
                  aria-label={opt.label}
                >
                  A
                </button>
              ))}
            </div>
          </fieldset>

          {/* High contrast */}
          <div>
            <Toggle
              icon={Contrast}
              label="High contrast mode"
              description="Black on white with stronger borders, for low-vision users."
              value={settings.highContrast}
              onChange={(v) => {
                update({ highContrast: v });
                announce(`High contrast ${v ? 'enabled' : 'disabled'}`);
              }}
            />
          </div>

          {/* Reduced motion */}
          <div>
            <Toggle
              icon={Zap}
              label="Reduce motion"
              description="Disables animations and transitions for users sensitive to movement."
              value={settings.reducedMotion}
              onChange={(v) => {
                update({ reducedMotion: v });
                announce(`Reduced motion ${v ? 'enabled' : 'disabled'}`);
              }}
            />
          </div>

          {/* Simple mode */}
          <div>
            <Toggle
              icon={Sparkles}
              label="Simplified interface"
              description="Hides decorative elements, larger buttons and spacing, easier to focus."
              value={settings.simpleMode}
              onChange={(v) => {
                update({ simpleMode: v });
                announce(`Simplified interface ${v ? 'enabled' : 'disabled'}`);
              }}
            />
          </div>

          {/* Keyboard reference */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={14} style={{ color: 'var(--accent)' }} aria-hidden="true" />
              <span className="text-sm font-medium">Keyboard shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Tab',       'Next element'],
                ['Shift+Tab', 'Previous element'],
                ['Enter',     'Activate'],
                ['Space',     'Toggle'],
                ['Esc',       'Close dialog'],
                ['Alt+S',     'Skip to content'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center gap-2 p-2 rounded-lg border"
                  style={{ borderColor: 'var(--rule)', background: '#fff' }}
                >
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--cream)' }}>
                    {k}
                  </kbd>
                  <span style={{ color: 'var(--muted)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => { reset(); announce('Accessibility settings reset to defaults'); }}
            className="w-full p-3 rounded-xl border text-sm flex items-center justify-center gap-2"
            style={{ borderColor: 'var(--rule)' }}
          >
            <RefreshCcw size={14} aria-hidden="true" />
            Reset to defaults
          </button>

          {/* Note */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--cream)' }}>
            <ShieldCheck size={16} style={{ color: 'var(--ok)' }} aria-hidden="true" />
            <div className="text-sm font-medium mt-2">Accessibility</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Keyboard navigation, screen reader support, adjustable text size, and high-contrast mode.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ icon: Icon, label, description, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full p-3 rounded-xl border flex items-start gap-3 text-left transition"
      style={{ borderColor: 'var(--rule)', background: '#fff' }}
      role="switch"
      aria-checked={value}
    >
      <div
        className="w-8 h-8 rounded-full grid place-items-center shrink-0"
        style={{ background: value ? 'var(--ink)' : 'var(--cream)' }}
      >
        <Icon size={14} style={{ color: value ? 'var(--paper)' : 'var(--muted)' }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{description}</div>
      </div>
      <span
        className="w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5"
        style={{ background: value ? 'var(--ink)' : 'var(--rule)' }}
        aria-hidden="true"
      >
        <span
          className="block w-5 h-5 bg-white rounded-full transition-transform"
          style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

function NotifPanel({ onClose, notifications, onMarkAll }) {
  const trapRef = useFocusTrap(true, onClose);

  const tone = (t) => t === 'attendance' ? 'ok' : t === 'excuse' ? 'warn' : t === 'grade' ? 'accent' : 'muted';
  const Icon = (t) => t === 'attendance' ? CheckCircle2 : t === 'excuse' ? AlertTriangle : Bell;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-heading"
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm h-full overflow-y-auto p-6 animate-fadeIn"
        style={{ background: 'var(--paper)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="notif-heading" className="font-serif text-2xl">Notifications</h2>
          <button onClick={onClose} aria-label="Close notifications">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onMarkAll}
            className="text-xs underline mb-4"
            style={{ color: 'var(--accent)' }}
          >
            Mark all as read
          </button>
        )}
        <ul className="space-y-2 list-none m-0 p-0">
          {notifications.length === 0 && (
            <li className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
              No notifications yet.
            </li>
          )}
          {notifications.map((n) => {
            const I = Icon(n.type);
            return (
              <li
                key={n.id}
                className="p-3 rounded-xl border bg-white"
                style={{
                  borderColor: 'var(--rule)',
                  opacity: n.is_read ? 0.7 : 1,
                }}
                aria-label={`${n.is_read ? 'Read' : 'Unread'} ${n.type} notification`}
              >
                <div className="flex items-start gap-3">
                  <I size={16} style={{ color: `var(--${tone(n.type)})` }} aria-hidden="true" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {n.body}
                    </div>
                    <time
                      className="text-[10px] mt-1.5 uppercase tracking-wider block"
                      style={{ color: 'var(--muted)' }}
                      dateTime={n.created_at}
                    >
                      {new Date(n.created_at).toLocaleString()}
                    </time>
                  </div>
                  {!n.is_read && (
                    <span
                      className="w-2 h-2 rounded-full mt-1.5"
                      style={{ background: 'var(--accent)' }}
                      aria-label="Unread"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
