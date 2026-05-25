// Composant serveur pur SVG — courbe de croissance
interface Pesee {
  date: Date;
  poids: number;
}

interface Props {
  pesees: Pesee[];
  gmqGlobal?: number | null;
}

const MARGIN = { top: 12, right: 12, bottom: 32, left: 44 };
const WIDTH = 320;
const HEIGHT = 130;
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

function fmt(d: Date): string {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export default function PoidsCurve({ pesees, gmqGlobal }: Props) {
  if (pesees.length < 2) return null;

  const times = pesees.map((p) => new Date(p.date).getTime());
  const poidsVals = pesees.map((p) => p.poids);

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minY = Math.min(...poidsVals);
  const maxY = Math.max(...poidsVals);

  const padY = Math.max((maxY - minY) * 0.1, 5);
  const yLow = Math.floor(minY - padY);
  const yHigh = Math.ceil(maxY + padY);

  function toX(t: number): number {
    if (maxT === minT) return INNER_W / 2;
    return ((t - minT) / (maxT - minT)) * INNER_W;
  }

  function toY(v: number): number {
    if (yHigh === yLow) return INNER_H / 2;
    return INNER_H - ((v - yLow) / (yHigh - yLow)) * INNER_H;
  }

  // Points
  const pts = pesees.map((p) => ({
    x: toX(new Date(p.date).getTime()),
    y: toY(p.poids),
    label: fmt(p.date),
    poids: p.poids,
  }));

  // Polyline
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // Axe Y : 4 graduations
  const yTicks: number[] = [];
  for (let i = 0; i <= 3; i++) {
    yTicks.push(Math.round(yLow + ((yHigh - yLow) * i) / 3));
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-600">Courbe de croissance</span>
        {gmqGlobal != null && (
          <span className="text-xs text-blue-600 font-medium">GMQ global: {gmqGlobal} g/j</span>
        )}
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ maxWidth: WIDTH, display: "block" }}
          aria-label="Courbe de croissance"
        >
          {/* Fond */}
          <rect
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
            rx={8}
            ry={8}
            fill="#f9fafb"
          />

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Grille horizontale */}
            {yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                y1={toY(tick)}
                x2={INNER_W}
                y2={toY(tick)}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            ))}

            {/* Labels axe Y */}
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={-6}
                y={toY(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={8}
                fill="#9ca3af"
              >
                {tick}
              </text>
            ))}

            {/* Ligne bleue */}
            <polyline
              points={polyline}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Cercles + labels axe X */}
            {pts.map((pt, i) => (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r={3} fill="#3b82f6" />
                <text
                  x={pt.x}
                  y={INNER_H + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#9ca3af"
                  transform={`rotate(-35, ${pt.x}, ${INNER_H + 14})`}
                >
                  {pt.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
