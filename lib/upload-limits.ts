/** Shared guards for spreadsheet uploads (bulk import). */
export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024

const XLSX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers/OSes don't know the xlsx type
  '',
])

/** Returns an error message, or null if the file looks like an acceptable .xlsx workbook. */
export async function checkSpreadsheetUpload(file: unknown): Promise<string | null> {
  if (!file || typeof file === 'string' || typeof (file as File).arrayBuffer !== 'function') {
    return 'No file uploaded'
  }
  const upload = file as File
  if (upload.size === 0) return 'The uploaded file is empty'
  if (upload.size > MAX_SPREADSHEET_BYTES) return 'File is too large (maximum 10MB)'
  if (!/\.xlsx$/i.test(upload.name || '') || !XLSX_MIME.has(upload.type || '')) {
    return 'Only .xlsx Excel workbooks are supported'
  }
  // .xlsx files are ZIP containers: "PK\x03\x04"
  const head = new Uint8Array(await upload.slice(0, 4).arrayBuffer())
  if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) {
    return 'The file is not a valid .xlsx workbook'
  }
  return null
}
