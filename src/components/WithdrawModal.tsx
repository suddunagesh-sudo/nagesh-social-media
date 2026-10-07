import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { requestPayout } from '../lib/supabase'

type WithdrawModalProps = {
  availableBalance: number
  onClose: () => void
  onSubmitted: () => Promise<void>
}

export default function WithdrawModal({ availableBalance, onClose, onSubmitted }: WithdrawModalProps) {
  const [name, setName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi')
  const [paymentDetails, setPaymentDetails] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const requestedAmount = Number(amount)
    if (!Number.isFinite(requestedAmount) || requestedAmount < 100) {
      setMessage('The minimum withdrawal amount is ₹100.')
      return
    }
    if (requestedAmount > availableBalance) {
      setMessage(`Your available balance is ₹${availableBalance.toFixed(2)}.`)
      return
    }
    if (paymentMethod === 'bank' && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim())) {
      setMessage('Enter a valid IFSC code.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      await requestPayout({
        name: name.trim(),
        amount: requestedAmount,
        upiOrAccount: paymentDetails.trim(),
        ifsc: paymentMethod === 'bank' ? ifsc.trim().toUpperCase() : null,
      })
      await onSubmitted()
      setSubmitted(true)
    } catch (error) {
      console.error('Withdrawal request could not be submitted:', error)
      setMessage(error instanceof Error ? error.message : 'Withdrawal request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="withdraw-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="withdraw-title" className="text-lg font-bold text-slate-900">Withdraw to Bank</h2>
            <p className="mt-1 text-sm text-slate-500">Minimum ₹100 · Available ₹{availableBalance.toFixed(2)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close withdrawal form"><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="mt-5" role="status">
            <p className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              Withdraw request sent! Bank me 24hr me ayega. Your request is pending manual processing.
            </p>
            <button type="button" onClick={onClose} className="mt-4 h-10 w-full rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">Done</button>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Account Holder Name
              <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Payment Method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'upi' | 'bank')} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15">
                <option value="upi">UPI ID</option>
                <option value="bank">Bank Account</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              {paymentMethod === 'upi' ? 'UPI ID' : 'Bank Account Number'}
              <input required minLength={paymentMethod === 'upi' ? 3 : 6} maxLength={150} value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} autoComplete="off" placeholder={paymentMethod === 'upi' ? 'name@bank' : 'Account number'} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
            </label>
            {paymentMethod === 'bank' && (
              <label className="block text-sm font-semibold text-slate-700">
                IFSC Code
                <input required maxLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} placeholder="ABCD0123456" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal uppercase outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              Amount (₹)
              <input required type="number" min="100" max={availableBalance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
            </label>
            {message && <p role="alert" className="text-sm font-medium text-rose-700">{message}</p>}
            <p className="text-xs leading-5 text-slate-500">Submitting creates a pending payout request and deducts the amount from your available balance. Payment is manually processed.</p>
            <button type="submit" disabled={submitting || availableBalance < 100} className="h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-50">{submitting ? 'Submitting...' : 'Request Withdrawal'}</button>
          </form>
        )}
      </section>
    </div>
  )
}
