"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal typing for the native BarcodeDetector (not yet in lib.dom). */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
const CODE_RE = /^\d{6,14}$/;

/**
 * Camera view that resolves a product barcode: native BarcodeDetector where
 * available (Chrome/Android), lazy-loaded zxing decode elsewhere (Safari).
 * The heavy fallback is dynamically imported so it never taxes the bundle
 * for browsers that don't need it.
 */
export function BarcodeScanner({
  onDetected,
  className,
}: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // The latest callback without restarting the camera on re-renders.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop(): void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (code: string) => {
      if (stopped) return;
      stopped = true;
      onDetectedRef.current(code);
    };

    const start = async () => {
      const Detector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;

      try {
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const detector = new Detector({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              const value = codes.find((c) => CODE_RE.test(c.rawValue))?.rawValue;
              if (value) return finish(value);
            } catch {
              // Detection hiccups (e.g. video not ready) — keep polling.
            }
            timer = setTimeout(tick, 180);
          };
          void tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
            const value = result?.getText();
            if (value && CODE_RE.test(value)) {
              zxingControls?.stop();
              finish(value);
            }
          });
          if (stopped) zxingControls.stop();
        }
      } catch {
        if (!stopped) {
          setError("Camera unavailable. Allow camera access in your browser and try again.");
        }
      }
    };

    void start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      zxingControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className={className}>
      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          {error}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
          {/* muted+playsInline: iOS refuses inline autoplay otherwise */}
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-lime/70"
          />
          <p className="absolute inset-x-0 bottom-0 bg-ink-950/70 px-3 py-2 text-center text-[11px] text-paper-dim backdrop-blur-sm">
            Point the camera at the barcode
          </p>
        </div>
      )}
    </div>
  );
}
