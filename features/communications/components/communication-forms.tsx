"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type {
  AnnouncementRow,
  CampaignRow,
  CommunicationAutomationRuleRow,
  CommunicationSegmentRow,
  NotificationPreferenceRow,
  NotificationRow,
  NotificationTemplateRow
} from "@/types/communications";
import type { MemberRow } from "@/types/membership";
import type { TrainerRow } from "@/types/training";
import {
  announcementCategories,
  announcementStatuses,
  automationTriggerKeys,
  campaignStatuses,
  campaignTypes,
  communicationCategories,
  notificationPriorities,
  outboundChannels,
  templateStatuses
} from "@/types/communications";
import {
  createDirectNotificationAction,
  dispatchCampaignAction,
  runAutomationRuleAction,
  saveAnnouncementAction,
  saveAutomationRuleAction,
  saveCampaignAction,
  saveCommunicationSegmentAction,
  saveNotificationPreferencesAction,
  saveNotificationTemplateAction,
  updateNotificationStateAction
} from "../actions/communication-actions";
import { formatCommunicationLabel } from "../lib/business-rules";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

type Option = {
  value: string;
  label: string;
};

export function NotificationTemplateForm({ templates }: { templates: NotificationTemplateRow[] }) {
  const [state, formAction] = useActionState(saveNotificationTemplateAction, initialAuthActionState);
  const editableTemplates = templates.filter((template) => !template.is_system);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="templateId" defaultValue="" aria-label="Template to edit">
        <option value="">Create new template</option>
        {editableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="template-name" label="Template name" name="name" state={state}><Input id="template-name" name="name" placeholder="Renewal reminder - 7 days" /></Field>
        <Field id="template-slug" label="Slug" name="slug" state={state}><Input id="template-slug" name="slug" placeholder="renewal-reminder-7-days" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Category" name="category" options={communicationCategories.map(optionFromValue)} />
        <SelectField label="Channel" name="channel" options={["in_app", "email", "whatsapp", "sms", "push"].map(optionFromValue)} />
        <SelectField label="Status" name="status" options={templateStatuses.map(optionFromValue)} />
      </div>
      <Field id="template-subject" label="Subject" name="subject" state={state}><Input id="template-subject" name="subject" placeholder="Your membership expires soon" /></Field>
      <Field id="template-body-text" label="Plain text body" name="bodyText" state={state}>
        <Textarea id="template-body-text" name="bodyText" placeholder="Hi {{member_name}}, your membership expires on {{expiry_date}}." />
      </Field>
      <Field id="template-body-html" label="HTML body" name="bodyHtml" state={state}>
        <Textarea id="template-body-html" name="bodyHtml" placeholder="<p>Hi {{member_name}}, renew before {{expiry_date}}.</p>" />
      </Field>
      <Field id="template-variables" label="Variables" name="variables" state={state}>
        <Input id="template-variables" name="variables" placeholder="member_name, expiry_date, plan_name" />
      </Field>
      <AuthSubmitButton>Save Template</AuthSubmitButton>
    </form>
  );
}

