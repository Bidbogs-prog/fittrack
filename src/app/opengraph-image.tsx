import { ImageResponse } from "next/og";
import { LOGO_MARK_PATH, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE.toLowerCase()}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0b0907";
const INK_LINE = "#2d251c";
const PAPER = "#f4f1ea";
const PAPER_DIM = "#c2b8a9";
const FLAME_GLOW = "#ffc94d";
const FLAME = "#ff9d3b";
const FLAME_DEEP = "#f2701f";
const FLAME_INK = "#201004";

/** The "3" mark (Arabizi ع), set in Outfit Bold — same path as public/icons/icon.svg. */
function Mark({ tile }: { tile: number }) {
  return (
    <div
      style={{
        width: tile,
        height: tile,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tile * 0.22,
        backgroundImage: `linear-gradient(135deg, ${FLAME_GLOW}, ${FLAME} 55%, ${FLAME_DEEP})`,
      }}
    >
      <svg viewBox="0 0 100 100" width={tile} height={tile}>
        <path d={LOGO_MARK_PATH} fill={FLAME_INK} />
      </svg>
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          backgroundImage: `linear-gradient(${INK_LINE}55 1px, transparent 1px), linear-gradient(90deg, ${INK_LINE}55 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Mark tile={96} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: PAPER, letterSpacing: -2 }}>
              So3ra
            </div>
            <div style={{ fontSize: 26, color: PAPER_DIM }}>so3ra.app</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 104,
              fontWeight: 700,
              color: PAPER,
              letterSpacing: -4,
              lineHeight: 1.02,
            }}
          >
            Every calorie,
          </div>
          <div
            style={{
              fontSize: 104,
              fontWeight: 700,
              backgroundImage: `linear-gradient(90deg, ${FLAME_GLOW}, ${FLAME} 45%, ${FLAME_DEEP})`,
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: -4,
              lineHeight: 1.02,
            }}
          >
            counted.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: PAPER_DIM, display: "flex" }}>
            Per-gram nutrition, adaptive targets and an AI coach — built for Moroccan kitchens.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {(
            [
              [FLAME, 320],
              ["#79b8e8", 220],
              ["#ecd464", 140],
              ["#93a884", 90],
            ] as const
          ).map(([color, w]) => (
            <div
              key={color}
              style={{ width: w, height: 14, borderRadius: 7, background: color, display: "flex" }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
