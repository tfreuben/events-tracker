export interface Touchpoint {
  code: string;
  offsetDays: number;
  subject: string;
  templateEnvKey: string;
  actions: string[];
}

export const CADENCE: Touchpoint[] = [
  {
    code: "T-6mo",
    offsetDays: -180,
    subject: "6 months out: sponsorship & abstracts",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_6MO",
    actions: [
      "Confirm sponsorship contract and payment schedule",
      "Submit speaker abstracts or proposals where applicable",
      "Confirm booth tier and lock booth_number",
    ],
  },
  {
    code: "T-3mo",
    offsetDays: -90,
    subject: "3 months out: travel & accommodation",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_3MO",
    actions: [
      "Book flights for all attending staff",
      "Book hotels (group rate where possible)",
      "Confirm staff_names is final and brief the booth designer",
    ],
  },
  {
    code: "T-6w",
    offsetDays: -42,
    subject: "6 weeks out: confirm products & topics",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_6W",
    actions: [
      "Lock products_to_feature",
      "Lock key_topics and brief the content team",
      "Pre-event landing page live with lead-capture form",
    ],
  },
  {
    code: "T-3w",
    offsetDays: -21,
    subject: "3 weeks out: pre-event content",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_3W",
    actions: [
      "Schedule LinkedIn announce posts (BU + TrustFlight)",
      "Send pre-event email to relevant customer segments",
      "Confirm lead-capture forms and badge-scan goals",
    ],
  },
  {
    code: "T-1w",
    offsetDays: -7,
    subject: "1 week out: final logistics",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_1W",
    actions: [
      "Ship booth materials and collateral",
      "Confirm booth setup window with venue",
      "Lock pre_event_goals and brief attending staff",
    ],
  },
  {
    code: "T+1w",
    offsetDays: 7,
    subject: "Post-event: notes, leads, article",
    templateEnvKey: "HUBSPOT_TEMPLATE_T_POST",
    actions: [
      "Capture post_event_notes in the tracker",
      "Import scanned leads into HubSpot and assign owners",
      "Submit WordPress article and update wordpress_article_status",
    ],
  },
];

export function getTouchpoint(code: string): Touchpoint | undefined {
  return CADENCE.find((t) => t.code === code);
}

export function renderActionChecklistHtml(actions: string[]): string {
  const items = actions
    .map(
      (a) =>
        `<li style="margin:0 0 8px 0;color:#0f172a;font-size:14px;line-height:1.55;">${escapeHtml(a)}</li>`
    )
    .join("");
  return `<ul style="margin:0;padding:0 0 0 20px;list-style:disc;">${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
