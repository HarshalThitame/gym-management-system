# Sales Pipeline Engine — Report

## Service: `features/crm/services/sales-pipeline.ts`

| Function | Purpose |
|----------|---------|
| `createLead()` | Create new lead with default status, source lookup |
| `updateLeadStatus()` | Move lead through pipeline (converted, lost, etc.) |
| `assignLead()` | Assign lead to staff member |
| `createFollowUp()` | Schedule follow-up (call, WhatsApp, email, meeting, trial) |
| `completeFollowUp()` | Mark follow-up completed |
| `convertLeadToMember()` | Full conversion: lead → member creation + status update + linking |
| `getPipelineSummary()` | Pipeline analytics by stage |
| `getDailyTasks()` | Task summary (overdue, today, completed, pending) |

## Lead Lifecycle (Engine-Enforced)

```
createLead("new")
    ↓
updateLeadStatus("contacted")
    ↓
updateLeadStatus("interested")
    ↓
createFollowUp({ action: "trial_scheduled" })
    ↓
updateLeadStatus("trial_active")
    ↓
updateLeadStatus("negotiation")
    ↓
convertLeadToMember() → creates member, links lead, sets "converted"
```

## Follow-Up Types Supported
Call, WhatsApp, Email, Meeting, Trial, Renewal — stored as `action` text, extensible.

## Conversion Flow
```
Lead → convertLeadToMember() → Member created in `members` table
    → Lead status set to "converted"
    → converted_member_id linked
    → Audit log: "crm.lead_converted_to_member"
```

## Verdict: **PASS** ✅
