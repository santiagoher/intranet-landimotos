export interface ExcelSource {
  filename: string
  sha256: string
  date1904: boolean
  sheets: { name: string; rows: { row: number; cells: Record<string, string | undefined> }[] }[]
}
export interface HistoricalRecord {
  id: string
  row: number
  category: string
  total: string | null
  originalTotal: string | null
  correction: string | null
  date: string | null
  surplus: string | null
  shortage: string | null
  responsible: string
  adjustmentDate: string | null
}
export interface HistoricalWarehouse {
  name: string
  people: string[]
  records: HistoricalRecord[]
  categories: { name: string; rows: number[]; lastDate: string | null }[]
}
export interface HistoricalInventory {
  filename: string
  sha256: string
  warehouses: HistoricalWarehouse[]
}
const clean = (value = '') => value.trim().replace(/\s+/g, ' ')
const key = (value: string) => clean(value).toLocaleUpperCase('es-CO')

// User-confirmed corrections to specific source cells. Preserve the workbook.
// Match row, category and previous value so reimports cannot silently overwrite new data.
const confirmedTotals = [
  { sheet: 'BODEGA 22', row: 8, category: 'LUBRICANTES GRAV', previous: '8806000', units: '1998' },
  { sheet: 'BODEGA 22', row: 10, category: 'MANIGUETAS', previous: '4289000', units: '4617' },
] as const

export function excelDate(value: string | undefined, date1904 = false): string | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return null
  const days = Math.floor(Number(value))
  if (!Number.isFinite(days) || days < 1 || days > 100000 || (!date1904 && days === 60)) return null
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, days < 60 ? 31 : 30)
  return new Date(epoch + days * 86400000).toISOString().slice(0, 10)
}

export function normalizeExcel(source: ExcelSource): HistoricalInventory {
  return {
    filename: source.filename, sha256: source.sha256,
    warehouses: source.sheets.map(sheet => {
      const records: HistoricalRecord[] = sheet.rows.filter(r => r.row >= 3 && clean(r.cells.B)).map(({ row, cells: c }) => {
        const correction = confirmedTotals.find(item => item.sheet === sheet.name && item.row === row
          && item.category === key(c.B ?? '') && item.previous === c.C)
        return {
        id: `${sheet.name}:${row}`, row, category: clean(c.B),
        total: correction?.units ?? c.C ?? null, originalTotal: c.C ?? null,
        correction: correction ? 'Cantidad física corregida por confirmación del usuario.' : null,
        date: excelDate(c.D, source.date1904),
        surplus: c.E ?? null, shortage: c.F ?? null,
        responsible: clean(c.G), adjustmentDate: excelDate(c.H, source.date1904),
        }
      })
      const categories = new Map<string, HistoricalWarehouse['categories'][number]>()
      // J also contains pivot tables. Only the CONTROL status rows are categories.
      for (const { row, cells: c } of sheet.rows) {
        if (!c.J || !/^(ALDIA|PORREALIZAR|CRITICO)\(/.test((c.L ?? '').replace(/\s+/g, ''))) continue
        const id = key(c.J)
        const existing = categories.get(id)
        if (existing) existing.rows.push(row)
        else categories.set(id, { name: clean(c.J), rows: [row], lastDate: null })
      }
      for (const record of records) {
        const id = key(record.category)
        const category = categories.get(id) ?? { name: record.category, rows: [], lastDate: null }
        if (record.date && (!category.lastDate || record.date > category.lastDate)) category.lastDate = record.date
        categories.set(id, category)
      }
      return {
        name: sheet.name,
        people: [...new Set(sheet.rows.map(r => clean(r.cells.Q)).filter(Boolean))],
        records: records.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.row - b.row),
        categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    }),
  }
}

export function categoryStatus(date: string | null, today: string): string {
  if (!date) return 'Sin inventario'
  const days = (Date.parse(today) - Date.parse(date)) / 86400000
  if (!Number.isFinite(days) || days < 0) return 'Fecha por revisar'
  if (days < 10) return 'Al día'
  if (days <= 30) return 'Por realizar'
  return 'Crítico'
}
