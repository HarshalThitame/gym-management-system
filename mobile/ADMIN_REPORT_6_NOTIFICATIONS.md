# NOTIFICATION ARCHITECTURE REPORT (Updated)

## Notification Score: 85/100

## 1. Admin Notification Types

| Category | Channel | Priority | Audience |
|----------|---------|----------|----------|
| New Lead | crm_lead | High | Gym Admin, Reception |
| Renewal Due | renewal_reminder | High | Gym Admin, Reception |
| Payment Failed | payment_failure | Urgent | Gym Admin |
| Staff Change | staff_update | Normal | Org Owner, Gym Admin |
| Low Attendance | attendance_alert | Normal | Org Owner, Gym Admin |
| Session Reminder | session_reminder | High | Trainer |
| Member Message | member_message | Normal | Trainer |

## 2. Member Notification Types (unchanged)

| Category | Channel | Priority |
|----------|---------|----------|
| Attendance Reminder | attendance_reminder | Normal |
| Renewal Reminder | renewal_reminder | High |
| Payment Receipt | payment_receipt | Normal |
| Class Update | class_booking | High |
| Trainer Message | trainer_message | High |
| System Notice | system | Normal |

## 3. Delivery Architecture

```
[Push Notification Queue Table]
  │
  ├── Admin Notifications → Org Owner / Gym Admin / Reception / Trainer
  │     ├── New lead alerts
  │     ├── Renewal due alerts  
  │     ├── Payment failure alerts
  │     └── Session reminders
  │
  └── Member Notifications → Member
        ├── Renewal reminders
        ├── Class updates
        ├── Trainer messages
        └── Payment receipts
```
