/**
 * Read every row of a query page by page (AUD-14). PostgREST caps a single
 * response (1,000 rows by default), so an unpaginated export silently
 * stopped there. Throws on any page error: a partial export must never look
 * complete. The query must have a stable, unique ordering.
 */
export const EXPORT_PAGE_SIZE = 1000;
/** Hard stop so one request can't run unbounded (≈ 500k rows). */
const MAX_PAGES = 500;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = EXPORT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) return rows;
  }
  throw new Error("export too large");
}
