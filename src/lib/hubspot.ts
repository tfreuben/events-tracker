const SINGLE_SEND_URL =
  "https://api.hubapi.com/marketing/v3/transactional/single-email/send";

export interface SendTransactionalArgs {
  emailId: string;
  to: string;
  from?: string;
  customProperties: Record<string, string | number | null>;
}

export interface SendTransactionalResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendTransactional(
  args: SendTransactionalArgs
): Promise<SendTransactionalResult> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return { ok: false, error: "HUBSPOT_PRIVATE_APP_TOKEN not set" };
  }

  const from = args.from || process.env.ALERT_FROM_EMAIL;
  if (!from) {
    return { ok: false, error: "ALERT_FROM_EMAIL not set" };
  }

  const payload = {
    emailId: Number(args.emailId),
    message: {
      to: args.to,
      from,
    },
    customProperties: Object.fromEntries(
      Object.entries(args.customProperties).map(([k, v]) => [
        k,
        v == null ? "" : String(v),
      ])
    ),
  };

  try {
    const res = await fetch(SINGLE_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HubSpot ${res.status}: ${text.slice(0, 500)}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
