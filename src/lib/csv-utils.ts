/**
 * Shared CSV generation and download utility.
 */

interface CsvColumn {
  key: string
  label: string
}

export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: CsvColumn[],
) {
  const header = columns.map((c) => c.label).join(',')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key] ?? ''
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      })
      .join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}