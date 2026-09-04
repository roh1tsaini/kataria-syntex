/* Throwaway harness: renders the real YarnCone to static HTML for
   screenshot review. Delete after the cone work lands. */
import { renderToStaticMarkup } from "react-dom/server";
import { YarnCone } from "../src/components/shade/YarnCone";

const cases: Array<{ code: string; hex: string; colors?: string[] }> = [
  { code: "100", hex: "#C62828" },
  { code: "88LD", hex: "#880E4F", colors: ["#880E4F", "#9C27B0", "#7B1FA2", "#4A148C"] },
  { code: "58", hex: "#FFD700" },
  { code: "103D", hex: "#8D6E63" },
  { code: "60", hex: "#4DD0E1" },
  { code: "111", hex: "#6D4C41" },
];

/* One single React render — separate renderToStaticMarkup calls would
   reuse the same useId per call and collide SVG gradient ids. */
const body = renderToStaticMarkup(
  <div className="wrap">
    {cases.map(({ code, hex, colors }) => (
      <div
        key={code}
        className="stage"
        style={{
          backgroundImage: `radial-gradient(120% 90% at 50% 8%, ${hex}2e 0%, transparent 55%), radial-gradient(closest-side at 50% 88%, rgb(10 37 64 / 0.10), transparent)`,
        }}
      >
        <span className="code">{code}</span>
        <YarnCone colors={colors ?? [hex]} hex={hex} className="cone" />
      </div>
    ))}
  </div>,
);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #e6f0fb; font-family: ui-monospace, monospace; }
  .wrap { display: grid; grid-template-columns: repeat(3, 1fr); }
  .stage { position: relative; display: flex; align-items: center; justify-content: center;
    min-height: 480px; background-color: #eef5fc; overflow: hidden; }
  .stage:nth-child(even) { background-color: #e2edf9; }
  .code { position: absolute; left: 12px; top: 12px; background: #fff; padding: 2px 6px;
    border: 1px solid rgb(10 37 64 / .12); border-radius: 5px; font-size: 11px; color: #0a2540; }
  .cone { height: 380px; width: auto; }
</style></head>
<body>${body}</body></html>`;

await Bun.write(new URL("./out.html", import.meta.url), html);
console.log("written");
