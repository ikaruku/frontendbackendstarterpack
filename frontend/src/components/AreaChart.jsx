// Grafik area ringan berbasis SVG (tanpa library). Skala otomatis mengikuti lebar layar.
// series: [{ name, color, values: number[] }]

function linePath(points) {
  // Kurva halus: tangen horizontal di tiap titik
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`
    const [px, py] = points[i - 1]
    const mx = (px + x) / 2
    return `${d} C${mx},${py} ${mx},${y} ${x},${y}`
  }, '')
}

export default function AreaChart({ labels, series }) {
  const W = 720
  const H = 260
  const pad = { l: 40, r: 10, t: 12, b: 28 }
  const all = series.flatMap((s) => s.values)
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(...all))))
  const max = Math.ceil(Math.max(...all) / step) * step
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (labels.length - 1)
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t))
  const labelEvery = Math.ceil(labels.length / 7)
  const baseline = H - pad.b

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue chart">
      <defs>
        {series.map((s, i) => (
          <linearGradient key={s.name} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
          </linearGradient>
        ))}
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? '0' : '4 4'} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}

      {labels.map((label, i) =>
        i % labelEvery === 0 || i === labels.length - 1 ? (
          <text key={label + i} x={x(i)} y={H - 8} textAnchor="middle">
            {label}
          </text>
        ) : null,
      )}

      {series.map((s, i) => {
        const pts = s.values.map((v, idx) => [x(idx), y(v)])
        const line = linePath(pts)
        const area = `${line} L${x(s.values.length - 1)},${baseline} L${x(0)},${baseline} Z`
        const last = pts[pts.length - 1]
        return (
          <g key={s.name}>
            <path d={area} fill={`url(#area-${i})`} />
            <path d={line} fill="none" style={{ stroke: s.color }} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--surface)" style={{ stroke: s.color }} strokeWidth="2.5" />
          </g>
        )
      })}
    </svg>
  )
}
