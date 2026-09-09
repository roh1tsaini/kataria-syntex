/**
 * Ambient wash behind the pre-auth surfaces (entry + download).
 * Saturated blue edges melting into a pale glowing center, with four large
 * billows drifting on slow alternate keyframes (transform only). Pure CSS
 * — the global prefers-reduced-motion collapse stills it,
 * prefers-reduced-transparency flattens it. Decorative.
 */
export function EntryWash() {
  return (
    <div className="entry-wash" aria-hidden>
      <i className="w1" />
      <i className="w2" />
      <i className="w3" />
      <i className="w4" />
    </div>
  );
}
