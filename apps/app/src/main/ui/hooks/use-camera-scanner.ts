import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Extracts a QR-login code from a scan result. The QR payload is the
 * approve-page URL (<origin>/login/scan/<code>), so the code is its last
 * path segment; a bare code is accepted too.
 */
function parseScanResult(data: string): string | null {
  const fromUrl = data.match(/\/login\/scan\/([^/?#\s]+)/);
  const raw = (
    fromUrl ? decodeURIComponent(fromUrl[1]) : data.trim()
  ).toUpperCase();
  return raw.length >= 4 ? raw : null;
}

export function useCameraScanner(
  onCode: (code: string) => void,
  active: boolean,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && ctx && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(img.data, img.width, img.height);
        if (qr?.data) {
          const code = parseScanResult(qr.data);
          if (code) {
            stream?.getTracks().forEach((t) => t.stop());
            onCodeRef.current(code);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play();
          raf = requestAnimationFrame(tick);
        }
      })
      .catch(() =>
        setScanError("Camera unavailable. Enter the code manually instead."),
      );

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return { videoRef, scanError };
}
