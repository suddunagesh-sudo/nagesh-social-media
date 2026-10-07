<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9beb0d96-6821-4041-abc4-02e9fd65010d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Before using profile photos or post/story photos, run [`supabase/add_posts_likes.sql`](supabase/add_posts_likes.sql) in the Supabase SQL Editor. It creates the public `avatars` and `post-images` buckets and their storage policies (and retains the `photos` bucket for existing uploads).

### Referral rewards and withdrawals

After applying `supabase/add_posts_likes.sql`, run [`supabase/lifetime_rewards_withdrawals.sql`](supabase/lifetime_rewards_withdrawals.sql) in the Supabase SQL Editor. This migration adds unique referral codes, grants 100 Blue Points (₹10) to both users for each referred signup, grants post owners 1 point (₹0.10) per like, and creates the owner-readable `withdrawal_requests` history with a server-side withdrawal RPC. Withdrawal requests require at least ₹100; the RPC atomically debits the available account balance and records a pending request. Rejected requests are refunded automatically. Existing requests in the legacy `"payoutRequests"` table are copied forward. Actual bank/UPI payments still require manual processing by an administrator.

If wallet or withdrawal columns differ from the expected schema, run [`supabase/final_brahmastra_fix.sql`](supabase/final_brahmastra_fix.sql) after the rewards migration. It backfills missing account rows and fixes the wallet/withdrawal columns for development. It disables RLS on `accounts` and `withdrawal_requests` as a development-only setting; do not use that setting for a public production deployment. Wallet `balance` remains numeric so fractional-rupee rewards are preserved.
