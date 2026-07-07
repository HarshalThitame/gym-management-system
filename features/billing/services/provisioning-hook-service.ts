import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/services/email/resend";
import { billingLogger } from "@/features/billing/lib/logger";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type TriggerEvent =
  | "subscription_activated" | "subscription_cancelled" | "subscription_suspended"
  | "subscription_expired" | "subscription_plan_changed"
  | "subscription_payment_failed" | "subscription_payment_recovered";

export async function executeProvisioningHooks(organizationId: string, event: TriggerEvent, payload: Record<string, unknown>): Promise<{
  triggered: number;
  succeeded: number;
  details: string[];
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: hooks } = await db.from("provisioning_hooks").select("*").limit(1000);
  const matchingHooks = (hooks ?? []).filter(
    (h) => (h.organization_id as string) === organizationId
      && (h.trigger_event as string) === event
      && (h.is_active as boolean)
  );

  let triggered = 0;
  let succeeded = 0;
  const details: string[] = [];

  for (const hook of matchingHooks) {
    triggered++;
    const hookType = hook.hook_type as string;
    const targetUrl = hook.target_url as string | null;
    const targetFunction = hook.target_function as string | null;
    const headers = (hook.headers ?? {}) as Record<string, string>;
    const hookId = hook.id as string;

    try {
      if (hookType === "webhook" && targetUrl) {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ event, organizationId, payload, timestamp: new Date().toISOString() }),
        });
        await db.from("provisioning_hooks").update({
          last_invoked_at: new Date().toISOString(),
          last_response_status: response.status,
        }).eq("id", hookId);
        succeeded++;
        details.push(`Webhook ${targetUrl}: ${response.status}`);
      } else if (hookType === "email") {
        const { data: org } = await supabase
          .from("organizations")
          .select("billing_email, name, email")
          .eq("id", organizationId)
          .maybeSingle() as never as {
          data: { billing_email: string | null; name: string; email: string | null } | null;
          error: { message: string } | null;
        };
        const recipientEmail = org?.billing_email || org?.email;
        if (recipientEmail) {
          const emailResult = await sendEmail({
            to: recipientEmail,
            subject: `[Provisioning] ${event} — ${org?.name ?? organizationId}`,
            html: `<p><strong>Event:</strong> ${event}</p><p><strong>Organization:</strong> ${org?.name ?? organizationId}</p><p><strong>Details:</strong> ${JSON.stringify(payload)}</p>`,
          });
          if (emailResult.sent) {
            await db.from("provisioning_hooks").update({
              last_invoked_at: new Date().toISOString(),
              last_response_status: 200,
            }).eq("id", hookId);
            succeeded++;
            details.push(`Email sent to ${recipientEmail}`);
          } else {
            details.push(`Email hook ${hookId}: send failed — ${emailResult.reason}`);
          }
        } else {
          details.push(`Email hook ${hookId}: no billing email for org`);
          billingLogger.warn("executeProvisioningHooks", "No billing email for org email hook", { organizationId, hookId });
        }
      } else if (hookType === "function" && targetFunction) {
        const { error: rpcError } = await supabase.rpc(targetFunction, {
          p_organization_id: organizationId,
          p_event: event,
          p_payload: payload,
        });
        if (rpcError) {
          details.push(`Function ${targetFunction}: RPC error — ${rpcError.message}`);
          billingLogger.error("executeProvisioningHooks", "Function hook RPC failed", { organizationId, hookId, targetFunction, error: rpcError.message });
        } else {
          await db.from("provisioning_hooks").update({
            last_invoked_at: new Date().toISOString(),
            last_response_status: 200,
          }).eq("id", hookId);
          succeeded++;
          details.push(`Function ${targetFunction}: executed`);
        }
      }
    } catch (err) {
      details.push(`Hook ${hookId} failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return { triggered, succeeded, details };
}
