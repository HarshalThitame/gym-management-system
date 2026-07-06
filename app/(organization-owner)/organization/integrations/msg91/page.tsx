import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Msg91Console } from "@/features/organization-owner/components/msg91-console";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getMsg91ConsoleData } from "@/features/organization-owner/services/msg91-console-service";

export const metadata = {
  title: "MSG91 Console",
  description: "Operate SMS and WhatsApp delivery through MSG91",
};

export default async function Msg91ConsolePage() {
  const context = await requireOrganizationOwner("/organization/integrations/msg91");
  const consoleData = await getMsg91ConsoleData(context.organizationId);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/organization", label: "Dashboard" },
          { href: "/organization/integrations", label: "Integrations" },
          { href: "/organization/integrations/msg91", label: "MSG91 Console" },
        ]}
      />
      <Msg91Console consoleData={consoleData} />
    </div>
  );
}

