import type { Food } from "./types";

/**
 * Barcode lookup with the outcomes kept apart (AUD-13): "not in the
 * library" offers to add the product, but being offline, signed out or a
 * server error must not — that's how duplicate products got submitted.
 */
export type BarcodeLookup =
  | { kind: "found"; food: Food }
  | { kind: "missing" }
  | { kind: "signedOut" }
  | { kind: "error" };

export async function lookupBarcode(code: string, fetchImpl: typeof fetch = fetch): Promise<BarcodeLookup> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/foods/barcode?code=${encodeURIComponent(code)}`);
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "signedOut" };
  if (!res.ok) return { kind: "error" };
  try {
    const json = (await res.json()) as { food?: Food | null };
    return json.food ? { kind: "found", food: json.food } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}
