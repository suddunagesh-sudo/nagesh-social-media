import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { readPayoutRequests } from '../payoutRequests'

export default function AdminPayouts() {
  const [requests] = useState(readPayoutRequests)

  return (
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-8 text-slate-800 sm:px-7">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white">
          <ArrowLeft size={17} /> Back to Nagesh Social
        </a>
        <header className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Payout requests</h1>
          </div>
          <span className="text-sm font-semibold text-slate-500">{requests.length} pending</span>
        </header>

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          Real requests come on WhatsApp +91 77258 03084. This page only lists requests stored in this browser; it cannot receive requests from other users or initiate bank transfers.
        </p>

        {requests.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
            <h2 className="font-semibold text-slate-900">No payout requests found</h2>
            <p className="mt-1 text-sm text-slate-500">Requests saved in this browser will appear here.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">UPI</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...requests].reverse().map((request, index) => {
                  const message = `Payout request for ${request.name}: ₹${request.amount.toFixed(2)} to ${request.upi} (${new Date(request.date).toLocaleString()})`
                  return (
                    <tr key={`${request.date}-${index}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{request.name}</td>
                      <td className="px-4 py-3">{request.upi}</td>
                      <td className="px-4 py-3 font-bold text-teal-800">₹{request.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(request.date).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800">
                          <MessageCircle size={15} /> WhatsApp
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}