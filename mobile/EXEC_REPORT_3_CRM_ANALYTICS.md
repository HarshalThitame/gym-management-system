# CRM ANALYTICS REPORT

## Score: 92/100

## 1. CRM Metrics Tracked

| Metric | Data Source | Calculation |
|--------|------------|-------------|
| Total Leads | `leads` count | Direct count |
| New Leads | `leads` where status = 'new' | Filtered count |
| Converted | `leads` where status = 'converted' | Filtered count |
| Conversion Rate | Converted / Total × 100 | Percentage |
| Follow-ups Today | `lead_followups` where status = 'pending' AND scheduled today | Filtered count |
| Follow-ups Overdue | `lead_followups` where status = 'pending' AND past due | Filtered count |
| Revenue from Leads | `leads.expected_revenue` where status = 'converted' | Sum |
| Average Conv. Days | AVG(updated_at - created_at) for converted leads | Date diff |
| Pipeline Value | SUM(expected_revenue) all active leads | Sum |
| Lead Sources | `leads.source` grouped | Count per source |

## 2. Organization-Level CRM

The `getOrgCRMAnalytics()` provides org-wide CRM metrics.
The `getGymCRMAnalytics()` provides gym-level CRM metrics.
Both are multi-tenant isolated.
