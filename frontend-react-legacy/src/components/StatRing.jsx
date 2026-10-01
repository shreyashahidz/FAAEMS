function colorFor(pct) {
  if (pct >= 90) return "#10b981"; // emerald
  if (pct >= 60) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export default function StatRing({ label, percent, sublabel, size = 96 }) {
  const pct = Math.max(0, Math.min(100, percent));
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = colorFor(pct);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#eef2f7" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50%"
          y="50%"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-900 font-bold"
          style={{ fontSize: size * 0.2 }}
        >
          {Math.round(pct)}%
        </text>
      </svg>
      <div>
        <p className="font-semibold text-slate-900 text-sm">{label}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}
