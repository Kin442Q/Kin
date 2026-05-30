import * as XLSX from 'xlsx'

/**
 * Выгрузить массив объектов в .xlsx. Ключи объектов становятся заголовками
 * столбцов (уже на русском — формируется вызывающим кодом).
 */
export function exportRows(
  filename: string,
  rows: Array<Record<string, string | number>>,
  sheetName = 'Лист1',
): void {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`)
}