export function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferenceRow | null }) {
  const [state, formAction] = useActionState(saveNotificationPreferencesAction, initialAuthActionState);
  const categories = categoryPreferenceRecord(preferences);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Check name="emailEnabled" label="Email notifications" checked={preferences?.email_enabled ?? true} />
        <Check name="whatsappEnabled" label="WhatsApp notifications" checked={preferences?.whatsapp_enabled ?? true} />
        <Check name="smsEnabled" label="SMS notifications" checked={preferences?.sms_enabled ?? false} />
        <Check name="pushEnabled" label="Push notifications" checked={preferences?.push_enabled ?? true} />
        <Check name="marketingOptIn" label="Promotional updates" checked={preferences?.marketing_opt_in ?? false} />
        <Check name="transactionalOptIn" label="Transactional updates" checked={preferences?.transactional_opt_in ?? true} />
        <Check name="whatsappOptIn" label="WhatsApp consent" checked={preferences?.whatsapp_opt_in ?? true} />
        <Check name="smsOptIn" label="SMS consent" checked={preferences?.sms_opt_in ?? false} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="quiet-start" label="Quiet hours start" name="quietHoursStart" state={state}><Input id="quiet-start" name="quietHoursStart" type="time" defaultValue={preferences?.quiet_hours_start ?? ""} /></Field>
        <Field id="quiet-end" label="Quiet hours end" name="quietHoursEnd" state={state}><Input id="quiet-end" name="quietHoursEnd" type="time" defaultValue={preferences?.quiet_hours_end ?? ""} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {communicationCategories.map((category) => (
          <Check key={category} name={category} label={`${formatCommunicationLabel(category)} category`} checked={categories[category]} />
        ))}
      </div>
      <AuthSubmitButton>Save Preferences</AuthSubmitButton>
    </form>
  );
}

