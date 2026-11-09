'use client'
import { createContext, useContext, useMemo, useState } from 'react'

// Shares what ApprovalActions is doing with the Next Task controls on the same page:
// unsaved drafts (`dirty`), an in-flight submission (`busy`), and the last action that
// saved successfully (`completed`). Lives above ApprovalActions so `completed` survives
// that component unmounting once the request leaves the user's stage. Navigating to
// another request remounts the page and resets it.
const RequestActivityContext = createContext(null)

export function RequestActivityProvider({ children }) {
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(null)

  const value = useMemo(
    () => ({ dirty, setDirty, busy, setBusy, completed, setCompleted }),
    [dirty, busy, completed]
  )
  return <RequestActivityContext.Provider value={value}>{children}</RequestActivityContext.Provider>
}

// Null outside a provider — callers treat that as "nothing to report".
export const useRequestActivity = () => useContext(RequestActivityContext)
