export type PayoutRequest = {
  name: string
  upi: string
  amount: number
  date: string
  status: 'pending'
}

const PAYOUT_REQUESTS_KEY = 'payoutRequests'

export function readPayoutRequests(): PayoutRequest[] {
  try {
    const saved = window.localStorage.getItem(PAYOUT_REQUESTS_KEY)
    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((request): request is PayoutRequest => (
      typeof request === 'object'
      && request !== null
      && typeof request.name === 'string'
      && typeof request.upi === 'string'
      && typeof request.amount === 'number'
      && typeof request.date === 'string'
      && request.status === 'pending'
    ))
  } catch {
    return []
  }
}

export function savePayoutRequest(request: PayoutRequest): void {
  window.localStorage.setItem(PAYOUT_REQUESTS_KEY, JSON.stringify([
    ...readPayoutRequests(),
    request,
  ]))
}