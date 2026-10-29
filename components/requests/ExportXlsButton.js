'use client'
import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// Pulls the filename the server chose out of Content-Disposition (UTF-8 form preferred)
const fileNameFromDisposition = (header) => {
  const utf8 = header?.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) return decodeURIComponent(utf8[1])
  const plain = header?.match(/filename="([^"]+)"/i)
  return plain ? plain[1] : 'payment.xls'
}

// Downloads the single-request bank payment file. The file is fetched as a blob and
// handed to the browser directly — it is never stored anywhere server-side.
export default function ExportXlsButton({ requestId, compact = false, disabledReason = null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/api/requests/${requestId}/export`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Export failed. Please try again.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileNameFromDisposition(res.headers.get('Content-Disposition'))
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        id={`export-xls-${requestId}`}
        onClick={handleExport}
        disabled={loading || !!disabledReason}
        title={disabledReason || 'Download the bank payment file (.xls) for this request'}
        className={compact ? 'btn-secondary text-xs px-3 py-2' : 'btn-secondary'}
        style={compact ? { minHeight: 36 } : undefined}
      >
        <FileSpreadsheet size={compact ? 14 : 16} /> {loading ? 'Exporting…' : 'Export XLS'}
      </button>
      {!compact && disabledReason && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{disabledReason}</p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#B91C1C' }}>{error}</p>}
    </div>
  )
}
