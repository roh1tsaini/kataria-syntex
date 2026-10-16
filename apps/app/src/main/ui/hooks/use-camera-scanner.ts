import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { parseQrScanId } from "@kataria-syntex/shared";

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
          const id = parseQrScanId(qr.data);
          if (id) {
            stream?.getTracks().forEach((t) => t.stop());
            onCodeRef.current(id);
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
          // A blocked playback must not fail silently — the scan loop would
          // run forever against a frozen frame.
          video
            .play()
            .catch(() =>
              setScanError(
                "Video playback was blocked. Enter the code manually instead.",
              ),
            );
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
