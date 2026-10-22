// Supabase (PostgREST) answers at most 1,000 rows per request, however many match. A query that needs every
// row (all movies for the build, the Actors / Channels / Categories lists, a big category) has to ask page by
// page. `build` returns a FRESH query each call and must order its rows (add a unique column such as `id` as the
// last order), so pages neither overlap nor skip rows.
//
//   const { data, error } = await fetchAll(() => supabase.from('movies').select('slug').order('created_at').order('id'))
export const PAGE_SIZE = 1000

export async function fetchAll(build, max = 50000) {
  const rows = []
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}