export function NotificationStateForm({ notification, compact = false }: { notification: NotificationRow; compact?: boolean }) {
  const [state, formAction] = useActionState(updateNotificationStateAction, initialAuthActionState);
  return (
    <form action={formAction} className={compact ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
      <FormMessage state={state} />
      <input name="notificationId" type="hidden" value={notification.id} />
      <input name="nextStatus" type="hidden" value={notification.status === "archived" ? "read" : "read"} />
      <Button size="sm" type="submit" variant="secondary">Mark Read</Button>
    </form>
  );
}

export function ArchiveNotificationForm({ notification }: { notification: NotificationRow }) {
  const [state, formAction] = useActionState(updateNotificationStateAction, initialAuthActionState);
  return (
    <form action={formAction} className="inline-flex">
      <FormMessage state={state} />
      <input name="notificationId" type="hidden" value={notification.id} />
      <input name="nextStatus" type="hidden" value="archived" />
      <Button size="sm" type="submit" variant="ghost">Archive</Button>
    </form>
  );
}

export function AnnouncementForm({ segments, announcements }: { segments: CommunicationSegmentRow[]; announcements: AnnouncementRow[] }) {
  const [state, formAction] = useActionState(saveAnnouncementAction, initialAuthActionState);
  const editable = announcements.slice(0, 12);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="announcementId" defaultValue="" aria-label="Announcement to edit">
        <option value="">Create new announcement</option>
        {editable.map((announcement) => <option key={announcement.id} value={announcement.id}>{announcement.title}</option>)}
      </select>
      <Field id="announcement-title" label="Title" name="title" state={state}><Input id="announcement-title" name="title" placeholder="Holiday training hours" /></Field>
      <Field id="announcement-body" label="Body" name="body" state={state}><Textarea id="announcement-body" name="body" placeholder="Publish a concise gym notice with clear dates and impact." /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Category" name="category" options={announcementCategories.map(optionFromValue)} />
        <SelectField label="Priority" name="priority" options={notificationPriorities.map(optionFromValue)} />
        <SelectField label="Status" name="status" options={announcementStatuses.map(optionFromValue)} />
        <select className={selectClass} name="targetSegment" defaultValue="all_members" aria-label="Target segment">
          {segmentOptions(segments).map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="announcement-starts" label="Starts" name="startsAt" state={state}><Input id="announcement-starts" name="startsAt" type="datetime-local" /></Field>
        <Field id="announcement-ends" label="Ends" name="endsAt" state={state}><Input id="announcement-ends" name="endsAt" type="datetime-local" /></Field>
      </div>
      <Check name="pinned" label="Pin this announcement" checked={false} />
      <AuthSubmitButton>Save Announcement</AuthSubmitButton>
    </form>
  );
}

export function CommunicationSegmentForm({ segments }: { segments: CommunicationSegmentRow[] }) {
  const [state, formAction] = useActionState(saveCommunicationSegmentAction, initialAuthActionState);
  const editable = segments.filter((segment) => !segment.is_system);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="segmentId" defaultValue="" aria-label="Segment to edit">
        <option value="">Create new segment</option>
        {editable.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="segment-name" label="Name" name="name" state={state}><Input id="segment-name" name="name" placeholder="Morning HIIT members" /></Field>
        <Field id="segment-key" label="Segment key" name="segmentKey" state={state}><Input id="segment-key" name="segmentKey" placeholder="morning_hiit_members" /></Field>
      </div>
      <Field id="segment-description" label="Description" name="description" state={state}><Textarea id="segment-description" name="description" placeholder="Who this segment targets and how it should be used." /></Field>
      <Field id="segment-definition" label="Definition JSON" name="definition" state={state}><Textarea id="segment-definition" name="definition" defaultValue='{"type":"manual"}' /></Field>
      <SelectField label="Status" name="status" options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
      <AuthSubmitButton>Save Segment</AuthSubmitButton>
    </form>
  );
}

export function CampaignForm({ campaigns, templates, segments }: { campaigns: CampaignRow[]; templates: NotificationTemplateRow[]; segments: CommunicationSegmentRow[] }) {
  const [state, formAction] = useActionState(saveCampaignAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="campaignId" defaultValue="" aria-label="Campaign to edit">
        <option value="">Create new campaign</option>
        {campaigns.slice(0, 20).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="campaign-name" label="Campaign name" name="name" state={state}><Input id="campaign-name" name="name" placeholder="Annual renewal push" /></Field>
        <SelectField label="Campaign type" name="campaignType" options={campaignTypes.map(optionFromValue)} />
      </div>
      <Field id="campaign-description" label="Description" name="description" state={state}><Textarea id="campaign-description" name="description" placeholder="Campaign objective, audience, and expected action." /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Category" name="category" options={communicationCategories.map(optionFromValue)} />
        <select className={selectClass} name="templateId" defaultValue="" aria-label="Template">
          <option value="">No template</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({formatCommunicationLabel(template.channel)})</option>)}
        </select>
        <select className={selectClass} name="segmentId" defaultValue="" aria-label="Segment id">
          <option value="">Segment by key only</option>
          {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
        </select>
        <select className={selectClass} name="segmentKey" defaultValue="all_members" aria-label="Segment">
          {segmentOptions(segments).map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Status" name="status" options={campaignStatuses.map(optionFromValue)} />
        <Field id="campaign-scheduled" label="Scheduled for" name="scheduledFor" state={state}><Input id="campaign-scheduled" name="scheduledFor" type="datetime-local" /></Field>
      </div>
      <AuthSubmitButton>Save Campaign</AuthSubmitButton>
    </form>
  );
}

export function CampaignDispatchForm({ campaign }: { campaign: CampaignRow }) {
  const [state, formAction] = useActionState(dispatchCampaignAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="campaignId" type="hidden" value={campaign.id} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button name="mode" type="submit" value="queue" variant="secondary">Queue</Button>
        <Button name="mode" type="submit" value="send_now" variant="accent">Send Now</Button>
      </div>
    </form>
  );
}

export function AutomationRuleForm({ rules, templates, segments }: { rules: CommunicationAutomationRuleRow[]; templates: NotificationTemplateRow[]; segments: CommunicationSegmentRow[] }) {
  const [state, formAction] = useActionState(saveAutomationRuleAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="automationRuleId" defaultValue="" aria-label="Automation to edit">
        <option value="">Create new automation</option>
        {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
      </select>
      <Field id="automation-name" label="Name" name="name" state={state}><Input id="automation-name" name="name" placeholder="No attendance 7 days" /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Trigger" name="triggerKey" options={automationTriggerKeys.map(optionFromValue)} />
        <SelectField label="Channel" name="channel" options={["in_app", "email", "whatsapp", "sms", "multi_channel"].map(optionFromValue)} />
        <select className={selectClass} name="templateId" defaultValue="" aria-label="Template">
          <option value="">No template</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <select className={selectClass} name="segmentKey" defaultValue="active_members" aria-label="Segment">
          {segmentOptions(segments).map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="automation-delay" label="Delay hours" name="delayHours" state={state}><Input id="automation-delay" name="delayHours" defaultValue="0" type="number" /></Field>
        <SelectField label="Status" name="status" options={[{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "archived", label: "Archived" }]} />
      </div>
      <AuthSubmitButton>Save Automation</AuthSubmitButton>
    </form>
  );
}

export function AutomationRunForm({ rule }: { rule: CommunicationAutomationRuleRow }) {
  const [state, formAction] = useActionState(runAutomationRuleAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="automationRuleId" type="hidden" value={rule.id} />
      <Button className="w-full" type="submit" variant="secondary">Queue Automation</Button>
    </form>
  );
}

export function DirectNotificationForm({ members, trainers, templates }: { members: MemberRow[]; trainers: TrainerRow[]; templates: NotificationTemplateRow[] }) {
  const [state, formAction] = useActionState(createDirectNotificationAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <select className={selectClass} name="memberId" defaultValue="" aria-label="Member recipient">
          <option value="">No member</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
        </select>
        <select className={selectClass} name="trainerId" defaultValue="" aria-label="Trainer recipient">
          <option value="">No trainer</option>
          {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name}</option>)}
        </select>
        <select className={selectClass} name="templateId" defaultValue="" aria-label="Template">
          <option value="">No template</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Channel" name="channel" options={outboundChannels.map(optionFromValue)} />
        <SelectField label="Category" name="category" options={communicationCategories.map(optionFromValue)} />
        <SelectField label="Priority" name="priority" options={notificationPriorities.map(optionFromValue)} />
      </div>
      <Field id="direct-title" label="Title" name="title" state={state}><Input id="direct-title" name="title" placeholder="Trainer session updated" /></Field>
      <Field id="direct-body" label="Message" name="body" state={state}><Textarea id="direct-body" name="body" placeholder="Write the message exactly as the recipient should see it." /></Field>
      <Field id="direct-url" label="Action URL" name="actionUrl" state={state}><Input id="direct-url" name="actionUrl" placeholder="/member/classes" /></Field>
      <AuthSubmitButton>Queue Notification</AuthSubmitButton>
    </form>
  );
}

function Field({ id, label, name, state, children }: { id?: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id ?? name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: Option[] }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue={options[0]?.value ?? ""}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm font-bold">
      <input defaultChecked={checked} name={name} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function optionFromValue(value: string): Option {
  return { value, label: formatCommunicationLabel(value) };
}

function segmentOptions(segments: CommunicationSegmentRow[]): Option[] {
  const options = segments.map((segment) => ({ value: segment.segment_key, label: segment.name }));
  return options.length > 0 ? options : [{ value: "all_members", label: "All Members" }];
}

function categoryPreferenceRecord(preferences: NotificationPreferenceRow | null) {
  const fallback = {
    membership: true,
    payments: true,
    attendance: true,
    classes: true,
    workouts: true,
    nutrition: true,
    promotions: false,
    system: true
  };
  if (!preferences || typeof preferences.category_preferences !== "object" || Array.isArray(preferences.category_preferences)) {
    return fallback;
  }
  const record = preferences.category_preferences as Record<string, unknown>;
  return {
    membership: typeof record.membership === "boolean" ? record.membership : fallback.membership,
    payments: typeof record.payments === "boolean" ? record.payments : fallback.payments,
    attendance: typeof record.attendance === "boolean" ? record.attendance : fallback.attendance,
    classes: typeof record.classes === "boolean" ? record.classes : fallback.classes,
    workouts: typeof record.workouts === "boolean" ? record.workouts : fallback.workouts,
    nutrition: typeof record.nutrition === "boolean" ? record.nutrition : fallback.nutrition,
    promotions: typeof record.promotions === "boolean" ? record.promotions : fallback.promotions,
    system: typeof record.system === "boolean" ? record.system : fallback.system
  };
}
