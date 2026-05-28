import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { auth, api } from '../lib/api';

const AuthContext = createContext(null);
const A11yContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(auth.user);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
      return user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

const A11Y_KEY = 'smartclass.a11y';

const DEFAULTS = {
  fontScale: 1,
  highContrast: false,
  reducedMotion: false, // false = follow system / on
  simpleMode: false,
};

export function A11yProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(A11Y_KEY));
      return { ...DEFAULTS, ...stored };
    } catch {
      return DEFAULTS;
    }
  });

  // Live-region ref for screen reader announcements
  const liveRef = useRef(null);

  // Apply settings to <html>
  useEffect(() => {
    localStorage.setItem(A11Y_KEY, JSON.stringify(settings));
    const root = document.documentElement;
    root.style.fontSize = `${settings.fontScale * 100}%`;
    root.classList.toggle('hc', settings.highContrast);
    root.classList.toggle('reduce-motion', settings.reducedMotion);
    root.classList.toggle('simple-mode', settings.simpleMode);

    // Respect system reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) root.classList.add('reduce-motion');
  }, [settings]);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => {
      if (e.matches) document.documentElement.classList.add('reduce-motion');
      else if (!settings.reducedMotion)
        document.documentElement.classList.remove('reduce-motion');
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [settings.reducedMotion]);

  const update = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  // Announce a message to screen readers via aria-live region
  const announce = useCallback((message, priority = 'polite') => {
    if (!liveRef.current) return;
    // Update priority dynamically
    liveRef.current.setAttribute('aria-live', priority);
    // Clear first to ensure even repeat messages get re-announced
    liveRef.current.textContent = '';
    setTimeout(() => {
      if (liveRef.current) liveRef.current.textContent = message;
    }, 50);
  }, []);

  return (
    <A11yContext.Provider value={{ settings, update, reset, announce }}>
      {children}
      {/* Two live regions: polite for non-urgent, assertive for urgent */}
      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </A11yContext.Provider>
  );
}

export const useA11y = () => useContext(A11yContext);

export function useFocusTrap(active, onEscape) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;
    const previouslyFocused = document.activeElement;

    // Find all focusable elements
    const getFocusable = () =>
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), ' +
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
      );

    // Focus the first focusable element
    const focusables = getFocusable();
    if (focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      if (previouslyFocused && previouslyFocused.focus)
        previouslyFocused.focus();
    };
  }, [active, onEscape]);

  return ref;
}
