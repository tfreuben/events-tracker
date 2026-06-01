# HubSpot Transactional Email Setup Guide

One-time setup. Repeat for each of the six touchpoints.

## Prerequisites
- HubSpot account with **Transactional Email add-on** enabled (paid add-on; check Marketing > Email > New email > Transactional appears).
- A verified sender address (e.g. `marketing@trustflight.com`) under Marketing > Email > Settings > Sender details.

## Per-template steps
1. In HubSpot: Marketing > Email > Create email > **Transactional**.
2. Pick a blank or simple layout template.
3. Name the email exactly as below (it shows up in your Northflank env vars):

   | File              | Email name in HubSpot                                  |
   |-------------------|--------------------------------------------------------|
   | `t-6mo.html`      | TF Events Alert: T-6mo Sponsorship & Abstracts         |
   | `t-3mo.html`      | TF Events Alert: T-3mo Travel & Accommodation          |
   | `t-6w.html`       | TF Events Alert: T-6w Products & Topics                |
   | `t-3w.html`       | TF Events Alert: T-3w Pre-Event Content                |
   | `t-1w.html`       | TF Events Alert: T-1w Final Logistics                  |
   | `t-post.html`     | TF Events Alert: T+1w Post-Event Wrap                  |

4. Set the **Subject line** to the value at the top of the corresponding HTML file (see `<!-- SUBJECT: ... -->`).
5. In the email editor, switch to **Source code** view (look for `</>` icon or "Edit HTML"). Replace the entire body with the contents of the matching `.html` file from this folder.
6. Set the **From name** to `TrustFlight Events Tracker` and **From address** to your verified sender (matches `ALERT_FROM_EMAIL`).
7. Save. **Do not send a test from the editor** - transactional emails need a recipient context that only the API can provide. To test, use the dry-run + live-run flow on `/alerts`.
8. Copy the numeric **email ID** from the URL (e.g. `.../edit/12345678/...`) and paste into the matching Northflank env var:

   | Touchpoint   | Northflank env var          |
   |--------------|-----------------------------|
   | T-6mo        | `HUBSPOT_TEMPLATE_T_6MO`    |
   | T-3mo        | `HUBSPOT_TEMPLATE_T_3MO`    |
   | T-6w         | `HUBSPOT_TEMPLATE_T_6W`     |
   | T-3w         | `HUBSPOT_TEMPLATE_T_3W`     |
   | T-1w         | `HUBSPOT_TEMPLATE_T_1W`     |
   | T+1w (post)  | `HUBSPOT_TEMPLATE_T_POST`   |

## About the merge fields

The HTML uses HubL syntax `{{ custom.<field_name> }}` to reference values the app sends via the single-send API. The app passes these `customProperties` keys per email:

- `event_name`, `start_date_display`, `city`, `country`, `venue`
- `business_unit`, `booth_number`
- `products_to_feature`, `pre_event_goals`
- `touchpoint_subject` (already used in the subject line)
- `action_checklist_html` (pre-rendered `<ul>` - **uses the `|safe` filter so HubL does not escape the HTML**)

If your HubSpot account renders `{{ custom.<key> }}` as a literal string (some configurations require contact-property tokens instead), open the email in HubSpot, click each placeholder, and re-bind it via **Personalize > Custom personalization token** matching the same key name. The placement and styling stay the same; only the binding syntax differs.

## Sanity check after setup

After all 6 templates are created and env vars are set, on the deployed app:

```bash
curl -X POST -H "Authorization: Bearer $ALERT_RUN_SECRET" \
  "https://p01--events-tracker--xzp2zkf8b975.code.run/api/alerts/run?dry_run=1"
```

The response will list any touchpoints due today. Then add yourself to a BU distribution list at `/alerts`, create a test event dated ~7 days out, and force-send a `T-1w`:

```bash
curl -X POST -H "Authorization: Bearer $ALERT_RUN_SECRET" \
  "https://p01--events-tracker--xzp2zkf8b975.code.run/api/alerts/run?event_id=<id>&touchpoint=T-1w"
```

Check your inbox and the `Recent sends` table at `/alerts`.
