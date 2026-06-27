import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export type ResendDnsRecord = {
  type: string;
  name: string;
  value: string;
  priority?: number;
  status: string;
};

export type ResendDomain = {
  id: string;
  name: string;
  status: string;
  records: ResendDnsRecord[];
  createdAt: string;
  region: string;
};

type ResendApiResponse<T> = {
  data: T | null;
  error: string | null;
};

export async function addSendingDomain(domain: string): Promise<ResendApiResponse<ResendDomain>> {
  const resend = getResendClient();
  if (!resend) return { data: null, error: "Resend is not configured." };

  try {
    const { data, error } = await resend.domains.create({ name: domain });
    if (error || !data) return { data: null, error: error?.message ?? "Failed to create domain in Resend." };

    return {
      data: {
        id: data.id,
        name: data.name,
        status: data.status,
        records: (data.records ?? []) as unknown as ResendDnsRecord[],
        createdAt: data.created_at,
        region: data.region,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to add sending domain." };
  }
}

export async function verifySendingDomain(domainId: string): Promise<ResendApiResponse<{ id: string }>> {
  const resend = getResendClient();
  if (!resend) return { data: null, error: "Resend is not configured." };

  try {
    const { data, error } = await resend.domains.verify(domainId);
    if (error || !data) return { data: null, error: error?.message ?? "Failed to verify domain in Resend." };

    return { data: { id: data.id }, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to verify sending domain." };
  }
}

export async function getSendingDomain(domainId: string): Promise<ResendApiResponse<ResendDomain>> {
  const resend = getResendClient();
  if (!resend) return { data: null, error: "Resend is not configured." };

  try {
    const { data, error } = await resend.domains.get(domainId);
    if (error || !data) return { data: null, error: error?.message ?? "Failed to get domain from Resend." };

    return {
      data: {
        id: data.id,
        name: data.name,
        status: data.status,
        records: (data.records ?? []) as unknown as ResendDnsRecord[],
        createdAt: data.created_at,
        region: data.region,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to get sending domain." };
  }
}

export async function getSendingDomains(): Promise<ResendApiResponse<ResendDomain[]>> {
  const resend = getResendClient();
  if (!resend) return { data: null, error: "Resend is not configured." };

  try {
    const { data, error } = await resend.domains.list();
    if (error || !data) return { data: null, error: error?.message ?? "Failed to list domains from Resend." };

    const mapped: ResendDomain[] = (data.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      records: [],
      createdAt: d.created_at,
      region: d.region,
    }));

    return { data: mapped, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to list sending domains." };
  }
}

export async function removeSendingDomain(domainId: string): Promise<ResendApiResponse<null>> {
  const resend = getResendClient();
  if (!resend) return { data: null, error: "Resend is not configured." };

  try {
    const { error } = await resend.domains.remove(domainId);
    if (error) return { data: null, error: error.message };

    return { data: null, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to remove sending domain." };
  }
}
