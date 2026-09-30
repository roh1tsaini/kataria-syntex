/**
 * Ambient wash behind the pre-auth surfaces (entry + download).
 * Layered: the CSS periwinkle sky paints first (and stays as the fallback),
 * four wide cloud banks drift across it on slow transform keyframes, and
 * EntryFluid mounts a WebGL2 fluid gradient on top when WebGL2 is available
 * — that canvas is the Codex-style living layer; the CSS layers underneath
 * are its no-WebGL fallback. Global prefers-reduced-motion stills the drift
 * and freezes the fluid to one frame; prefers-reduced-transparency flattens
 * both. Decorative.
 */
import { EntryFluid } from "@/ui/components/entry-fluid";

export function EntryWash() {
  return (
    <div className="entry-wash" aria-hidden>
      <i className="w1" />
      <i className="w2" />
      <i className="w3" />
      <i className="w4" />
      <EntryFluid />
    </div>
  );
}
