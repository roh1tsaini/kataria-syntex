/*
 * Applies the persisted theme mode + accent before first paint so dark-mode
 * users never see a light flash. Loaded synchronously from index.html; the
 * React store (ui/hooks/use-theme.ts) re-reads the same keys on boot.
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
    try {
      var accent = localStorage.getItem("kataria-challan-accent");
      if (accent) root.dataset.accent = accent;
    } catch (e) {}
  } catch (e) {}
})();
