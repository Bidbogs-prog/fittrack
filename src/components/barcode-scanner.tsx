"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightning } from "@phosphor-icons/react";

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
  const t = useTranslations("addFood");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  // The latest callback without restarting the camera on re-renders.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const [torch, setTorch] = useState<boolean | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop(): void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A code must read the same twice in a row: blurry frames misread digits.
    let lastRead: string | null = null;

    const accept = (value: string | undefined) => {
      if (stopped || !value || !CODE_RE.test(value)) return;
      if (value !== lastRead) {
        lastRead = value;
        return;
      }
      stopped = true;
      navigator.vibrate?.(40);
      onDetectedRef.current(value);
    };

    const start = async () => {
      const Detector = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;

      try {
        // Higher resolution resolves the thin bars of EAN codes; the default
        // 640×480 is often too coarse once the label isn't perfectly sharp.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (stopped) return;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track ?? null;
        if (track) await tuneTrack(track);
        if (stopped) return;
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch(caps.torch ? false : null);

        video.srcObject = stream;
        await video.play();

        if (Detector) {
          const detector = new Detector({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              accept(codes.find((c) => CODE_RE.test(c.rawValue))?.rawValue);
            } catch {
              // Detection hiccups (e.g. video not ready) — keep polling.
            }
            if (!stopped) timer = setTimeout(tick, 120);
          };
          void tick();
        } else {
          // 1D-only reader: faster and more tolerant of blur than the
          // multi-format one, and it reuses our high-resolution stream.
          const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 80 });
          zxingControls = await reader.decodeFromStream(stream, video, (result) => {
            accept(result?.getText());
            if (stopped) zxingControls?.stop();
          });
          if (stopped) zxingControls.stop();
        }
      } catch {
        if (!stopped) {
          setError(true);
        }
      }
    };

    void start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      zxingControls?.stop();
      trackRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track || torch == null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  // Tap to refocus: some phones lock focus on a far object and never retry.
  const refocus = () => {
    const track = trackRef.current;
    if (track) void tuneTrack(track);
  };

  return (
    <div className={className}>
      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          {t("cameraUnavailable")}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
          {/* muted+playsInline: iOS refuses inline autoplay otherwise */}
          <video
            ref={videoRef}
            muted
            playsInline
            onClick={refocus}
            className="aspect-[4/3] w-full object-cover"
          />
          {/* Target box: a wide, short window the barcode should fill. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[34%] -translate-y-1/2 rounded-lg border-2 border-flame/80 shadow-[0_0_0_9999px_rgba(11,9,7,0.45)]"
          >
            <span className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-flame/70" />
          </div>
          {torch != null && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch}
              aria-label={t("torch")}
              className={`absolute end-2.5 top-2.5 grid size-10 place-items-center rounded-full backdrop-blur-sm ${
                torch ? "bg-flame text-flame-ink" : "bg-ink-950/70 text-paper"
              }`}
            >
              <Lightning weight={torch ? "fill" : "bold"} className="size-4.5" />
            </button>
          )}
          <p className="absolute inset-x-0 bottom-0 bg-ink-950/70 px-3 py-2 text-center text-[11px] text-paper-dim backdrop-blur-sm">
            {t("pointCameraAtBarcode")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Best-effort camera tuning, per capability: continuous autofocus/exposure,
 * and ~2× zoom so the phone can sit far enough back to focus (most blur comes
 * from holding the label closer than the lens's minimum focus distance).
 * Unsupported constraints are skipped; failures are ignored.
 */
async function tuneTrack(track: MediaStreamTrack) {
  const caps = (track.getCapabilities?.() ?? {}) as {
    focusMode?: string[];
    exposureMode?: string[];
    zoom?: { min: number; max: number };
  };
  const set: Record<string, unknown> = {};
  if (caps.focusMode?.includes("continuous")) set.focusMode = "continuous";
  if (caps.exposureMode?.includes("continuous")) set.exposureMode = "continuous";
  if (caps.zoom && caps.zoom.max >= 1.5) set.zoom = Math.min(2, caps.zoom.max);
  if (Object.keys(set).length === 0) return;
  try {
    await track.applyConstraints({ advanced: [set as MediaTrackConstraintSet] });
  } catch {
    // Not supported on this device — the stream still works.
  }
}
