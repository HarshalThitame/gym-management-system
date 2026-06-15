# EXECUTIVE ANALYTICS REPORT

## Score: 93/100

## 1. Analytics Modules

| Module | Service | Screens | KPIs |
|--------|---------|---------|------|
| Executive Dashboard | executive-analytics-service | 1 (overhauled) | Revenue (today/month/year/growth/forecast), Members (total/active/expired/frozen/new/churn/retention), Attendance (today/month/avg/peak/compliance), CRM (total/new/converted/rate/followups), Health Score, Subscription |
| Revenue Analytics | revenue-analytics-service | 1 | Daily/weekly/monthly trends, by method, by type, growth, forecast, projections |
| Membership Analytics | membership-analytics-service | 1 | Lifecycle (active/expired/frozen/cancelled), churn, retention, by-plan, monthly trends, avg duration |
| Branch Analytics | branch-analytics-service | 1 | Cross-branch revenue, members, attendance, leads, conversions, rankings, performance scores |
| Trainer Analytics | trainer-analytics-service | 1 | Assigned members, sessions, retention, attendance rate, performance scores, rankings |
| Financial Analytics | financial-analytics-service | 1 | Collected, pending, overdue, refunded, revenue breakdown, leakage risk |
| Subscription Analytics | subscription-analytics-service | 1 | Plan tier, usage bars, limit warnings, feature enablement, upgrade recommendations |
| AI Insights | ai-insights-service | 1 | Revenue/membership/attendance/CRM trends, anomaly detection, actionable recommendations |
| Organization Health | (composite) | Embedded | 5-factor score (revenue, retention, CRM, attendance, activity) |

## 2. Health Score Formula

```
Health Score = (
  Revenue Growth (0-20) +
  Member Retention (0-20) + 
  CRM Conversion (0-20) +
  Attendance Compliance (0-20) +
  Active Members (0-20)
) / 5

Levels: 80+ Excellent, 60-79 Good, 40-59 Average, <40 At Risk
```
