import { useId } from "react";
import { threadRows } from "@/components/shade/thread";

/* ------------------------------------------------------------------ */
/* Color helpers                                                       */
/* ------------------------------------------------------------------ */

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return [128, 128, 128];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** amount > 0 mixes toward white, amount < 0 toward black. */
function shift(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v + (target - v) * t)));
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

/* ------------------------------------------------------------------ */
/* Geometry — authentic 1:1 match to reference yarn cone photo:       */
/* - Classic tapered cone (~1.25:1 ratio, base 188px, top 96px)       */
/* - Bulbous rolled top shoulder with recessed kraft cardboard tube   */
/* - Deeply rolled bottom edge resting on surface                     */
/* - Open traverse diamond cross-winding lattice (~33° angle)         */
/* - Tactile spun fiber micro-relief and studio lighting              */
/* ------------------------------------------------------------------ */

const CX = 160;

// Central cardboard / kraft paper tube in the top dome
const CORE_Y = 66;
const CORE_RX = 21;
const CORE_RY = 6.8;
const CORE_INNER_RX = 17.0;
const CORE_INNER_RY = 5.2;

// Wound yarn cone dimensions
const TOP_Y = 72;
const TOP_RX = 48;
const TOP_RY = 14.0;

const BOT_Y = 282;
const BOT_RX = 94;
const BOT_RY = 18.0;

// Melange winding parameters
const PERIOD = 5.0;
const START_Y = TOP_Y - TOP_RY - 2;
const SPAN = BOT_Y + BOT_RY - START_Y + 14;
const RENDER_W = 340;
const SEG_BASE = 58;
const HELIX = -3.2;

