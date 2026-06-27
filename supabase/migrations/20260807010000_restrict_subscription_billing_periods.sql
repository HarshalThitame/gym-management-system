alter table packages drop constraint if exists packages_billing_period_check;
alter table packages add constraint packages_billing_period_check check (billing_period in ('monthly', 'annual'));

alter table organization_subscriptions drop constraint if exists organization_subscriptions_billing_period_check;
alter table organization_subscriptions add constraint organization_subscriptions_billing_period_check check (billing_period in ('monthly', 'annual'));

alter table package_pricing drop constraint if exists package_pricing_billing_period_check;
alter table package_pricing add constraint package_pricing_billing_period_check check (billing_period in ('monthly', 'annual'));

alter table subscription_requests drop constraint if exists subscription_requests_requested_billing_period_check;
alter table subscription_requests add constraint subscription_requests_requested_billing_period_check check (requested_billing_period in ('monthly', 'annual'));

alter table org_subscription_invoices drop constraint if exists org_subscription_invoices_billing_cycle_check;
alter table org_subscription_invoices add constraint org_subscription_invoices_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));

alter table payment_attempts drop constraint if exists payment_attempts_billing_period_check;
alter table payment_attempts add constraint payment_attempts_billing_period_check check (billing_period in ('monthly', 'annual'));
