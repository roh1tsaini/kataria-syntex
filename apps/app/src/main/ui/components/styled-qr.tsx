import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import { useTheme } from "@/ui/hooks/use-theme";

/** Canvas resolution of the QR drawing — deliberately large. The library floors
 * modules to whole pixels and centers the remainder, so a small canvas leaves
 * a data-dependent lump of dead white inside the drawing (up to ~14px a side
 * at production payload lengths on a 176px canvas). A large canvas shrinks
 * that remainder to a fraction of a displayed pixel; the host CSS owns the
 * display size, so output stays crisp at any scale. */
const QR_CANVAS = 1000;

/** Reads the --qr-ink token as device rgb (oklch never reaches the canvas). */
function resolveInk(): string {
  try {
    const probe = document.createElement("span");
    probe.style.color = "var(--qr-ink)";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    if (computed) return computed;
  } catch {
    // Probe failed — fall through to the system default below.
  }
  return "CanvasText";
}

export function StyledQrCode({ data }: { data: string }) {
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ink = resolveInk();
    const qr = new QRCodeStyling({
      type: "svg",
      shape: "square",
      width: QR_CANVAS,
      height: QR_CANVAS,
      margin: 0,
      data,
      qrOptions: { errorCorrectionLevel: "M" },
      dotsOptions: { type: "rounded", color: ink },
      cornersSquareOptions: { type: "extra-rounded", color: ink },
      cornersDotOptions: { type: "dot", color: ink },
      // Fixed white canvas: the quiet zone must survive dark mode, and
      // scanners need dark-on-light contrast whatever the theme.
      backgroundOptions: { color: "#ffffff" },
    });
    qr.append(host);
    return () => {
      host.replaceChildren();
    };
  }, [data, theme]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Login QR code"
      className="size-full [&_svg]:block [&_svg]:size-full [&_svg]:rounded-sm"
    />
  );
}
