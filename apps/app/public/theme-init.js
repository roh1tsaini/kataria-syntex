/*
 * Applies the persisted theme mode before first paint so dark-mode
 * users never see a light flash. Loaded synchronously from index.html; the
 * React store (ui/hooks/use-theme.ts) re-reads the same key on boot.
 */
(function () {
  try {
    var stored = null;
    try {
      stored = localStorage.getItem("kataria-challan-theme");
    } catch (e) {}
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
