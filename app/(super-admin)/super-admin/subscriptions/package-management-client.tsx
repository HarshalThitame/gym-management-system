"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react";
import {
  Pencil, Plus, Trash2, Copy, Archive, Eye, Check, X,
  AlertTriangle, Loader2, Search, ChevronDown, ChevronUp,
  Settings, DollarSign, Users, Building2, Cpu, Shield,
  Brain, MessageSquare, Smartphone, Link2, Zap, Save,
  Ban, CheckCircle, FileText, History, Tag, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  getPackage, createPackage, updatePackage, duplicatePackage,
  setPackageStatus, deletePackage, getPackageUsage, getFeatures,
  type PackageData, type PackageFeature, FEATURE_REGISTRY,
} from "@/features/super-admin/services/package-management-service";

const LIMIT_FIELDS = [
  { key: "max_members", label: "Members", icon: <Users size={16} /> },
  { key: "max_trainers", label: "Trainers", icon: <Users size={16} /> },
  { key: "max_staff", label: "Staff", icon: <Users size={16} /> },
  { key: "max_gyms", label: "Gyms", icon: <Building2 size={16} /> },
  { key: "max_branches", label: "Branches", icon: <Building2 size={16} /> },
  { key: "max_leads", label: "Leads (CRM)", icon: <FileText size={16} /> },
  { key: "max_storage_mb", label: "Storage (MB)", icon: <Cpu size={16} /> },
  { key: "max_attendance_devices", label: "Attendance Devices", icon: <Zap size={16} /> },
  { key: "max_ai_requests", label: "AI Requests/mo", icon: <Brain size={16} /> },
  { key: "max_sms", label: "SMS/mo", icon: <MessageSquare size={16} /> },
  { key: "max_emails", label: "Emails/mo", icon: <MessageSquare size={16} /> },
  { key: "max_whatsapp_messages", label: "WhatsApp/mo", icon: <MessageSquare size={16} /> },
  { key: "max_custom_domains", label: "Custom Domains", icon: <Link2 size={16} /> },
  { key: "max_api_calls", label: "API Calls/day", icon: <Settings size={16} /> },
];

const FEATURE_CATEGORIES = [
  "Attendance", "CRM", "Billing", "Reports", "AI",
  "White Label", "Communication", "Mobile Apps", "Integrations", "Security", "Franchise",
];

function PackageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}><CardContent className="p-6"><div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </div></CardContent></Card>
      ))}
    </div>
  );
}

