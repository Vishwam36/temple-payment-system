'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{color:'var(--text-primary)'}}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" style={{color:'var(--text-muted)',minHeight:36,minWidth:36,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
