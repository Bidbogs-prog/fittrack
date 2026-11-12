import { describe, expect, it } from "vitest";
import { audioFormat } from "./llm";
import { acceptedAudioType, cleanTranscript } from "./voice";

describe("voice notes", () => {
  it("accepts what phones record, with or without codec params", () => {
    expect(acceptedAudioType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(acceptedAudioType("audio/mp4")).toBe("audio/mp4");
    expect(acceptedAudioType("video/webm")).toBeNull();
    expect(acceptedAudioType("")).toBeNull();
  });

  it("maps MIME types to a file extension", () => {
    expect(audioFormat("audio/webm;codecs=opus")).toBe("webm");
    expect(audioFormat("audio/mpeg")).toBe("mp3");
    expect(audioFormat("audio/x-m4a")).toBe("mp4");
    expect(audioFormat("audio/wav")).toBe("wav");
  });

  it("keeps mixed Darija/French as spoken and treats <none> as silence", () => {
    expect(cleanTranscript(' "كليت جوج croissants و café noir" ')).toBe("كليت جوج croissants و café noir");
    expect(cleanTranscript("<none>")).toBe("");
    expect(cleanTranscript("  <NONE>\n")).toBe("");
  });
});