export function YarnCone({
  colors,
  hex,
  className,
  title,
  seed,
}: {
  /** Ordered thread palette — melange shades carry it along one thread. */
  colors: string[];
  /** Base shade hex, used for the top face and glow tint. */
  hex: string;
  className?: string;
  title?: string;
  /** Stable per-shade seed (e.g. the shade code) for the thread layout. */
  seed?: string | number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const palette = colors.length ? colors : [hex];
  const melange = palette.length > 1;
  const periods = Math.ceil(SPAN / PERIOD);

  /* Melange winding: continuous space-dyed thread walked across rows */
  const thread = melange
    ? threadRows({
        paletteLength: palette.length,
        rowWidths: Array.from({ length: periods + 2 }, () => RENDER_W),
        baseLen: SEG_BASE,
        seed: seed ?? `${hex}|${palette.join(",")}`,
      })
    : [];

  const leftTop = CX - TOP_RX;
  const rightTop = CX + TOP_RX;
  const leftBot = CX - BOT_RX;
  const rightBot = CX + BOT_RX;

  /* 
   * Authentic cone silhouette:
   * Matches the real-life reference photo:
   * - Soft rolled dome shoulder on top
   * - Gracefully bowed tapered flanks
   * - Deeply rolled bottom corners and curved under-lip
   */
  const bodyPath = [
    `M ${leftTop} ${TOP_Y}`,
    // Top shoulder dome back arc
    `A ${TOP_RX} ${TOP_RY} 0 0 1 ${rightTop} ${TOP_Y}`,
    // Right convex flank
    `C ${rightTop + 2} 125, ${rightBot + 3} 215, ${rightBot} ${BOT_Y}`,
    // Rolled bottom right corner & under-lip
    `C ${rightBot} ${BOT_Y + 14}, ${rightBot - 16} ${BOT_Y + 22}, ${CX} ${BOT_Y + 22}`,
    // Rolled bottom left corner & under-lip
    `C ${leftBot + 16} ${BOT_Y + 22}, ${leftBot} ${BOT_Y + 14}, ${leftBot} ${BOT_Y}`,
    // Left convex flank
    `C ${leftBot - 3} 215, ${leftTop - 2} 125, ${leftTop} ${TOP_Y}`,
    "Z",
  ].join(" ");

  // Unique IDs for SVG gradients, patterns, and filters
  const clipId = `cone-clip-${uid}`;
  const kraftId = `kraft-${uid}`;
  const holeGradId = `hole-${uid}`;
  const cylinderShadeId = `cyl-${uid}`;
  const keyLightId = `key-${uid}`;
  const topDomeLightId = `top-dome-${uid}`;
  const bottomRollShadowId = `bot-roll-${uid}`;
  const fiberId = `fiber-${uid}`;
  const crossWeaveId = `cross-${uid}`;
  const floorContactId = `contact-${uid}`;
  const floorAmbientId = `floor-${uid}`;
  const glowId = `glow-${uid}`;
  const softBlurId = `soft-${uid}`;

  return (
    <svg
      viewBox="0 0 320 340"
      role="img"
      aria-label={title ?? `Yarn cone in shade ${hex}`}
      className={className}
    >
      <defs>
        {/* Silhouette clip */}
        <clipPath id={clipId}>
          <path d={bodyPath} />
        </clipPath>

        {/* Soft blur for cast shadows */}
        <filter id={softBlurId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>

        {/* Spun textile fiber micro-texture filter (authentic yarn fuzz) */}
        <filter id={fiberId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.17 0"
          />
        </filter>

        {/* 
         * Open traverse diamond cross-winding lattice:
         * Visible crossing yarn cords with 3D strand relief matching reference photo (~33.7°)
         */}
        <pattern
          id={crossWeaveId}
          width="20"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          {/* Forward diagonal yarn cords (+33.7°) */}
          {/* Groove shadow */}
          <line
            x1="-10"
            y1="-15"
            x2="30"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.28"
            strokeWidth="2.2"
          />
          <line
            x1="0"
            y1="-15"
            x2="40"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.28"
            strokeWidth="2.2"
          />
          <line
            x1="10"
            y1="-15"
            x2="50"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.28"
            strokeWidth="2.2"
          />
          {/* Strand crown highlight ridge */}
          <line
            x1="-8.8"
            y1="-15"
            x2="31.2"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.26"
            strokeWidth="1.4"
          />
          <line
            x1="1.2"
            y1="-15"
            x2="41.2"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.26"
            strokeWidth="1.4"
          />
          <line
            x1="11.2"
            y1="-15"
            x2="51.2"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.26"
            strokeWidth="1.4"
          />

          {/* Reverse diagonal yarn cords (-33.7°) */}
          {/* Groove shadow */}
          <line
            x1="30"
            y1="-15"
            x2="-10"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.24"
            strokeWidth="2.2"
          />
          <line
            x1="40"
            y1="-15"
            x2="0"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.24"
            strokeWidth="2.2"
          />
          <line
            x1="50"
            y1="-15"
            x2="10"
            y2="45"
            stroke="#000000"
            strokeOpacity="0.24"
            strokeWidth="2.2"
          />
          {/* Reverse strand crown highlight ridge */}
          <line
            x1="28.8"
            y1="-15"
            x2="-11.2"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.20"
            strokeWidth="1.4"
          />
          <line
            x1="38.8"
            y1="-15"
            x2="-1.2"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.20"
            strokeWidth="1.4"
          />
          <line
            x1="48.8"
            y1="-15"
            x2="8.8"
            y2="45"
            stroke="#ffffff"
            strokeOpacity="0.20"
            strokeWidth="1.4"
          />
        </pattern>

        {/* Kraft cardboard core cylinder rim gradient */}
        <linearGradient id={kraftId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#876f55" />
          <stop offset="0.28" stopColor="#c7b094" />
          <stop offset="0.55" stopColor="#b69b7e" />
          <stop offset="1" stopColor="#755e46" />
        </linearGradient>

        {/* Cardboard tube interior hollow depth shadow */}
        <linearGradient id={holeGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d2c1e" />
          <stop offset="0.5" stopColor="#1e140d" />
          <stop offset="1" stopColor="#0a0705" />
        </linearGradient>

        {/* 3D cylinder lighting: broad soft key light on left, deep core shadow on right */}
        <linearGradient id={cylinderShadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.28" />
          <stop offset="0.08" stopColor="#000000" stopOpacity="0.09" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.11" />
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.48" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="0.65" stopColor="#000000" stopOpacity="0.03" />
          <stop offset="0.80" stopColor="#000000" stopOpacity="0.18" />
          <stop offset="0.91" stopColor="#000000" stopOpacity="0.38" />
          <stop offset="0.97" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.30" />
        </linearGradient>

        {/* Diffuse satin specular sheen along the curved yarn package */}
        <radialGradient
          id={keyLightId}
          cx="0.33"
          cy="0.40"
          r="0.55"
          fx="0.30"
          fy="0.36"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Top rolled shoulder dome overhead highlight */}
        <linearGradient id={topDomeLightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.6" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* Bottom rolled lip under-shadow */}
        <linearGradient id={bottomRollShadowId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.65" stopColor="#000000" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.46" />
        </linearGradient>

        {/* Floor shadows */}
        <radialGradient id={floorContactId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0a2540" stopOpacity="0.52" />
          <stop offset="0.6" stopColor="#0a2540" stopOpacity="0.24" />
          <stop offset="1" stopColor="#0a2540" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={floorAmbientId} cx="0.46" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0a2540" stopOpacity="0.22" />
          <stop offset="0.65" stopColor="#0a2540" stopOpacity="0.07" />
          <stop offset="1" stopColor="#0a2540" stopOpacity="0" />
        </radialGradient>

        {/* Yarn color ambient halo */}
        <radialGradient id={glowId} cx="0.5" cy="0.48" r="0.55">
          <stop offset="0" stopColor={hex} stopOpacity="0.20" />
          <stop offset="1" stopColor={hex} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Ground shadows & ambient glow                                 */}
      {/* ---------------------------------------------------------------- */}
      <ellipse
        cx={CX}
        cy={175}
        rx={125}
        ry={130}
        fill={`url(#${glowId})`}
      />

      {/* Diffuse cast floor shadow trailing softly to rear/left */}
      <ellipse
        cx={CX - 10}
        cy={BOT_Y + 19}
        rx={112}
        ry={18}
        fill={`url(#${floorAmbientId})`}
        filter={`url(#${softBlurId})`}
      />

      {/* Tight contact floor shadow directly under the rolled bottom lip */}
      <ellipse
        cx={CX}
        cy={BOT_Y + 17}
        rx={84}
        ry={9}
        fill={`url(#${floorContactId})`}
      />

      {/* ---------------------------------------------------------------- */}
      {/* 2. Wound yarn cone body                                          */}
      {/* ---------------------------------------------------------------- */}
      <g clipPath={`url(#${clipId})`}>
        {/* Base shade color layer (underpins both solid and melange) */}
        <rect
          x={CX - RENDER_W / 2}
          y={START_Y - 10}
          width={RENDER_W}
          height={SPAN + 20}
          fill={palette[0]}
        />

        {/* Melange continuous thread winding rows */}
        {melange && (
          <g transform={`rotate(${HELIX} ${CX} ${(TOP_Y + BOT_Y) / 2})`}>
            {thread.map((segments, k) => {
              const y = START_Y + k * PERIOD;
              return (
                <g key={k}>
                  {segments.map((segment, j) => (
                    <rect
                      key={j}
                      x={+(CX - RENDER_W / 2 + segment.x0).toFixed(2)}
                      y={y}
                      width={+(segment.x1 - segment.x0 + 0.6).toFixed(2)}
                      height={PERIOD + 0.6}
                      fill={palette[segment.colorIndex % palette.length]}
                    />
                  ))}
                </g>
              );
            })}
          </g>
        )}

        {/* Open traverse diamond cross-winding lattice */}
        <rect
          x={CX - RENDER_W / 2}
          y={START_Y - 10}
          width={RENDER_W}
          height={SPAN + 20}
          fill={`url(#${crossWeaveId})`}
        />

        {/* Spun textile fiber micro-grain */}
        <rect
          x={0}
          y={START_Y - 10}
          width={320}
          height={SPAN + 20}
          fill="#808080"
          filter={`url(#${fiberId})`}
          opacity={0.17}
        />

        {/* 3D lighting, highlights, and depth shadows */}
        <path d={bodyPath} fill={`url(#${cylinderShadeId})`} />
        <path d={bodyPath} fill={`url(#${keyLightId})`} />
        <path d={bodyPath} fill={`url(#${topDomeLightId})`} />
        <path d={bodyPath} fill={`url(#${bottomRollShadowId})`} />

        {/* Top rolled shoulder thread striations wrapping inward toward core */}
        {[42, 34, 27, 21].map((rx) => (
          <ellipse
            key={rx}
            cx={CX}
            cy={TOP_Y}
            rx={rx}
            ry={+(TOP_RY * (rx / TOP_RX)).toFixed(2)}
            fill="none"
            stroke={shift(hex, -0.22)}
            strokeOpacity={0.20}
            strokeWidth={0.9}
          />
        ))}

        {/* Soft concave bowl shadow around central core hole */}
        <ellipse
          cx={CX}
          cy={CORE_Y}
          rx={CORE_RX + 8}
          ry={CORE_RY + 3}
          fill="#000000"
          opacity={0.22}
          filter={`url(#${softBlurId})`}
        />
      </g>

      {/* Silhouette definition stroke */}
      <path
        d={bodyPath}
        fill="none"
        stroke="#000000"
        strokeOpacity={0.15}
        strokeWidth={0.9}
      />

      {/* ---------------------------------------------------------------- */}
      {/* 3. Central kraft paper / cardboard core hole (flush in top dome) */}
      {/* ---------------------------------------------------------------- */}
      {/* Outer cardboard rim */}
      <ellipse
        cx={CX}
        cy={CORE_Y}
        rx={CORE_RX}
        ry={CORE_RY}
        fill={`url(#${kraftId})`}
      />
      {/* Cardboard wall thickness bevel / rim highlight */}
      <ellipse
        cx={CX}
        cy={CORE_Y}
        rx={CORE_RX}
        ry={CORE_RY}
        fill="none"
        stroke="#ded0ba"
        strokeWidth={0.9}
        strokeOpacity={0.7}
      />
      {/* Inner hollow hole with deep cylinder depth shadow */}
      <ellipse
        cx={CX}
        cy={CORE_Y}
        rx={CORE_INNER_RX}
        ry={CORE_INNER_RY}
        fill={`url(#${holeGradId})`}
      />
      <ellipse
        cx={CX}
        cy={CORE_Y}
        rx={CORE_INNER_RX}
        ry={CORE_INNER_RY}
        fill="none"
        stroke="#523c28"
        strokeWidth={0.8}
        strokeOpacity={0.6}
      />
    </svg>
  );
}
