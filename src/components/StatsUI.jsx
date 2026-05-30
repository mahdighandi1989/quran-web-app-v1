// Reusable presentational components for the upgraded Reports / Exam / Settings pages.
// All are pure/presentational (no app state) so they're easy to reason about and reuse.
import React, { useState } from 'react';

const toFa = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

// A KPI card: icon + big value + label, with an accent color.
export function StatCard({ icon, value, label, accent = 'teal', sub }) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-ico">{icon}</div>
      <div className="stat-val">{value}</div>
      <div className="stat-lbl">{label}</div>
      {sub != null && <div className="stat-lbl" style={{ opacity: 0.8 }}>{sub}</div>}
    </div>
  );
}

// Collapsible accordion section (used to declutter Settings).
export function Accordion({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc-section ${open ? 'open' : ''}`}>
      <button type="button" className="acc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{icon ? `${icon} ` : ''}{title}</span>
        <span className="acc-ico">▼</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

// Segmented control (pill tabs).
export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={value === o.value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Line/area trend chart for daily accuracy (SVG, no deps). series: [{day, accuracyPct, total}]
export function TrendChart({ series, height = 160 }) {
  const w = Math.max(320, series.length * 26);
  const pad = 28;
  const innerH = height - pad * 1.4;
  const pts = series.map((d, i) => {
    const x = pad + (i * (w - pad * 1.5)) / Math.max(1, series.length - 1);
    const v = d.accuracyPct == null ? null : d.accuracyPct;
    const y = v == null ? null : (pad * 0.5 + innerH - (v / 100) * innerH);
    return { x, y, d };
  });
  const linePts = pts.filter((p) => p.y != null);
  const path = linePts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = linePts.length
    ? `${path} L${linePts[linePts.length - 1].x.toFixed(1)},${(pad * 0.5 + innerH).toFixed(1)} L${linePts[0].x.toFixed(1)},${(pad * 0.5 + innerH).toFixed(1)} Z`
    : '';
  return (
    <div className="trend-wrap">
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" dir="ltr">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = pad * 0.5 + innerH - (g / 100) * innerH;
          return <g key={g}><line x1={pad} y1={y} x2={w - pad * 0.5} y2={y} stroke="var(--border-color)" strokeWidth="1" /><text x={4} y={y + 3} fontSize="9" fill="var(--text-muted)">{g}</text></g>;
        })}
        {area && <path d={area} fill="var(--primary-color)" opacity="0.12" />}
        {path && <path d={path} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {linePts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--primary-color)"><title>{`${p.d.day}: ${p.d.accuracyPct}%`}</title></circle>)}
      </svg>
    </div>
  );
}

// GitHub-style activity heatmap. heatmap: {cols:[[{count,day}]], max}
export function Heatmap({ heatmap }) {
  const level = (c) => {
    if (!c) return '';
    const m = heatmap.max || 1;
    if (c >= m * 0.75) return 'l4';
    if (c >= m * 0.5) return 'l3';
    if (c >= m * 0.25) return 'l2';
    return 'l1';
  };
  return (
    <div className="heatmap">
      {heatmap.cols.map((col, ci) => (
        <div className="heatmap-col" key={ci}>
          {col.map((cell, ri) => (
            <div key={ri} className={`heatmap-cell ${level(cell.count)}`} title={`${cell.day}: ${cell.count} جلسه`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Horizontal labelled bars (per-surah etc). data: [{label, value, max, color}]
export function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color || 'var(--primary-color)' }} /></div>
          <span className="tabular-nums" style={{ minWidth: '2.5rem', textAlign: 'left' }}>{toFa(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Circular progress ring (for goals / scores).
export function ProgressRing({ value, max = 100, size = 96, label, color = 'var(--primary-color)' }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="goal-ring">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--chip-bg)" strokeWidth="10" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="10" fill="none"
        strokeDasharray={`${(pct * c).toFixed(1)} ${c.toFixed(1)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight="800" fill="var(--text-heading)">
        {label != null ? label : `${Math.round(pct * 100)}%`}
      </text>
    </svg>
  );
}
