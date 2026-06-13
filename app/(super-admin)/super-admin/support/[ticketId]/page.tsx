import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTicketById } from "@/features/support/services/support-ticket-service";
import { getCustomerHealth } from "@/features/support/services/support-customer-health-service";
import { SupportTicketDetail } from "@/features/support/components/support-ticket-detail";
import { SupportCustomer360 } from "@/features/support/components/support-customer-360";
import { SupportCollaborationSidebar } from "@/features/support/components/support-collaboration-sidebar";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

async function TicketContent({ ticketId }: { ticketId: string }) {
  await requireRole(["super_admin"], "/super-admin");
  const ticket = await getTicketById(ticketId);
  if (!ticket) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: agents } = await supabase.from("profiles").select("id, full_name");
  const agentUsers = (agents ?? []).map((a) => ({ id: a.id, name: a.full_name ?? "Unknown" }));

  let customerHealth = null;
  if (ticket.customer_id && ticket.organization_id) {
    try {
      customerHealth = await getCustomerHealth(ticket.customer_id, ticket.organization_id);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <Link href="/super-admin/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Inbox
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <SupportTicketDetail ticket={ticket} users={agentUsers} />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <SupportCollaborationSidebar ticketId={ticketId} />
        </div>
        {customerHealth && (
          <div className="lg:col-span-1">
            <SupportCustomer360
              customerId={ticket.customer_id ?? ""}
              customerName={ticket.customer_name}
              customerEmail={ticket.customer_email}
              health={customerHealth}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TicketLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 h-96 bg-muted rounded-lg animate-pulse" />
        <div className="lg:col-span-1 h-64 bg-muted rounded-lg animate-pulse" />
        <div className="lg:col-span-1 h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return (
    <Suspense fallback={<TicketLoading />}>
      <TicketContent ticketId={ticketId} />
    </Suspense>
  );
}
