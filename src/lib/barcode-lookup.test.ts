import { describe, expect, it } from "vitest";
import { lookupBarcode } from "./barcode-lookup";

const respond = (status: number, body?: unknown) =>
  (async () => new Response(body === undefined ? "<html>" : JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("lookupBarcode (AUD-13)", () => {
  it("found", async () => {
    expect((await lookupBarcode("6111", respond(200, { food: { id: "f1" } }))).kind).toBe("found");
  });
  it("only a successful empty answer means not in the library", async () => {
    expect(await lookupBarcode("6111", respond(200, { food: null }))).toEqual({ kind: "missing" });
  });
  it("offline is an error, not a miss", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await lookupBarcode("6111", offline)).toEqual({ kind: "error" });
  });
  it("expired session is its own case", async () => {
    expect(await lookupBarcode("6111", respond(401, { error: "Unauthorized" }))).toEqual({ kind: "signedOut" });
  });
  it("server errors and non-JSON pages are errors", async () => {
    expect(await lookupBarcode("6111", respond(500, { error: "x" }))).toEqual({ kind: "error" });
    expect(await lookupBarcode("6111", respond(200))).toEqual({ kind: "error" });
  });
});
