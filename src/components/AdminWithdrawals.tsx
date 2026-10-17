import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SITE_OWNER_NAME = 'Chhavinath Nagesh'

type Withdrawal = {
  id: string
  userName: string
  amount: number
  upiId: string
  ifsc: string | null
  createdAt: string
  status: 'pending' | 'approved'
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const loadPendingWithdrawals = useCallback(async () => {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('id, user_id, amount, upi_id, ifsc, status, created_at, profiles(full_name)')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true })
    if (error) throw error

    setWithdrawals((data ?? []).map((row) => {
      const relatedProfile = row.profiles
      const profileRow = Array.isArray(relatedProfile) ? relatedProfile[0] : relatedProfile
      return {
        id: row.id,
        userName: profileRow?.full_name ?? 'Unknown user',
        amount: Number(row.amount),
        upiId: row.upi_id,
        ifsc: row.ifsc,
        createdAt: row.created_at,
        status: row.status,
      }
    }))
  }, [])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    const initialize = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const userId = authData.user?.id
        if (!userId) {
          setAuthorized(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single()
        if (profileError) throw profileError
        if (profile.full_name !== SITE_OWNER_NAME) {
          setAuthorized(false)
          return
        }

        setAuthorized(true)
        await loadPendingWithdrawals()
        if (!active) return
        channel = supabase.channel('admin-withdrawals')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => {
            void loadPendingWithdrawals().catch((error: unknown) => {
              console.error('Withdrawal requests could not be refreshed:', error)
              setErrorMessage(error instanceof Error ? error.message : 'Withdrawal requests could not be refreshed.')
            })
          })
          .subscribe()
      } catch (error) {
        console.error('Admin withdrawals could not be loaded:', error)
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Withdrawal requests could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialize()
    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [loadPendingWithdrawals])

  const updateWithdrawalStatus = async (id: string, status: 'approved' | 'paid' | 'rejected', currentStatus: 'pending' | 'approved') => {
    const prompt = status === 'paid'
      ? 'Confirm that you have manually sent the payment before marking this request paid.'
      : status === 'approved'
        ? 'Approve this withdrawal for manual payment?'
        : 'Reject this withdrawal and release the reserved balance?'
    if (!window.confirm(prompt)) return
    setPendingId(id)
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .update({ status })
        .eq('id', id)
        .eq('status', currentStatus)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Withdrawal is no longer pending or you are not authorized.')
      await loadPendingWithdrawals()
      setErrorMessage('')
    } catch (error) {
      console.error('Withdrawal status could not be updated:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Withdrawal status could not be updated.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-8 text-slate-800 sm:px-7">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white">
          <ArrowLeft size={17} /> Back to Nagesh Social
        </a>
        <header className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Owner Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Withdrawal requests</h1>
          </div>
          <span className="text-sm font-semibold text-slate-500">{withdrawals.filter((request) => request.status === 'pending').length} pending</span>
        </header>

        {errorMessage && <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</p>}
        {!loading && !errorMessage && !authorized ? (
          <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">This dashboard is available only to the site owner.</p>
        ) : loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading withdrawal requests…</p>
        ) : authorized && withdrawals.length === 0 && !errorMessage ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
            <h2 className="font-semibold text-slate-900">No pending withdrawal requests</h2>
          </div>
        ) : authorized && withdrawals.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 font-bold">UPI / Bank account</th>
                  <th className="px-4 py-3 font-bold">IFSC</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Requested</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{withdrawal.userName}</td>
                    <td className="px-4 py-3">{withdrawal.upiId}</td>
                    <td className="px-4 py-3">{withdrawal.ifsc ?? '—'}</td>
                    <td className="px-4 py-3 font-bold text-teal-800">₹{withdrawal.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(withdrawal.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{withdrawal.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {withdrawal.status === 'pending' ? <button type="button" onClick={() => void updateWithdrawalStatus(withdrawal.id, 'approved', withdrawal.status)} disabled={pendingId === withdrawal.id} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 size={15} /> Approve</button> : <button type="button" onClick={() => void updateWithdrawalStatus(withdrawal.id, 'paid', withdrawal.status)} disabled={pendingId === withdrawal.id} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 size={15} /> Mark paid</button>}
                        <button type="button" onClick={() => void updateWithdrawalStatus(withdrawal.id, 'rejected', withdrawal.status)} disabled={pendingId === withdrawal.id} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={15} /> Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-500">Approve a request before manually sending payment. Mark approved requests paid only after the transfer is complete. Rejecting releases the reserved balance; this dashboard does not initiate transfers.</p>
      </div>
    </main>
  )
}
