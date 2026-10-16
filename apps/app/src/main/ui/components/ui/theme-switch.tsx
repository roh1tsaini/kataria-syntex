import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/ui/hooks/use-theme";
import { CircleButton } from "@/ui/components/ui/circle-button";

/* design.md Section 2.7 — the theme toggle: both glyphs stay mounted in one
   grid cell and cross-rotate through the swap (Section 5.2). html.dark drives
   the state, so the motion is pure CSS. */
export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Light theme" : "Dark theme";
  return (
    <CircleButton
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="theme-icons"
    >
      <Sun className="theme-icon-sun" aria-hidden />
      <Moon className="theme-icon-moon" aria-hidden />
    </CircleButton>
  );
}