function LimitInput({ value, onChange, label, icon, unlimited = true }: { value: number; onChange: (v: number) => void; label: string; icon: React.ReactNode; unlimited?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input type="number" value={value === -1 ? "" : value} onChange={(e) => onChange(e.target.value === "" ? -1 : parseInt(e.target.value) || 0)} className="h-8 w-24" placeholder="Limit" />
          {unlimited && (
            <button type="button" onClick={() => onChange(value === -1 ? 0 : -1)} className={`text-xs px-2 py-1 rounded ${value === -1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              Unlimited
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PackageManagementClient({ data }: { data: any }) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>(data?.packages ?? []);
  const [loading, setLoading] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("packages");

  const filtered = packages.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription-packages");
      const json = await res.json();
      if (json.data) setPackages(json.data);
    } catch {} finally { setLoading(false); }
  }, []);

  const handleEdit = async (id: string) => {
    const pkg = await getPackage(id);
    if (pkg) { setEditingPkg(pkg); setShowForm(true); }
  };

  const handleCreate = () => {
    setEditingPkg(null);
    setShowForm(true);
  };

  const handleSave = async (formData: any) => {
    let result;
    if (editingPkg?.id) {
      result = await updatePackage(editingPkg.id, formData, formData.features, formData.applyMode ?? "draft");
      toast({ title: result.ok ? "Package updated" : "Error", description: result.error ?? "Package saved successfully." });
    } else {
      result = await createPackage(formData, formData.features ?? []);
      toast({ title: result.ok ? "Package created" : "Error", description: result.error ?? "Package created successfully." });
    }
    if (result.ok) { setShowForm(false); setEditingPkg(null); loadPackages(); }
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicatePackage(id);
    toast({ title: result.ok ? "Duplicated" : "Error", description: result.ok ? "Package duplicated as draft." : result.error });
    if (result.ok) loadPackages();
  };

  const handleToggleStatus = async (id: string, active: boolean) => {
    const result = await setPackageStatus(id, active);
    toast({ title: result.ok ? "Updated" : "Error", description: result.ok ? `Package ${active ? "activated" : "deactivated"}.` : result.error });
    if (result.ok) loadPackages();
  };

  const handleDelete = async (id: string) => {
    const result = await deletePackage(id);
    if (result.ok) { setShowDelete(null); loadPackages(); toast({ title: "Deleted", description: "Package deleted." }); }
    else { toast({ title: "Cannot delete", description: result.error, variant: "destructive" }); }
  };

  const handleShowUsage = async (id: string) => {
    const usage = await getPackageUsage(id);
    setShowImpact(usage);
  };

  if (loading) return <PackageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Package Management</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and manage all subscription packages from one place.</p>
        </div>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Create Package</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packages..." className="pl-9" />
        </div>
        <Badge variant="secondary">{packages.length} packages</Badge>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-4 py-16">
          <Layers className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">No packages found</p>
          <p className="text-sm text-muted-foreground">Create your first package to get started.</p>
          <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Create Package</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((pkg) => (
            <Card key={pkg.id} className={pkg.is_active ? "" : "opacity-60"}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold">{pkg.name}</h3>
                      <Badge variant={pkg.is_active ? "success" : "secondary"}>{pkg.is_active ? "Active" : "Inactive"}</Badge>
                      {pkg.is_recommended && <Badge variant="default" className="bg-primary">Recommended</Badge>}
                      {pkg.is_popular && <Badge variant="default" className="bg-amber-500">Popular</Badge>}
                      {pkg.badge_text && <Badge variant="outline" style={{ borderColor: pkg.badge_color }}>{pkg.badge_text}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{pkg.description || "No description"}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span>₹{pkg.monthly_price}/mo</span>
                      {pkg.yearly_price > 0 && <span>₹{pkg.yearly_price}/yr</span>}
                      <span>{pkg.max_members === -1 ? "Unlimited" : pkg.max_members} members</span>
                      <span>{pkg.max_branches === -1 ? "Unlimited" : pkg.max_branches} branches</span>
                      {pkg.trial_days > 0 && <span>{pkg.trial_days}-day trial</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg.id)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(pkg.id)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(pkg.id, !pkg.is_active)} title={pkg.is_active ? "Deactivate" : "Activate"}>
                      {pkg.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleShowUsage(pkg.id)} title="Usage"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowDelete(pkg.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <PackageFormModal
          pkg={editingPkg}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingPkg(null); }}
        />
      )}

      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Package</DialogTitle><DialogDescription>This action cannot be undone. Archives are safer for packages in use.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDelete && handleDelete(showDelete)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showImpact} onOpenChange={() => setShowImpact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Package Usage</DialogTitle></DialogHeader>
          {showImpact && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{showImpact.total} organization(s) using this package</p>
              {showImpact.organizations?.slice(0, 20).map((org: any) => (
                <div key={org.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{org.organizations?.name ?? "Unknown"}</span>
                  <Badge variant={org.status === "active" ? "success" : "secondary"}>{org.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageFormModal({ pkg, onSave, onClose }: { pkg: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState<any>(pkg ?? getDefaultForm());
  const [features, setFeatures] = useState<PackageFeature[]>(pkg?.features ?? getDefaultFeatures());
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [applyMode, setApplyMode] = useState<string>("draft");
  const [showApplyMode, setShowApplyMode] = useState(false);

  const update = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const handleFeatureToggle = (featureKey: string, enabled: boolean) => {
    setFeatures((prev) => prev.map((f) => f.feature_key === featureKey ? { ...f, enabled } : f));
  };

  const validate = () => {
    const errors: string[] = [];
    if (!form.name || form.name.trim().length < 2) errors.push("Package name is required.");
    if (form.monthly_price < 0) errors.push("Monthly price cannot be negative.");
    if (form.yearly_price < 0) errors.push("Yearly price cannot be negative.");
    if (form.trial_days < 0) errors.push("Trial days cannot be negative.");
    if (form.discount_percentage < 0 || form.discount_percentage > 100) errors.push("Discount must be 0-100%.");
    if (form.max_members < -1) errors.push("Member limit invalid.");
    if (form.max_branches < -1) errors.push("Branch limit invalid.");
    return errors;
  };

  const handleSubmit = async (confirmedMode?: string) => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      return;
    }

    const mode = confirmedMode || applyMode;

    // If package has active orgs and no mode selected, show dialog
    if (!confirmedMode && pkg?.organizationCount && pkg.organizationCount > 0 && mode === "draft") {
      setShowApplyMode(true);
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...form, features, applyMode: mode });
    } finally { setSaving(false); }
  };

  const pricingSummary = form.monthly_price > 0 && form.yearly_price > 0
    ? `₹${(form.yearly_price / 12).toFixed(0)}/mo billed yearly (save ${Math.round((1 - form.yearly_price / (form.monthly_price * 12)) * 100)}%)`
    : form.monthly_price > 0 ? `₹${form.monthly_price}/mo` : "Free";

  const activeFeatures = features.filter((f) => f.enabled).length;
  const totalFeatures = features.length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{pkg?.id ? `Edit: ${pkg.name}` : "Create Package"}</DialogTitle>
          <DialogDescription>Configure all aspects of this subscription package.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-5 lg:grid-cols-10 gap-1">
            <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">Pricing</TabsTrigger>
            <TabsTrigger value="limits" className="text-xs">Limits</TabsTrigger>
            <TabsTrigger value="features" className="text-xs">Features ({activeFeatures}/{totalFeatures})</TabsTrigger>
            <TabsTrigger value="branding" className="text-xs">Branding</TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs">Marketing</TabsTrigger>
            <TabsTrigger value="addons" className="text-xs">Add-ons</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <Card><CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Package Name *</Label>
                  <Input value={form.name ?? ""} onChange={(e) => update("name", e.target.value)} placeholder="e.g., Starter, Growth, Enterprise" />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={form.slug ?? ""} onChange={(e) => update("slug", e.target.value)} placeholder="auto-generated" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Short Description</Label>
                <Input value={form.short_description ?? ""} onChange={(e) => update("short_description", e.target.value)} placeholder="Brief tagline for the package" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => update("sort_order", parseInt(e.target.value) || 0)} className="w-24" />
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4 mt-4">
            <Card><CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Monthly Price (₹)</Label><Input type="number" value={form.monthly_price ?? 0} onChange={(e) => update("monthly_price", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Yearly Price (₹)</Label><Input type="number" value={form.yearly_price ?? 0} onChange={(e) => update("yearly_price", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Setup Fee (₹)</Label><Input type="number" value={form.setup_fee ?? 0} onChange={(e) => update("setup_fee", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Currency</Label><Input value={form.currency ?? "INR"} onChange={(e) => update("currency", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Trial Days</Label><Input type="number" value={form.trial_days ?? 0} onChange={(e) => update("trial_days", parseInt(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Discount %</Label><Input type="number" value={form.discount_percentage ?? 0} onChange={(e) => update("discount_percentage", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Billing Interval</Label>
                  <Select value={form.billing_interval ?? "monthly"} onValueChange={(v) => update("billing_interval", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly Only</SelectItem>
                      <SelectItem value="yearly">Yearly Only</SelectItem>
                      <SelectItem value="both">Monthly & Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <span className="font-medium">Pricing Summary: </span>{pricingSummary}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4 mt-4">
            <Card><CardContent className="p-5">
              <p className="text-sm text-muted-foreground mb-4">Set usage limits. Use -1 for unlimited.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {LIMIT_FIELDS.map((field) => (
                  <LimitInput key={field.key} label={field.label} icon={field.icon} value={(form as any)[field.key] ?? -1} onChange={(v) => update(field.key, v)} />
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4 mt-4">
            {FEATURE_CATEGORIES.map((cat) => {
              const catFeatures = features.filter((f) => f.category === cat);
              if (catFeatures.length === 0) return null;
              const enabledCount = catFeatures.filter((f) => f.enabled).length;
              return (
                <Card key={cat}><CardHeader className="py-3 px-5">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {cat} <Badge variant="secondary" className="text-xs">{enabledCount}/{catFeatures.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {catFeatures.map((feat) => (
                      <div key={feat.feature_key} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{feat.feature_name}</p>
                          <p className="text-xs text-muted-foreground">{feat.feature_key}</p>
                        </div>
                        <Switch checked={feat.enabled} onCheckedChange={(v) => handleFeatureToggle(feat.feature_key, v)} />
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              );
            })}
          </TabsContent>

          <TabsContent value="branding" className="space-y-4 mt-4">
            <Card><CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Badge Text</Label><Input value={form.badge_text ?? ""} onChange={(e) => update("badge_text", e.target.value)} placeholder="e.g., Most Popular" /></div>
                <div className="space-y-2"><Label>Badge Color</Label><div className="flex gap-2"><Input value={form.badge_color ?? "#FF6B35"} onChange={(e) => update("badge_color", e.target.value)} className="flex-1" /><div className="w-10 h-10 rounded border" style={{ backgroundColor: form.badge_color ?? "#FF6B35" }} /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Highlight Color</Label><div className="flex gap-2"><Input value={form.highlight_color ?? ""} onChange={(e) => update("highlight_color", e.target.value)} className="flex-1" /><div className="w-10 h-10 rounded border" style={{ backgroundColor: form.highlight_color ?? "#fff" }} /></div></div>
                <div className="space-y-2"><Label>Support Level</Label>
                  <Select value={form.support_level ?? "standard"} onValueChange={(v) => update("support_level", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="enterprise">Enterprise 24/7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Label className="flex items-center gap-2"><Switch checked={form.is_recommended ?? false} onCheckedChange={(v) => update("is_recommended", v)} /> Recommended</Label>
                <Label className="flex items-center gap-2"><Switch checked={form.is_popular ?? false} onCheckedChange={(v) => update("is_popular", v)} /> Popular</Label>
                <Label className="flex items-center gap-2"><Switch checked={form.is_public ?? true} onCheckedChange={(v) => update("is_public", v)} /> Public</Label>
                <Label className="flex items-center gap-2"><Switch checked={form.is_active ?? false} onCheckedChange={(v) => update("is_active", v)} /> Active</Label>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="marketing" className="space-y-4 mt-4">
            <Card><CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Marketing Points</Label>
                <p className="text-xs text-muted-foreground">Bullet points shown on the pricing page. One per line.</p>
                <Textarea value={(form.marketing_points ?? []).join("\n")} onChange={(e) => update("marketing_points", e.target.value.split("\n").filter((l: string) => l.trim()))} rows={5} placeholder={"Unlimited members\nPriority support\nCustom branding\n..."} />
              </div>
              <div className="space-y-2"><Label>Icon (emoji or URL)</Label><Input value={form.icon ?? ""} onChange={(e) => update("icon", e.target.value)} placeholder="🔥 or https://..." /></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="addons" className="space-y-4 mt-4">
            <Card><CardContent className="p-5">
              <p className="text-sm text-muted-foreground mb-4">Optional add-ons that organizations can purchase separately.</p>
              <div className="space-y-3">
                {(form.addons ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No add-ons configured. Add-ons will be saved when you create the package.</p>
                ) : (
                  form.addons?.map((addon: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 border rounded-lg p-3">
                      <Input value={addon.name} onChange={(e) => { const a = [...(form.addons ?? [])]; a[i] = { ...a[i], name: e.target.value }; update("addons", a); }} placeholder="Add-on name" className="flex-1" />
                      <Input type="number" value={addon.monthly_price} onChange={(e) => { const a = [...(form.addons ?? [])]; a[i] = { ...a[i], monthly_price: parseFloat(e.target.value) || 0 }; update("addons", a); }} placeholder="₹/mo" className="w-24" />
                      <button type="button" onClick={() => { const a = [...(form.addons ?? [])]; a.splice(i, 1); update("addons", a); }} className="text-destructive text-sm">Remove</button>
                    </div>
                  ))
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => update("addons", [...(form.addons ?? []), { name: "", monthly_price: 0, yearly_price: 0, description: "" }])}>
                  + Add Add-on
                </Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <Card><CardContent className="p-5 space-y-4">
              <div className="space-y-2"><Label>Internal Notes (not visible to customers)</Label><Textarea value={form.internal_notes ?? ""} onChange={(e) => update("internal_notes", e.target.value)} rows={3} /></div>
              <div className="space-y-2"><Label>Terms & Conditions</Label><Textarea value={form.terms ?? ""} onChange={(e) => update("terms", e.target.value)} rows={3} /></div>
              <div className="space-y-2"><Label>Version Notes (changelog for this update)</Label><Textarea value={form.version_notes ?? ""} onChange={(e) => update("version_notes", e.target.value)} rows={2} placeholder="e.g., Increased member limit from 100 to 500" /></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 mt-4">
            <Card><CardContent className="p-6">
              <div className="max-w-sm mx-auto">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    {form.badge_text && <Badge style={{ backgroundColor: form.badge_color ?? "#FF6B35" }} className="text-white">{form.badge_text}</Badge>}
                    {form.is_recommended && <Badge variant="default">Recommended</Badge>}
                  </div>
                  <h3 className="text-2xl font-bold">{form.name || "Package Name"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{form.short_description || form.description || ""}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-black">₹{form.monthly_price ?? 0}</span>
                    <span className="text-muted-foreground">/month</span>
                    {form.yearly_price > 0 && <p className="text-sm text-muted-foreground mt-1">₹{form.yearly_price}/year (save {form.monthly_price > 0 ? Math.round((1 - form.yearly_price / (form.monthly_price * 12)) * 100) : 0}%)</p>}
                  </div>
                  {form.trial_days > 0 && <p className="text-sm text-green-600 font-medium mt-2">{form.trial_days}-day free trial</p>}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    {features.filter((f) => f.enabled).slice(0, 8).map((f) => (
                      <div key={f.feature_key} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{f.feature_name}</span>
                      </div>
                    ))}
                    {features.filter((f) => f.enabled).length > 8 && (
                      <p className="text-sm text-muted-foreground">+{features.filter((f) => f.enabled).length - 8} more features</p>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Up to {form.max_members === -1 ? "unlimited" : form.max_members} members</p>
                    <p>Up to {form.max_branches === -1 ? "unlimited" : form.max_branches} branches</p>
                    {form.max_storage_mb > 0 && <p>{form.max_storage_mb} MB storage</p>}
                  </div>
                  <div className="mt-4">
                    <div className="w-full rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground">
                      {form.monthly_price > 0 ? `Start at ₹${form.monthly_price}/mo` : "Get Started Free"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between border-t pt-4 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex items-center gap-2">
            {pkg?.id && pkg.organizationCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="h-3 w-3" />
                {pkg.organizationCount} org(s) using this package
              </div>
            )}
            <Button onClick={() => handleSubmit()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pkg?.id ? "Save Changes" : "Create Package"}
            </Button>
          </div>
        </div>

        {showApplyMode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold">Apply Package Changes</h3>
              <p className="text-sm text-muted-foreground">
                This package is used by <strong>{pkg?.organizationCount ?? 0}</strong> organization(s).
                Choose how to apply your changes:
              </p>
              <div className="space-y-2">
                {[
                  { value: "draft", label: "Save as Draft", desc: "Changes won't affect any organization until published." },
                  { value: "all", label: "Apply to All Organizations", desc: "Immediately update entitlements and limits for all subscribers." },
                  { value: "new_only", label: "New Subscriptions Only", desc: "Existing organizations keep current configuration." },
                  { value: "renewal", label: "Apply on Renewal", desc: "Changes take effect at each organization's next billing cycle." },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => { setApplyMode(opt.value); setShowApplyMode(false); handleSubmit(opt.value); }}
                    className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors">
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowApplyMode(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getDefaultForm() {
  return {
    name: "", slug: "", description: "", short_description: "",
    monthly_price: 0, yearly_price: 0, setup_fee: 0, currency: "INR",
    trial_days: 0, discount_percentage: 0, billing_interval: "monthly",
    is_active: false, is_public: true, is_recommended: false, is_popular: false, sort_order: 0,
    max_members: -1, max_trainers: -1, max_staff: -1, max_gyms: -1, max_branches: -1,
    max_leads: -1, max_storage_mb: 100, max_attendance_devices: -1,
    max_ai_requests: 0, max_sms: 0, max_emails: 0, max_whatsapp_messages: 0,
    max_custom_domains: 0, max_api_calls: 0,
    badge_text: "", badge_color: "#FF6B35", highlight_color: "",
    support_level: "standard",
    qr_attendance_enabled: true, biometric_attendance_enabled: false,
    rfid_attendance_enabled: false, class_scheduling_enabled: false,
    trainer_assignment_enabled: false, razorpay_enabled: false,
    communications_enabled: false, ai_enabled: false,
    advanced_reports_enabled: false, custom_domain_enabled: false,
    api_access_enabled: false,
  };
}

function getDefaultFeatures(): PackageFeature[] {
  return FEATURE_REGISTRY.map((f, i) => ({
    feature_key: f.key,
    feature_name: f.name,
    category: f.category,
    enabled: false,
    limit_value: f.defaultLimit ?? null,
    is_locked: false,
    upgrade_message: null,
    sort_order: i,
  }));
}
