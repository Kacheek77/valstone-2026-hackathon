// The signal page's score ring (VS-12 T11); sweep animates it in from 0.
export function ScoreRing({ score, threshold, sweep }: { score: number; threshold: number; sweep: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#1f9d55" : score >= threshold ? "#3a728a" : "#bcc4cb";
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" role="img" aria-label={`Score ${score}`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e3e7eb" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c - (score / 100) * c}
        transform="rotate(-90 20 20)"
        className={sweep ? "sd-ring-sweep" : undefined}
        style={{ "--sd-c": c } as React.CSSProperties}
      />
      <text x="20" y="24.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f1419">
        {score}
      </text>
    </svg>
  );
}
