import { useEffect, useState } from 'react'
import type { Invoice } from '../types/invoice'

export type InvoicesLoad =
  | { status: 'loading' }
  | { status: 'ready'; invoices: Invoice[] }
  | { status: 'error'; message: string }

export const useInvoices = () => {
  const [load, setLoad] = useState<InvoicesLoad>({ status: 'loading' })

  useEffect(() => {
    fetch('/invoices.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data: { invoices: Invoice[] }) =>
        setLoad({ status: 'ready', invoices: data.invoices }),
      )
      .catch((error: Error) => setLoad({ status: 'error', message: error.message }))
  }, [])

  return load
}
