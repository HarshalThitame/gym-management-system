import { renderBrandedEmail } from "./auth";
import { absoluteUrl } from "@/lib/utils";

export function trialStartingReminder(input: {
  orgName: string;
  daysLeft: number;
  trialEndsAt: string;
  planName: string;
}) {
  const date = new Date(input.trialEndsAt).toLocaleDateString("en-IN", {
    dateStyle: "long",
  });
  const urgency = input.daysLeft <= 3
    ? `<p style="color:#dc2626;font-weight:800">Your trial ends in ${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"}. Set up billing to avoid service interruption.</p>`
    : `<p>Your trial for <strong>${input.planName}</strong> ends on ${date}.</p>`;

  return renderBrandedEmail({
    title: `${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"} of trial remaining`,
    preview: `${input.orgName} — trial ending soon`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      ${urgency}
      <p style="margin:12px 0 0">Add a payment method and select a plan before the trial ends to keep your services active.</p>
    `,
    ctaLabel: "Manage Subscription",
    ctaUrl: absoluteUrl("/organization/plan"),
  });
}

export function trialExpiredNotification(input: {
  orgName: string;
  planName: string;
}) {
  return renderBrandedEmail({
    title: "Your trial has ended",
    preview: `${input.orgName} — trial expired`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">Your trial for <strong>${input.planName}</strong> has ended. Some features may be limited until you subscribe to a plan.</p>
      <p style="margin:0">You can still upgrade within 30 days to recover your data and settings.</p>
    `,
    ctaLabel: "Choose a Plan",
    ctaUrl: absoluteUrl("/organization/plan"),
  });
}

export function dunningFirstAttempt(input: {
  orgName: string;
  planName: string;
  amount: number;
  dueDate: string;
}) {
  return renderBrandedEmail({
    title: "Payment failed — action needed",
    preview: `${input.orgName} — payment failed`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">We attempted to charge <strong>₹${input.amount.toLocaleString("en-IN")}</strong> for your <strong>${input.planName}</strong> subscription on ${new Date(input.dueDate).toLocaleDateString("en-IN", { dateStyle: "long" })} but the payment did not go through.</p>
      <p style="margin:0 0 12px">We will retry in 3 days. Update your payment method to avoid service disruption.</p>
      <p style="margin:0;color:#737780;font-size:13px">If the payment fails after 3 attempts, your subscription will be suspended.</p>
    `,
    ctaLabel: "Update Payment Method",
    ctaUrl: absoluteUrl("/organization/billing"),
  });
}

export function dunningSecondAttempt(input: {
  orgName: string;
  planName: string;
  amount: number;
  daysOverdue: number;
}) {
  return renderBrandedEmail({
    title: "Payment still overdue — 2nd notice",
    preview: `${input.orgName} — payment overdue`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">It has been ${input.daysOverdue} days since your <strong>${input.planName}</strong> payment of <strong>₹${input.amount.toLocaleString("en-IN")}</strong> failed.</p>
      <p style="margin:0 0 12px;color:#dc2626;font-weight:700">This is your second notice. We will retry once more in 5 days. After that, your subscription will be suspended.</p>
      <p style="margin:0">Please update your billing information to continue uninterrupted service.</p>
    `,
    ctaLabel: "Update Payment Method",
    ctaUrl: absoluteUrl("/organization/billing"),
  });
}

export function dunningFinalAttempt(input: {
  orgName: string;
  planName: string;
  amount: number;
  daysOverdue: number;
}) {
  return renderBrandedEmail({
    title: "Final notice — subscription will be suspended",
    preview: `${input.orgName} — final payment notice`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px;color:#dc2626;font-weight:800">⚠️ Final payment notice</p>
      <p style="margin:0 0 12px">Your <strong>${input.planName}</strong> payment of <strong>₹${input.amount.toLocaleString("en-IN")}</strong> is ${input.daysOverdue} days overdue. This is our third and final attempt.</p>
      <p style="margin:0 0 12px;color:#dc2626;font-weight:700">Your subscription will be suspended after this attempt if the payment continues to fail.</p>
      <p style="margin:0">Reactivate anytime by clearing the outstanding balance and updating your payment method.</p>
    `,
    ctaLabel: "Pay Now",
    ctaUrl: absoluteUrl("/organization/billing"),
  });
}

export function subscriptionSuspendedNotification(input: {
  orgName: string;
  planName: string;
}) {
  return renderBrandedEmail({
    title: "Your subscription has been suspended",
    preview: `${input.orgName} — subscription suspended`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">Your <strong>${input.planName}</strong> subscription has been suspended due to non-payment.</p>
      <p style="margin:0 0 12px">Your data will be retained for 30 days. Reactivate your subscription to restore full access.</p>
      <p style="margin:0">If you need help, contact our support team.</p>
    `,
    ctaLabel: "Reactivate Subscription",
    ctaUrl: absoluteUrl("/organization/plan"),
  });
}

export function paymentRecoveredNotification(input: {
  orgName: string;
  planName: string;
}) {
  return renderBrandedEmail({
    title: "Payment recovered — subscription restored",
    preview: `${input.orgName} — payment successful`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">Great news — your <strong>${input.planName}</strong> payment has been recovered and your subscription is now active.</p>
      <p style="margin:0">Thank you for your continued partnership.</p>
    `,
    ctaLabel: "View Dashboard",
    ctaUrl: absoluteUrl("/organization"),
  });
}

export function subscriptionInvoiceNotification(input: {
  orgName: string;
  planName: string;
  amount: number;
  dueDate: string;
  invoiceNumber: string;
  paymentLink: string;
}) {
  return renderBrandedEmail({
    title: `Invoice #${input.invoiceNumber} — payment due`,
    preview: `${input.orgName} — invoice ready`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">Your <strong>${input.planName}</strong> subscription invoice <strong>#${input.invoiceNumber}</strong> for <strong>₹${input.amount.toLocaleString("en-IN")}</strong> is ready.</p>
      <p style="margin:0 0 12px">Due date: ${new Date(input.dueDate).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
      <p style="margin:0">Click below to complete your payment securely via Razorpay.</p>
    `,
    ctaLabel: "Pay Invoice",
    ctaUrl: input.paymentLink,
  });
}

export function subscriptionExpiryWarning(input: {
  orgName: string;
  daysUntilExpiry: number;
  planName: string;
  expiresAt: string;
}) {
  const date = new Date(input.expiresAt).toLocaleDateString("en-IN", {
    dateStyle: "long",
  });

  return renderBrandedEmail({
    title: `${input.planName} subscription expiring soon`,
    preview: `${input.orgName} — subscription ends ${date}`,
    body: `
      <p style="margin:0 0 12px">Hi <strong>${input.orgName}</strong> team,</p>
      <p style="margin:0 0 12px">Your <strong>${input.planName}</strong> subscription will expire in <strong>${input.daysUntilExpiry} day${input.daysUntilExpiry === 1 ? "" : "s"}</strong> (${date}).</p>
      <p style="margin:0">Renew now to maintain uninterrupted access to all features and services.</p>
    `,
    ctaLabel: "Renew Subscription",
    ctaUrl: absoluteUrl("/organization/plan"),
  });
}
