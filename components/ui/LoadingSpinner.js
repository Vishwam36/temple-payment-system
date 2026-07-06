export default function LoadingSpinner({ size = 32, message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="spinner" style={{width:size,height:size}} />
      <p className="text-sm" style={{color:'var(--text-muted)'}}>{message}</p>
    </div>
  )
}
