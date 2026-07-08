"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function SmsComposeForm({ organizationId }: { organizationId: string }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!phone.trim() || !message.trim()) {
      showToast("Phone and message are required", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/billing/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, to: phone.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to send SMS", "error");
        return;
      }
      showToast("SMS sent successfully", "success");
      setPhone("");
      setMessage("");
    } catch {
      showToast("Network error", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="sms-phone">Phone Number</label>
        <input
          id="sms-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919XXXXXXXXX"
          className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="sms-message">Message</label>
        <textarea
          id="sms-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your SMS message..."
          rows={3}
          maxLength={480}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm resize-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">{message.length}/480 characters</p>
      </div>
      <Button onClick={handleSend} disabled={sending || !phone.trim() || !message.trim()} className="gap-2">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {sending ? "Sending..." : "Send SMS"}
      </Button>
    </div>
  );
}
