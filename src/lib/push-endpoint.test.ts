import { describe, expect, it } from "vitest";
import { isPushEndpoint, isPushKeys } from "./push-endpoint";

const b64url = (n: number, first = 4) => btoa(String.fromCharCode(first, ...Array(n - 1).fill(7))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("isPushEndpoint (AUD-07)", () => {
  it("accepts the push services browsers use", () => {
    for (const u of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-bl2p.notify.windows.com/w/?token=x",
    ]) expect(isPushEndpoint(u), u).toBe(true);
  });
  it("rejects anything else, including look-alikes", () => {
    for (const u of [
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilpush.apple.com/x",
      "https://push.apple.com/x",
      "not a url",
    ]) expect(isPushEndpoint(u), u).toBe(false);
  });
});

describe("isPushKeys", () => {
  it("accepts a 65-byte P-256 key and 16-byte secret", () => {
    expect(isPushKeys(b64url(65), b64url(16, 1))).toBe(true);
  });
  it("rejects wrong sizes, a compressed key and junk", () => {
    expect(isPushKeys(b64url(64), b64url(16))).toBe(false);
    expect(isPushKeys(b64url(65, 2), b64url(16))).toBe(false);
    expect(isPushKeys(b64url(65), b64url(15))).toBe(false);
    expect(isPushKeys("k", "x")).toBe(false);
    expect(isPushKeys("<script>", "a b")).toBe(false);
  });
});
