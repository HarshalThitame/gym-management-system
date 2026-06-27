"use client";

type ScoreRingProps = {
  score: number;
  size?: number;
  strokeWidth?: number;
};

export function ScoreRing({ score, size = 80, strokeWidth = 6 }: ScoreRingProps) {
  const color = score >= 80 ? "#16A34A" : score >= 40 ? "#D97706" : "#DC2626";
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4E7DD" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-xl font-black" style={{ color }}>{score}</span>
    </div>
  );
}
