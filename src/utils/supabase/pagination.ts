import type { PostgrestSingleResponse } from '@supabase/supabase-js'

const SUPABASE_DEFAULT_PAGE_SIZE = 1000

type SupabaseRangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<PostgrestSingleResponse<T[]>>
}

/**
 * Supabase/PostgREST devuelve por defecto máximo 1000 filas por consulta.
 * Esta utilidad recorre la consulta por páginas para evitar métricas truncadas.
 */
export async function fetchAllSupabaseRows<T>(
  queryBuilderFactory: () => SupabaseRangeQuery<T>,
  pageSize = SUPABASE_DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryBuilderFactory().range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return rows
}