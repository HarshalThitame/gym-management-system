import "server-only";

export type Msg91Result = {
  ok: boolean;
  status: number;
  message: string;
  responseData?: unknown;
  providerMessageId?: string;
};

export type Msg91SmsSendInput = {
  authKey: string;
  flowId: string;
  mobile: string;
  senderId?: string;
  shortUrl?: "0" | "1";
  variables?: Record<string, string>;
  callbackUrl?: string;
};

export type Msg91WhatsAppSendInput = {
  authKey: string;
  integratedNumber: string;
  recipientNumber: string;
  namespace: string;
  templateName: string;
  languageCode?: string;
  bodyVariables?: Record<string, string>;
};

const MSG91_SMS_ENDPOINT = "https://control.msg91.com/api/v5/flow/";
const MSG91_WHATSAPP_TEMPLATE_ENDPOINT = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

function normalizePhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length >= 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildMsg91Headers(authKey: string) {
  return {
    authkey: authKey,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function parseJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function validateMsg91SmsConfig(input: {
  authKey: string;
  flowId: string;
  senderId?: string;
}) {
  const errors: string[] = [];
  if (!input.authKey.trim()) errors.push("MSG91 auth key is required.");
  if (!input.flowId.trim()) errors.push("MSG91 SMS flow ID is required.");
  if (input.senderId && input.senderId.trim().length > 15) errors.push("MSG91 sender ID looks invalid.");
  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function validateMsg91WhatsAppConfig(input: {
  authKey: string;
  integratedNumber: string;
  namespace: string;
  templateName: string;
  languageCode?: string;
}) {
  const errors: string[] = [];
  if (!input.authKey.trim()) errors.push("MSG91 auth key is required.");
  if (!normalizePhone(input.integratedNumber)) errors.push("Integrated WhatsApp number is required in country-code format.");
  if (!input.namespace.trim()) errors.push("MSG91 WhatsApp namespace is required.");
  if (!input.templateName.trim()) errors.push("MSG91 WhatsApp template name is required.");
  if (input.languageCode && !/^[a-z]{2}([_-][A-Z]{2})?$/i.test(input.languageCode.trim())) {
    errors.push("WhatsApp language code looks invalid.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function sendMsg91Sms(input: Msg91SmsSendInput): Promise<Msg91Result> {
  const mobile = normalizePhone(input.mobile);
  if (!mobile) {
    return { ok: false, status: 400, message: "Recipient mobile number is required." };
  }

  const payload: Record<string, unknown> = {
    flow_id: input.flowId,
    short_url: input.shortUrl ?? "0",
    mobiles: mobile,
  };

  if (input.senderId?.trim()) {
    payload.sender = input.senderId.trim();
  }

  if (input.callbackUrl?.trim()) {
    payload.callback_url = input.callbackUrl.trim();
  }

  for (const [key, value] of Object.entries(input.variables ?? {})) {
    payload[key] = value;
  }

  const response = await fetch(MSG91_SMS_ENDPOINT, {
    method: "POST",
    headers: buildMsg91Headers(input.authKey),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseData = await parseJsonSafely(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: extractMsg91Error(responseData, "MSG91 SMS request failed."),
      responseData,
    };
  }

  const providerMessageId = responseData && typeof responseData === "object" && "request_id" in (responseData as Record<string, unknown>)
    ? String((responseData as Record<string, unknown>).request_id)
    : undefined;

  return {
    ok: true,
    status: response.status,
    message: "MSG91 SMS request accepted.",
    responseData,
    providerMessageId,
  };
}

export async function sendMsg91WhatsAppTemplate(input: Msg91WhatsAppSendInput): Promise<Msg91Result> {
  const recipientNumber = normalizePhone(input.recipientNumber);
  const integratedNumber = normalizePhone(input.integratedNumber);

  if (!recipientNumber || !integratedNumber) {
    return { ok: false, status: 400, message: "Integrated number and recipient number are required." };
  }

  const components = Object.fromEntries(
    Object.entries(input.bodyVariables ?? {}).map(([key, value]) => [
      key,
      {
        type: "text",
        value,
      },
    ]),
  );

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: input.templateName,
        language: {
          code: input.languageCode?.trim() || "en",
          policy: "deterministic",
        },
        namespace: input.namespace,
        to_and_components: [
          {
            to: [recipientNumber],
            components,
          },
        ],
      },
    },
  };

  const response = await fetch(MSG91_WHATSAPP_TEMPLATE_ENDPOINT, {
    method: "POST",
    headers: buildMsg91Headers(input.authKey),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseData = await parseJsonSafely(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: extractMsg91Error(responseData, "MSG91 WhatsApp request failed."),
      responseData,
    };
  }

  return {
    ok: true,
    status: response.status,
    message: "MSG91 WhatsApp request accepted.",
    responseData,
  };
}

export async function testMsg91Sms(input: Msg91SmsSendInput) {
  return sendMsg91Sms(input);
}

export async function testMsg91WhatsApp(input: Msg91WhatsAppSendInput) {
  return sendMsg91WhatsAppTemplate(input);
}

function extractMsg91Error(responseData: unknown, fallback: string) {
  if (!responseData) return fallback;
  if (typeof responseData === "string") return responseData;
  if (typeof responseData === "object" && responseData !== null) {
    const record = responseData as Record<string, unknown>;
    const candidates = [
      record.message,
      record.error,
      record.reason,
      record.description,
    ];
    const text = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof text === "string") return text;
  }
  return fallback;
}
