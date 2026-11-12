/**
 * One voice recording at a time, with an explicit lifecycle (AUD-11):
 * idle → starting (waiting for the mic permission) → recording → idle.
 * A stop or cancel while the permission prompt is still open wins: when the
 * permission resolves afterwards, the mic is released at once instead of
 * recording after the user left. One owner for the stream, timer and
 * recorder, so every exit path (stop, cap, recorder error, unmount)
 * releases all three.
 */

export type VoiceState = "idle" | "starting" | "recording";

export interface RecorderLike {
  state: string;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface VoiceDeps {
  getUserMedia: () => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => RecorderLike;
  maxMs: number;
  /** Shorter than this = a mis-tap, nothing is sent. */
  minMs?: number;
  now?: () => number;
}

export interface VoiceEvents {
  onState: (state: VoiceState) => void;
  onError: (kind: "denied" | "error") => void;
  onAudio: (blob: Blob) => void;
}

export class VoiceSession {
  state: VoiceState = "idle";
  private gen = 0;
  private stream: MediaStream | null = null;
  private rec: RecorderLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private deps: VoiceDeps,
    private events: VoiceEvents
  ) {}

  private set(state: VoiceState) {
    this.state = state;
    this.events.onState(state);
  }

  private release() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    const gen = ++this.gen;
    this.set("starting");
    let stream: MediaStream;
    try {
      stream = await this.deps.getUserMedia();
    } catch (err) {
      if (gen !== this.gen) return;
      const name = (err as { name?: string })?.name;
      this.set("idle");
      this.events.onError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }
    // Cancelled (or stopped) while the permission prompt was open.
    if (gen !== this.gen) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    let rec: RecorderLike;
    try {
      rec = this.deps.createRecorder(stream);
    } catch {
      this.release();
      this.set("idle");
      this.events.onError("error");
      return;
    }
    this.rec = rec;
    const chunks: Blob[] = [];
    const now = this.deps.now ?? Date.now;
    const started = now();
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onerror = () => {
      if (gen !== this.gen) return;
      this.gen++;
      this.release();
      this.set("idle");
      this.events.onError("error");
    };
    rec.onstop = () => {
      if (gen !== this.gen) return;
      const mime = rec.mimeType;
      this.release();
      this.set("idle");
      if (now() - started < (this.deps.minMs ?? 600) || chunks.length === 0) return;
      this.events.onAudio(new Blob(chunks, { type: (mime || "audio/webm").split(";")[0] }));
    };
    this.timer = setTimeout(() => this.stop(), this.deps.maxMs);
    try {
      rec.start(1000);
    } catch {
      this.gen++;
      this.release();
      this.set("idle");
      this.events.onError("error");
      return;
    }
    this.set("recording");
  }

  /** Finish and deliver the recording; while starting, the same as cancel. */
  stop(): void {
    if (this.state === "starting") return this.cancel();
    if (this.state === "recording" && this.rec?.state === "recording") this.rec.stop();
  }

  /** Abandon everything (navigation, unmount): nothing is delivered. */
  cancel(): void {
    if (this.state === "idle") return;
    this.gen++;
    const rec = this.rec;
    if (rec) {
      rec.onstop = null;
      try {
        if (rec.state === "recording") rec.stop();
      } catch {
        // already stopped
      }
    }
    this.release();
    this.set("idle");
  }
}
