/**
 * Supabase returns at most 1,000 rows per request. Anything that reads a
 * whole table (crons, the lifecycle engine) must page through it, or it
 * silently works on the first 1,000 rows only once Orbit grows.
 *
 *   const { data, error } = await allRows(() => supabase.from("clients").select("user_id").order("id"));
 *
 * `make` must build a fresh, ORDERED query each call (stable paging).
 */

const PAGE = 1000;
const MAX_PAGES = 1000; // 1M rows - a safety stop, not a target

interface Result<T> { data: T[] | null; error: { message: string } | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allRows<T = any>(make: () => { range: (from: number, to: number) => PromiseLike<Result<T>> }): Promise<Result<T>> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await make().range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return { data: out.length ? out : null, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { data: out, error: null };
}

/**
 * `.in("id", ids)` puts every id in the request URL, which breaks past a
 * few hundred ids. This runs the query in batches and joins the results.
 *
 *   await inBatches(userIds, (ids) => supabase.from("profiles").select("id").in("id", ids))
 */
export async function inBatches<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  ids: string[],
  run: (chunk: string[]) => PromiseLike<Result<T>>,
  size = 150,
): Promise<Result<T>> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error) return { data: out.length ? out : null, error };
    out.push(...(data ?? []));
  }
  return { data: out, error: null };
}
