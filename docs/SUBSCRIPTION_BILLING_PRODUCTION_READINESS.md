# Subscription Billing Production Readiness

## Environment Variables

```env
# Active environment (test or live)
RAZORPAY_ENV=test

# Test Mode (preferred vars)
RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_SECRET=xxxxx
NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_WEBHOOK_SECRET=xxxxx

# Live Mode (preferred vars)
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxx
RAZORPAY_LIVE_KEY_SECRET=xxxxx
NEXT_PUBLIC_RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxx
RAZORPAY_LIVE_WEBHOOK_SECRET=xxxxx

# Legacy fallback (works for both modes if preferred vars not set)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# Billing cron
CRON_SECRET=your-cron-secret
```

## Razorpay Dashboard Setup

1. Go to https://dashboard.razorpay.com
2. Settings → Webhooks → Add Webhook
3. Webhook URL: `https://your-domain.com/api/webhooks/razorpay`
4. Select events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
5. Copy webhook secret to `RAZORPAY_WEBHOOK_SECRET` (or `RAZORPAY_TEST_WEBHOOK_SECRET`)

## Test Mode Payment Flow

1. Super Admin creates Starter/Growth package
2. Organization Owner visits `/organization/plan`
3. Selects package + billing cycle
4. Clicks Pay → Razorpay Checkout opens (test cards)
5. Payment verified → invoice paid, subscription active
6. Entitlements synced

## Live Mode Activation

1. Set `RAZORPAY_ENV=live`
2. Ensure `RAZORPAY_LIVE_KEY_ID` and `RAZORPAY_LIVE_KEY_SECRET` are set
3. Verify `NEXT_PUBLIC_RAZORPAY_LIVE_KEY_ID` matches
4. Update webhook URL in Razorpay dashboard
5. Update `RAZORPAY_LIVE_WEBHOOK_SECRET`
6. Run `validateRazorpayEnvironmentConfig()` check
7. Test with a real ₹1 payment first

## Production Safety Checklist

- [ ] `RAZORPAY_ENV=live`
- [ ] Live key IDs start with `rzp_live_`
- [ ] Public key matches server key
- [ ] Webhook URL is HTTPS
- [ ] Webhook events configured
- [ ] `CRON_SECRET` is set
- [ ] Billing cron is enabled
- [ ] Invoice PDF route is accessible
- [ ] No secret keys in frontend code
- [ ] No admin DB client in client components
- [ ] Organization Owner can only view own invoices
- [ ] Super Admin can access all

## Rollback Plan

1. Set `RAZORPAY_ENV=test`
2. Verify test keys work
3. Test payment flow with test card
4. Confirm no live charges

## Known Risks

- No refund automation (manual Razorpay dashboard refund)
- No dispute management (manual handling)
- No auto dunning suspension (Super Admin manual action required)
- Webhook endpoint must be publicly accessible
