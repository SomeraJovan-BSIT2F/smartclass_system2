import { ArrowUpRight, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const Card = ({ children, className = '', ...rest }) => (
  <div
    className={`bg-white border rounded-xl ${className}`}
    style={{ borderColor: 'var(--rule)' }}
    {...rest}
  >
    {children}
  </div>
);

export const Pill = ({ tone = 'muted', children, ...rest }) => {
  const map = {
    muted:  { bg: '#EEF2F8', fg: 'var(--muted)',  bd: 'var(--rule)' },
    ok:     { bg: '#E3F2EC', fg: 'var(--ok)',     bd: '#C2E0D2' },
    warn:   { bg: '#FBF1DC', fg: '#8A5E12',       bd: '#ECD9A8' },
    bad:    { bg: '#FBE4E1', fg: 'var(--bad)',    bd: '#F1C4BE' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: '#C4D6FB' },
  }[tone] || {};
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border tracking-wide uppercase"
      style={{ background: map.bg, color: map.fg, borderColor: map.bd }}
      {...rest}
    >
      {children}
    </span>
  );
};

export const Button = ({
  children, variant = 'primary', loading, className = '',
  type = 'button',
  ...rest
}) => {
  const styles = {
    primary: { bg: 'var(--ink)',    fg: '#fff',         bd: 'var(--ink)',    shadow: true },
    accent:  { bg: 'var(--accent)', fg: '#fff',         bd: 'var(--accent)', shadow: true },
    ghost:   { bg: 'transparent',   fg: 'var(--ink)',   bd: 'var(--rule)',   shadow: false },
    subtle:  { bg: 'var(--cream)',  fg: 'var(--ink)',   bd: 'var(--rule)',   shadow: false },
    danger:  { bg: 'var(--bad)',    fg: '#fff',         bd: 'var(--bad)',    shadow: true },
  }[variant];
  return (
    <button
      type={type}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${styles.shadow ? 'shadow-sm hover:shadow' : ''} ${className}`}
      style={{
        background: styles.bg,
        color: styles.fg,
        borderColor: styles.bd,
        minHeight: 'var(--tap-target)',
      }}
      {...rest}
    >
      {loading && (
        <span
          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin-slow"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
};

export const StatCard = ({ label, value, delta, icon: Icon, tone = 'ok' }) => (
  <Card className="p-5" role="figure" aria-label={`${label}: ${value}`}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
          {label}
        </div>
        <div className="mt-2 font-serif text-4xl leading-none">
          {value}
        </div>
        {delta && (
          <div
            className="mt-2 text-xs flex items-center gap-1"
            style={{ color: tone === 'bad' ? 'var(--bad)' : 'var(--ok)' }}
          >
            <ArrowUpRight size={12} aria-hidden="true" />
            {delta}
          </div>
        )}
      </div>
      {Icon && (
        <div
          className="w-9 h-9 rounded-lg grid place-items-center decorative"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          <Icon size={16} />
        </div>
      )}
    </div>
  </Card>
);

export const SectionHeader = ({ eyebrow, title, sub, action }) => (
  <div className="flex items-end justify-between gap-4 flex-wrap">
    <div>
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
          {eyebrow}
        </div>
      )}
      <h1 className="font-serif text-3xl lg:text-4xl mt-2 leading-[1.05]">
        {title}
      </h1>
      {sub && (
        <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--muted)' }}>
          {sub}
        </p>
      )}
    </div>
    {action}
  </div>
);

export const Field = ({ label, children, full, error, helper }) => {
  const id = `field-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper ? `${id}-helper` : undefined;

  return (
    <label className={`block ${full ? 'lg:col-span-2' : ''}`} htmlFor={id}>
      <span
        className="text-[11px] uppercase tracking-[0.14em] block mb-1.5"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      {/* Clone children to add id and aria attrs */}
      {typeof children === 'object' && children?.props
        ? { ...children, props: {
            ...children.props,
            id,
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': [errorId, helperId].filter(Boolean).join(' ') || undefined,
          }}
        : children}
      {helper && !error && (
        <span id={helperId} className="text-xs mt-1 block" style={{ color: 'var(--muted)' }}>
          {helper}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--bad)' }} role="alert">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </span>
      )}
    </label>
  );
};

export const Input = (props) => (
  <input
    {...props}
    className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm ${props.className || ''}`}
    style={{ borderColor: 'var(--rule)', minHeight: 'var(--tap-target)', ...props.style }}
  />
);

export const Select = (props) => (
  <select
    {...props}
    className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm ${props.className || ''}`}
    style={{ borderColor: 'var(--rule)', minHeight: 'var(--tap-target)', ...props.style }}
  >
    {props.children}
  </select>
);

export const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2.5 rounded-lg border bg-white text-sm ${props.className || ''}`}
    style={{ borderColor: 'var(--rule)', ...props.style }}
  />
);

export const Spinner = ({ size = 20, label = 'Loading' }) => (
  <span role="status" aria-live="polite">
    <span
      className="border-2 border-current border-t-transparent rounded-full animate-spin-slow inline-block"
      style={{ width: size, height: size, color: 'var(--accent)' }}
      aria-hidden="true"
    />
    <span className="sr-only">{label}</span>
  </span>
);

export const Empty = ({ title, sub }) => (
  <div className="text-center py-12">
    <div className="font-serif text-xl">{title}</div>
    {sub && <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{sub}</p>}
  </div>
);

export const ErrorBanner = ({ children, onClose }) => (
  <div
    className="p-3 rounded-lg border text-sm flex items-start gap-3"
    style={{ background: '#FBE4E1', borderColor: '#F1C4BE', color: 'var(--bad)' }}
    role="alert"
    aria-live="assertive"
  >
    <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
    <span className="flex-1">{children}</span>
    {onClose && (
      <button
        onClick={onClose}
        className="font-bold p-1 -m-1 rounded"
        aria-label="Dismiss error"
      >
        <X size={14} aria-hidden="true" />
      </button>
    )}
  </div>
);

export const SuccessBanner = ({ children, onClose }) => (
  <div
    className="p-3 rounded-lg border text-sm flex items-start gap-3"
    style={{ background: '#E3F2EC', borderColor: '#C2E0D2', color: 'var(--ok)' }}
    role="status"
    aria-live="polite"
  >
    <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
    <span className="flex-1">{children}</span>
    {onClose && (
      <button
        onClick={onClose}
        className="font-bold p-1 -m-1 rounded"
        aria-label="Dismiss success message"
      >
        <X size={14} aria-hidden="true" />
      </button>
    )}
  </div>
);
