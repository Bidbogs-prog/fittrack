import { describe, expect, it, vi } from "vitest";
import { VoiceSession, type RecorderLike, type VoiceState } from "./voice-session";

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

function fakeRecorder(): RecorderLike & { emit: (bytes: number) => void } {
  const r = {
    state: "inactive",
    mimeType: "audio/webm;codecs=opus",
    ondataavailable: null as RecorderLike["ondataavailable"],
    onstop: null as RecorderLike["onstop"],
    onerror: null as RecorderLike["onerror"],
    start() {
      r.state = "recording";
    },
    stop() {
      r.state = "inactive";
      r.onstop?.();
    },
    emit(bytes: number) {
      r.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
    },
  };
  return r;
}

function setup(opts: { permission?: Promise<MediaStream>; clock?: () => number } = {}) {
  const { stream, track } = fakeStream();
  const rec = fakeRecorder();
  const states: VoiceState[] = [];
  const errors: string[] = [];
  const audio: Blob[] = [];
  let resolve!: (s: MediaStream) => void;
  let reject!: (e: unknown) => void;
  const pending = new Promise<MediaStream>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const getUserMedia = vi.fn(() => opts.permission ?? pending);
  const s = new VoiceSession(
    { getUserMedia, createRecorder: () => rec, maxMs: 60_000, minMs: 0, now: opts.clock },
    { onState: (x) => states.push(x), onError: (e) => errors.push(e), onAudio: (b) => audio.push(b) }
  );
  return { s, stream, track, rec, states, errors, audio, resolve, reject, getUserMedia };
}

describe("VoiceSession (AUD-11)", () => {
  it("records and delivers audio on stop", async () => {
    const t = setup();
    const started = t.s.start();
    t.resolve(t.stream);
    await started;
    expect(t.s.state).toBe("recording");
    t.rec.emit(100);
    t.s.stop();
    expect(t.audio).toHaveLength(1);
    expect(t.audio[0].type).toBe("audio/webm");
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.states).toEqual(["starting", "recording", "idle"]);
  });

  it("leaving while the permission prompt is open never turns the mic on", async () => {
    const t = setup();
    const started = t.s.start();
    t.s.cancel(); // navigation / unmount
    t.resolve(t.stream); // user taps Allow afterwards
    await started;
    expect(t.s.state).toBe("idle");
    expect(t.rec.state).toBe("inactive");
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.audio).toEqual([]);
  });

  it("a second tap while starting cancels instead of starting twice", async () => {
    const t = setup();
    const first = t.s.start();
    void t.s.start(); // ignored: not idle
    t.s.stop(); // the second tap
    t.resolve(t.stream);
    await first;
    expect(t.getUserMedia).toHaveBeenCalledTimes(1);
    expect(t.s.state).toBe("idle");
    expect(t.track.stop).toHaveBeenCalled();
  });

  it("denied permission reports 'denied' and returns to idle", async () => {
    const t = setup();
    const started = t.s.start();
    t.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    await started;
    expect(t.errors).toEqual(["denied"]);
    expect(t.s.state).toBe("idle");
  });

  it("a recorder error releases the mic and delivers nothing", async () => {
    const t = setup();
    const started = t.s.start();
    t.resolve(t.stream);
    await started;
    t.rec.emit(50);
    t.rec.onerror?.(new Error("device lost"));
    expect(t.errors).toEqual(["error"]);
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.audio).toEqual([]);
  });

  it("cancel while recording delivers nothing", async () => {
    const t = setup();
    const started = t.s.start();
    t.resolve(t.stream);
    await started;
    t.rec.emit(50);
    t.s.cancel();
    expect(t.audio).toEqual([]);
    expect(t.track.stop).toHaveBeenCalled();
  });

  it("stops itself at the time cap", async () => {
    vi.useFakeTimers();
    const t = setup();
    const started = t.s.start();
    t.resolve(t.stream);
    await started;
    t.rec.emit(10);
    vi.advanceTimersByTime(60_000);
    expect(t.s.state).toBe("idle");
    expect(t.audio).toHaveLength(1);
    vi.useRealTimers();
  });
});
