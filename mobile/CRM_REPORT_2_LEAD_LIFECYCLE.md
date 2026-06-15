# LEAD LIFECYCLE REPORT

## Score: 93/100

## 1. Pipeline Stages

```
New → Contacted → Interested → Trial Scheduled → Trial Active → Negotiation → Converted
  ↓      ↓           ↓              ↓                ↓              ↓
Lost    Lost       Lost           Lost              Lost          Archived
```

## 2. Allowed Transitions

| From | Can Move To |
|------|-------------|
| New | contacted, lost, archived |
| Contacted | interested, trial_scheduled, lost, archived |
| Interested | trial_scheduled, negotiation, lost, archived |
| Trial Scheduled | trial_active, contacted, lost, archived |
| Trial Active | negotiation, converted, interested, lost, archived |
| Negotiation | converted, interested, lost, archived |
| Converted | archived |
| Lost | new, archived |

## 3. Conversion Flow

```
Lead (status: negotiation)
  ↓
crmConversionService.convertLeadToMember()
  ↓
1. Create Member record (with member_code)
2. Create Membership record (from plan)
3. Update Lead status → "converted"
4. Link converted_member_id
5. Add timeline event
6. Send conversion notification
```

## 4. Trial Lifecycle

```
Lead (status: trial_scheduled)
  ↓
crmTrialService.scheduleTrial()
  ↓
1. Create trial_session record
2. Update lead status → trial_scheduled
3. Add timeline event
  ↓
Trial occurs → completeTrial() or markNoShow()
  ↓
On complete → lead moves to negotiation or interested
  ↓
On conversion → lead becomes member
```
