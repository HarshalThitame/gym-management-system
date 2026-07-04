"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Wrench,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Eye,
  Edit3,
  Search,
  Upload,
  Sparkles,
  ImagePlus,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrgOwnerDrawer, DrawerField } from "@/features/organization-owner/components/org-owner-drawer";
import { showToast } from "@/components/ui/toast";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";
import { formatEnterpriseLabel, formatCurrency } from "@/features/enterprise/lib/business-rules";
import type {
  EquipmentRow,
  ServiceLogRow,
} from "@/features/organization-owner/actions/equipment-actions";
import {
  getEquipment,
  saveEquipment,
  deleteEquipment,
  logService,
  getServiceHistory,
  getEquipmentAlerts,
} from "@/features/organization-owner/actions/equipment-actions";

type EquipmentModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: EquipmentRow[] };
  moduleFilters?: undefined;
};

type EquipmentTab = "inventory" | "alerts";

const EQUIPMENT_TYPES = ["cardio", "strength", "free_weight", "machine", "accessory", "other"] as const;
const EQUIPMENT_STATUSES = ["operational", "under_maintenance", "out_of_order", "retired"] as const;
const SERVICE_TYPES = ["routine", "repair", "amc", "inspection"] as const;

const statusBadgeClass: Record<string, string> = {
  operational: "border-green-200 bg-green-50 text-green-700",
  under_maintenance: "border-amber-200 bg-amber-50 text-amber-700",
  out_of_order: "border-red-200 bg-red-50 text-red-700",
  retired: "border-gray-200 bg-gray-50 text-gray-500",
};

const typeBadgeClass: Record<string, string> = {
  cardio: "border-blue-200 bg-blue-50 text-blue-700",
  strength: "border-purple-200 bg-purple-50 text-purple-700",
  free_weight: "border-orange-200 bg-orange-50 text-orange-700",
  machine: "border-teal-200 bg-teal-50 text-teal-700",
  accessory: "border-pink-200 bg-pink-50 text-pink-700",
  other: "border-border bg-surface-muted text-muted-foreground",
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type EquipmentImageState = {
  previewUrl: string;
  storagePath: string | null;
  source: "upload" | "ai";
  prompt: string | null;
  needsPersist: boolean;
  generatedDataUrl: string | null;
};

export function EquipmentModule({ dashboard, moduleData }: EquipmentModuleProps) {
  const [equipment, setEquipment] = useState<EquipmentRow[]>(moduleData?.items ?? []);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState({ warrantyExpiring: 0, serviceOverdue: 0, amcExpiring: 0 });
  const [activeTab, setActiveTab] = useState<EquipmentTab>("inventory");

  // Detail panel
  const [selectedEq, setSelectedEq] = useState<EquipmentRow | null>(null);
  const [serviceHistory, setServiceHistory] = useState<ServiceLogRow[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<EquipmentRow["equipment_type"]>("cardio");
  const [formBranchId, setFormBranchId] = useState<string>("");
  const [formSerial, setFormSerial] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formPurchasePrice, setFormPurchasePrice] = useState("");
  const [formWarrantyExpiry, setFormWarrantyExpiry] = useState("");
  const [formServiceInterval, setFormServiceInterval] = useState("90");
  const [formAmcProvider, setFormAmcProvider] = useState("");
  const [formAmcExpiry, setFormAmcExpiry] = useState("");
  const [formStatus, setFormStatus] = useState<EquipmentRow["status"]>("operational");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [imageMode, setImageMode] = useState<"upload" | "ai">("upload");
  const [imagePrompt, setImagePrompt] = useState("");
  const [equipmentImage, setEquipmentImage] = useState<EquipmentImageState | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageStatusMessage, setImageStatusMessage] = useState<string | null>(null);
  const [imageErrorMessage, setImageErrorMessage] = useState<string | null>(null);

  // Async job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobPollStatus, setJobPollStatus] = useState<"idle" | "submitting" | "queued" | "processing" | "ready" | "failed" | null>(null);
  const [jobErrorMsg, setJobErrorMsg] = useState<string | null>(null);
  const [pendingAiPreview, setPendingAiPreview] = useState<{ previewUrl: string; prompt: string | null } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Service log form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState<ServiceLogRow["service_type"]>("routine");
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");
  const [serviceTech, setServiceTech] = useState("");

  // Alert data
  const [alertData, setAlertData] = useState<{
    warrantyExpiring: Partial<EquipmentRow>[];
    serviceOverdue: Partial<EquipmentRow>[];
    amcExpiring: Partial<EquipmentRow>[];
  }>({ warrantyExpiring: [], serviceOverdue: [], amcExpiring: [] });

  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  // Filters
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterQ, setFilterQ] = useState("");

  const loadEquipment = useCallback(async () => {
    try {
      const filters: Record<string, string> = {};
      if (filterBranch !== "all") filters.branchId = filterBranch;
      if (filterType !== "all") filters.type = filterType;
      if (filterStatus !== "all") filters.status = filterStatus;

      const result = await getEquipment(dashboard.organization.id, filters);
      let filtered = result.equipment;
      if (filterQ) {
        const q = filterQ.toLowerCase();
        filtered = filtered.filter((e) =>
          e.name.toLowerCase().includes(q) ||
          (e.brand ?? "").toLowerCase().includes(q) ||
          (e.model ?? "").toLowerCase().includes(q) ||
          (e.serial_number ?? "").toLowerCase().includes(q)
        );
      }
      setEquipment(filtered);
      setSelectedEq((current) => current ? filtered.find((eq) => eq.id === current.id) ?? null : current);
      setTotal(filtered.length);
      setAlerts(result.alerts);
    } catch {
      showToast("Failed to load equipment", "error");
    }
  }, [dashboard.organization.id, filterBranch, filterType, filterStatus, filterQ]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  useEffect(() => {
    void loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.organization.id]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((activeJobId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/organization/equipment/generate-image/${activeJobId}`);
        if (!response.ok) {
          setJobPollStatus("failed");
          setJobErrorMsg("Failed to check generation status.");
          stopPolling();
          return;
        }
        const data = await response.json();
        const status = data.status;
        if (status === "completed") {
          setPendingAiPreview({ previewUrl: data.previewDataUrl, prompt: data.resolvedPrompt });
          setJobPollStatus("ready");
          stopPolling();
        } else if (status === "failed") {
          setJobPollStatus("failed");
          setJobErrorMsg(data.lastError || "Image generation failed.");
          stopPolling();
        } else if (status === "expired" || status === "cancelled") {
          setJobPollStatus("failed");
          setJobErrorMsg(`Job was ${status}. Try again.`);
          stopPolling();
        } else {
          setJobPollStatus(status);
        }
      } catch {
        setJobPollStatus("failed");
        setJobErrorMsg("Lost connection while checking generation status.");
        stopPolling();
      }
    }, 3000);
  }, [stopPolling]);

  useEffect(() => {
    if (jobId && (jobPollStatus === "queued" || jobPollStatus === "processing" || jobPollStatus === "submitting")) {
      startPolling(jobId);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobId, jobPollStatus, startPolling]);

  useEffect(() => () => {
    clearObjectUrl(equipmentImage?.previewUrl);
    stopPolling();
  }, [equipmentImage?.previewUrl, stopPolling]);

  const loadAlerts = async () => {
    try {
      const data = await getEquipmentAlerts(dashboard.organization.id);
      setAlertData(data);
    } catch {
      // ignore
    }
  };

  const clearObjectUrl = (value?: string | null) => {
    if (value?.startsWith("blob:")) {
      URL.revokeObjectURL(value);
    }
  };

  const replaceEquipmentImage = (next: EquipmentImageState | null) => {
    setEquipmentImage((current) => {
      if (current?.previewUrl && current.previewUrl !== next?.previewUrl) {
        clearObjectUrl(current.previewUrl);
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormName("");
    setFormType("cardio");
    setFormBranchId("");
    setFormSerial("");
    setFormBrand("");
    setFormModel("");
    setFormPurchaseDate("");
    setFormPurchasePrice("");
    setFormWarrantyExpiry("");
    setFormServiceInterval("90");
    setFormAmcProvider("");
    setFormAmcExpiry("");
    setFormStatus("operational");
    setFormLocation("");
    setFormNotes("");
    setImageMode("upload");
    setImagePrompt("");
    replaceEquipmentImage(null);
    setPendingUploadFile(null);
    setImageLoading(false);
    setImageStatusMessage(null);
    setImageErrorMessage(null);
    setJobId(null);
    setJobPollStatus(null);
    setJobErrorMsg(null);
    setPendingAiPreview(null);
    stopPolling();
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (eq: EquipmentRow) => {
    setEditingId(eq.id);
    setFormName(eq.name);
    setFormType(eq.equipment_type);
    setFormBranchId(eq.branch_id ?? "");
    setFormSerial(eq.serial_number ?? "");
    setFormBrand(eq.brand ?? "");
    setFormModel(eq.model ?? "");
    setFormPurchaseDate(eq.purchase_date ?? "");
    setFormPurchasePrice(eq.purchase_price != null ? String(eq.purchase_price) : "");
    setFormWarrantyExpiry(eq.warranty_expiry ?? "");
    setFormServiceInterval(String(eq.service_interval_days));
    setFormAmcProvider(eq.amc_provider ?? "");
    setFormAmcExpiry(eq.amc_expiry ?? "");
    setFormStatus(eq.status);
    setFormLocation(eq.location ?? "");
    setFormNotes(eq.notes ?? "");
    setImageMode(eq.image_source ?? "upload");
    setImagePrompt(eq.image_prompt ?? "");
    replaceEquipmentImage(eq.image_url && eq.image_source ? {
      previewUrl: eq.image_url,
      storagePath: eq.image_storage_path,
      source: eq.image_source,
      prompt: eq.image_prompt,
      needsPersist: false,
      generatedDataUrl: null,
    } : null);
    setPendingUploadFile(null);
    setDrawerOpen(true);
  };

  const handleUploadSelection = (file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setImageMode("upload");
    setPendingUploadFile(file);
    setImageStatusMessage("Image selected. It will be uploaded when you save the equipment.");
    setImageErrorMessage(null);
    replaceEquipmentImage({
      previewUrl,
      storagePath: null,
      source: "upload",
      prompt: null,
      needsPersist: true,
      generatedDataUrl: null,
    });
  };

  const handleRemoveImage = () => {
    setPendingUploadFile(null);
    setImageStatusMessage(null);
    setImageErrorMessage(null);
    replaceEquipmentImage(null);
  };

  const handleGenerateImage = async () => {
    if (!formName.trim()) {
      showToast("Enter equipment name before generating an image", "error");
      return;
    }

    stopPolling();
    setImageMode("ai");
    setPendingUploadFile(null);
    setJobErrorMsg(null);
    setImageErrorMessage(null);
    setPendingAiPreview(null);

    setJobPollStatus("submitting");
    try {
      const response = await fetch("/api/organization/equipment/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: dashboard.organization.id,
          name: formName.trim(),
          equipmentType: formType,
          brand: formBrand || null,
          model: formModel || null,
          customPrompt: imagePrompt || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Image generation request failed");
      }

      setJobId(payload.jobId);
      setImageStatusMessage("Image generation queued. This typically takes a few seconds.");
      setJobPollStatus(payload.status === "queued" || payload.status === "processing" ? payload.status : "queued");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to generate image";
      setJobPollStatus("failed");
      setJobErrorMsg(message);
      setImageErrorMessage(message);
      showToast(message, "error");
    }
  };

  const persistPendingImage = async () => {
    if (!equipmentImage?.needsPersist) {
      if (jobId && jobPollStatus === "ready" && !equipmentImage) {
        return acceptJobImage();
      }
      return equipmentImage;
    }

    const formData = new FormData();
    formData.set("organizationId", dashboard.organization.id);

    if (equipmentImage.source === "upload") {
      formData.set("source", "upload");
      if (!pendingUploadFile) {
        throw new Error("Select an image file before saving.");
      }
      formData.set("file", pendingUploadFile);
    } else if (jobId && jobPollStatus === "ready") {
      return acceptJobImage();
    } else {
      formData.set("source", "ai");
      if (!equipmentImage.generatedDataUrl) {
        throw new Error("Generate an AI image before saving.");
      }
      formData.set("generatedDataUrl", equipmentImage.generatedDataUrl);
      formData.set("prompt", equipmentImage.prompt ?? imagePrompt.trim());
    }

    const response = await fetch("/api/organization/equipment/images", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to save equipment image");
    }

    const persistedImage: EquipmentImageState = {
      previewUrl: payload.imageUrl,
      storagePath: payload.imageStoragePath,
      source: payload.imageSource,
      prompt: payload.imagePrompt ?? null,
      needsPersist: false,
      generatedDataUrl: null,
    };

    setPendingUploadFile(null);
    setImageErrorMessage(null);
    setImageStatusMessage("Equipment image saved and linked to this equipment record.");
    replaceEquipmentImage(persistedImage);
    return persistedImage;
  };

  const acceptJobImage = async () => {
    if (!jobId) throw new Error("No job to accept.");

    const formData = new FormData();
    formData.set("organizationId", dashboard.organization.id);
    formData.set("source", "job");
    formData.set("jobId", jobId);

    const response = await fetch("/api/organization/equipment/images", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to accept generated image");
    }

    const persistedImage: EquipmentImageState = {
      previewUrl: payload.imageUrl,
      storagePath: payload.imageStoragePath,
      source: "ai",
      prompt: payload.imagePrompt ?? null,
      needsPersist: false,
      generatedDataUrl: null,
    };

    stopPolling();
    setJobId(null);
    setJobPollStatus(null);
    setJobErrorMsg(null);
    setPendingAiPreview(null);
    setPendingUploadFile(null);
    setImageErrorMessage(null);
    setImageStatusMessage("AI image accepted and saved to equipment.");
    replaceEquipmentImage(persistedImage);
    showToast("AI image accepted", "success");
    return persistedImage;
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast("Equipment name is required", "error");
      return;
    }

    try {
      const persistedImage = await persistPendingImage();
      const saveInput: Parameters<typeof saveEquipment>[1] = {
        name: formName.trim(),
        equipmentType: formType,
        branchId: formBranchId || null,
        serialNumber: formSerial || null,
        brand: formBrand || null,
        model: formModel || null,
        purchaseDate: formPurchaseDate || null,
        purchasePrice: formPurchasePrice ? Number(formPurchasePrice) : null,
        warrantyExpiry: formWarrantyExpiry || null,
        serviceIntervalDays: Number(formServiceInterval) || 90,
        amcProvider: formAmcProvider || null,
        amcExpiry: formAmcExpiry || null,
        status: formStatus,
        location: formLocation || null,
        notes: formNotes || null,
        imageUrl: persistedImage?.previewUrl ?? null,
        imageStoragePath: persistedImage?.storagePath ?? null,
        imageSource: persistedImage?.source ?? null,
        imagePrompt: persistedImage?.prompt ?? null,
      };
      if (editingId) saveInput.equipmentId = editingId;
      await saveEquipment(dashboard.organization.id, saveInput);
      setSuccessAction({ action: editingId ? "updated" : "created", title: editingId ? "Equipment Updated!" : "Equipment Created!", itemName: formName.trim() });
      resetForm();
      setDrawerOpen(false);
      await loadEquipment();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  const handleDelete = (equipmentId: string, equipmentName: string) => {
    setPendingDelete({ id: equipmentId, name: equipmentName });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteEquipment(dashboard.organization.id, pendingDelete.id);
      setSuccessAction({ action: "deleted", title: "Equipment Deleted!", itemName: pendingDelete.name });
      setPendingDelete(null);
      await loadEquipment();
      if (selectedEq?.id === pendingDelete.id) setSelectedEq(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const openDetail = async (eq: EquipmentRow) => {
    setSelectedEq(eq);
    setServiceLoading(true);
    try {
      const history = await getServiceHistory(dashboard.organization.id, eq.id);
      setServiceHistory(history);
    } catch {
      //
    } finally {
      setServiceLoading(false);
    }
  };

  const handleLogService = async () => {
    if (!selectedEq) return;
    try {
      await logService(dashboard.organization.id, selectedEq.id, {
        serviceDate,
        serviceType,
        description: serviceDesc || null,
        cost: serviceCost ? Number(serviceCost) : null,
        serviceProvider: serviceProvider || null,
        technicianName: serviceTech || null,
      });
      showToast("Service logged", "success");
      setShowServiceForm(false);
      setServiceDesc("");
      setServiceCost("");
      setServiceProvider("");
      setServiceTech("");
      await loadEquipment();
      if (selectedEq) {
        void openDetail(selectedEq);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to log service", "error");
    }
  };

  const handleLogServiceForAlert = (eqId: string | undefined) => {
    if (!eqId) return;
    const eq = equipment.find((e) => e.id === eqId);
    if (eq) {
      openDetail(eq);
      setShowServiceForm(true);
    }
  };

  const items = equipment.map((eq) => ({
    id: eq.id,
    title: eq.name,
    subtitle: eq.brand ? `${eq.brand}${eq.model ? ` ${eq.model}` : ""}` : eq.equipment_type,
    meta: `${eq.location ?? "N/A"} · ${eq.next_service_date ? `Next: ${eq.next_service_date}` : "No service scheduled"}`,
    badge: formatEnterpriseLabel(eq.status),
    badgeVariant: (
      eq.status === "operational" ? "info" :
      eq.status === "under_maintenance" ? "warning" :
      eq.status === "out_of_order" ? "error" : "neutral"
    ) as "info" | "warning" | "error" | "neutral",
    sections: [
      { label: "Type", value: formatEnterpriseLabel(eq.equipment_type) },
      { label: "Branch", value: dashboard.branches.find((b) => b.id === eq.branch_id)?.name ?? "N/A" },
      { label: "Status", value: formatEnterpriseLabel(eq.status) },
      { label: "Last Service", value: eq.last_service_date ?? "N/A" },
      { label: "Next Service", value: eq.next_service_date ?? "N/A" },
      { label: "Warranty", value: eq.warranty_expiry ?? "N/A" },
    ],
    avatar: eq.image_url ? (
      <Image
        alt={`${eq.name} equipment`}
        className="size-14 rounded-lg border border-border object-cover"
        height={56}
        src={eq.image_url}
        unoptimized
        width={56}
      />
    ) : (
      <div className="flex size-14 items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-muted-foreground">
        <ImagePlus className="size-5" />
      </div>
    ),
    actions: [
      { label: "Details", onClick: () => openDetail(eq), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
      { label: "Edit", onClick: () => openEdit(eq), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      { label: "Delete", onClick: () => handleDelete(eq.id, eq.name), variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
    ],
  }));

  const summaryStats = [
    { count: total, label: "Total Equipment", icon: <Wrench className="size-5" /> },
    { count: equipment.filter((e) => e.status === "operational").length, label: "Operational", icon: <Wrench className="size-5" /> },
    { count: equipment.filter((e) => e.status === "under_maintenance").length, label: "In Maintenance", icon: <Clock className="size-5" /> },
    { count: equipment.filter((e) => e.status === "out_of_order").length, label: "Out of Order", icon: <AlertTriangle className="size-5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {(alerts.warrantyExpiring > 0 || alerts.serviceOverdue > 0 || alerts.amcExpiring > 0) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">Equipment Alerts</p>
              <div className="flex flex-wrap gap-3 text-xs text-amber-700">
                {alerts.warrantyExpiring > 0 ? <span>{alerts.warrantyExpiring} warranty expiring</span> : null}
                {alerts.serviceOverdue > 0 ? <span>{alerts.serviceOverdue} service overdue</span> : null}
                {alerts.amcExpiring > 0 ? <span>{alerts.amcExpiring} AMC expiring</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {([
          { key: "inventory" as EquipmentTab, label: "Equipment" },
          { key: "alerts" as EquipmentTab, label: "Alerts" },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition md:text-sm ${activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: INVENTORY ═══ */}
      {activeTab === "inventory" ? (
        <>
          {/* Summary stat cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <StatCard
                key={stat.label}
                detail=""
                icon={stat.icon}
                label={stat.label}
                value={String(stat.count)}
              />
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Name, brand, model or serial..."
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Branch</label>
              <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                <option value="all">All Branches</option>
                {dashboard.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Type</label>
              <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{formatEnterpriseLabel(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Status</label>
              <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{formatEnterpriseLabel(s)}</option>)}
              </select>
            </div>
          </div>

          {/* Add button + Table */}
          <Button onClick={openAdd} size="sm" variant="secondary">
            <Plus className="size-3.5" /> Add Equipment
          </Button>

          <DataList
            headerTitle="Equipment"
            items={items}
            totalItems={total}
            totalPages={1}
            currentPage={1}
            onPageChange={() => {}}
            pageSize={12}
          />
        </>
      ) : null}

      {/* ═══ TAB: ALERTS ═══ */}
      {activeTab === "alerts" ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-amber-500" />
                <h3 className="text-lg font-black">Warranty Expiring</h3>
              </div>
            </CardHeader>
            <CardContent>
              {alertData.warrantyExpiring.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No warranties expiring soon</p>
              ) : (
                <div className="space-y-2">
                  {alertData.warrantyExpiring.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3">
                      <div>
                        <p className="text-sm font-bold">{e.name}</p>
                        <p className="text-xs text-amber-700">Expires: {e.warranty_expiry}</p>
                      </div>
                      <button
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        onClick={() => { /* warranty update would go here */ showToast("Warranty update coming soon", "info"); }}
                        type="button"
                      >
                        Update Warranty
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-red-500" />
                <h3 className="text-lg font-black">Service Overdue</h3>
              </div>
            </CardHeader>
            <CardContent>
              {alertData.serviceOverdue.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">All services up to date</p>
              ) : (
                <div className="space-y-2">
                  {alertData.serviceOverdue.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3">
                      <div>
                        <p className="text-sm font-bold">{e.name}</p>
                        <p className="text-xs text-red-700">Due: {e.next_service_date ?? "N/A"}</p>
                      </div>
                      <button
                        className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        onClick={() => handleLogServiceForAlert(e.id)}
                        type="button"
                      >
                        Log Service
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                <h3 className="text-lg font-black">AMC Expiring</h3>
              </div>
            </CardHeader>
            <CardContent>
              {alertData.amcExpiring.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No AMC expirations soon</p>
              ) : (
                <div className="space-y-2">
                  {alertData.amcExpiring.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3">
                      <div>
                        <p className="text-sm font-bold">{e.name}</p>
                        <p className="text-xs text-amber-700">Expires: {e.amc_expiry}</p>
                      </div>
                      <button
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        onClick={() => { /* AMC renew would go here */ showToast("AMC renewal coming soon", "info"); }}
                        type="button"
                      >
                        Renew AMC
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Detail panel */}
      {selectedEq ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Equipment Detail</p>
                <h3 className="text-xl font-black">{selectedEq.name}</h3>
              </div>
              <Button onClick={() => setSelectedEq(null)} size="sm" variant="secondary">Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              {selectedEq.image_url ? (
                <Image
                  alt={`${selectedEq.name} equipment`}
                  className="h-56 w-full object-cover"
                  height={224}
                  src={selectedEq.image_url}
                  unoptimized
                  width={896}
                />
              ) : (
                <div className="flex h-56 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImagePlus className="size-8" />
                  <p className="text-sm font-semibold">No equipment image added yet</p>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <Badge className={typeBadgeClass[selectedEq.equipment_type] ?? ""}>{formatEnterpriseLabel(selectedEq.equipment_type)}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={statusBadgeClass[selectedEq.status] ?? ""}>{formatEnterpriseLabel(selectedEq.status)}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="text-sm font-bold">{dashboard.branches.find((b) => b.id === selectedEq.branch_id)?.name ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-bold">{selectedEq.location ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Brand / Model</p>
                <p className="text-sm font-bold">{[selectedEq.brand, selectedEq.model].filter(Boolean).join(" ") || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serial</p>
                <p className="text-sm font-bold">{selectedEq.serial_number ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Purchase</p>
                <p className="text-sm font-bold">{selectedEq.purchase_date ? `${selectedEq.purchase_date} · ${selectedEq.purchase_price != null ? formatCurrency(selectedEq.purchase_price) : ""}` : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warranty</p>
                <p className={`text-sm font-bold ${selectedEq.warranty_expiry && selectedEq.warranty_expiry < new Date().toISOString().slice(0, 10) ? "text-red-600" : ""}`}>{selectedEq.warranty_expiry ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Service</p>
                <p className="text-sm font-bold">{selectedEq.last_service_date ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next Service</p>
                <p className={`text-sm font-bold ${selectedEq.next_service_date && selectedEq.next_service_date < new Date().toISOString().slice(0, 10) ? "text-red-600" : ""}`}>{selectedEq.next_service_date ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Service Interval</p>
                <p className="text-sm font-bold">{selectedEq.service_interval_days} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AMC</p>
                <p className="text-sm font-bold">{selectedEq.amc_provider ? `${selectedEq.amc_provider} · ${selectedEq.amc_expiry ?? "N/A"}` : "N/A"}</p>
              </div>
            </div>
            {selectedEq.notes ? (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{selectedEq.notes}</p>
              </div>
            ) : null}

            {/* Service log */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold">Service History</p>
                <Button onClick={() => setShowServiceForm(true)} size="sm" variant="secondary">
                  <Plus className="size-3.5" /> Log Service
                </Button>
              </div>
              {showServiceForm ? (
                <div className="rounded-lg border border-border bg-background p-4 mb-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Service Date</label>
                      <input className={selectClass} type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Type</label>
                      <select className={selectClass} value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceLogRow["service_type"])}>
                        {SERVICE_TYPES.map((t) => <option key={t} value={t}>{formatEnterpriseLabel(t)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Cost</label>
                      <input className={selectClass} type="number" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Provider</label>
                      <input className={selectClass} value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} placeholder="Company name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Technician</label>
                      <input className={selectClass} value={serviceTech} onChange={(e) => setServiceTech(e.target.value)} placeholder="Name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold">Description</label>
                      <input className={selectClass} value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} placeholder="Service notes" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleLogService} size="sm">Save Service Log</Button>
                    <Button onClick={() => setShowServiceForm(false)} size="sm" variant="secondary">Cancel</Button>
                  </div>
                </div>
              ) : null}
              {serviceLoading ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading history...</p>
              ) : serviceHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No service history</p>
              ) : (
                <div className="space-y-2">
                  {serviceHistory.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={log.service_type === "routine" ? "border-green-200 bg-green-50 text-green-700" : log.service_type === "repair" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                            {formatEnterpriseLabel(log.service_type)}
                          </Badge>
                          <span className="text-sm font-bold">{log.service_date}</span>
                        </div>
                        {log.description ? <p className="mt-1 text-xs text-muted-foreground">{log.description}</p> : null}
                      </div>
                      <div className="text-right">
                        {log.cost != null ? <p className="text-sm font-bold">{formatCurrency(log.cost)}</p> : null}
                        {log.service_provider ? <p className="text-xs text-muted-foreground">{log.service_provider}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Drawer for Add/Edit */}
      <OrgOwnerDrawer
        open={drawerOpen}
        onClose={() => { stopPolling(); resetForm(); setDrawerOpen(false); }}
        title={editingId ? "Edit Equipment" : "Add Equipment"}
        description="Track gym equipment, maintenance schedules, and warranties."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DrawerField label="Name" required>
              <input className={selectClass} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Treadmill Pro" />
            </DrawerField>
            <DrawerField label="Type">
              <select className={selectClass} value={formType} onChange={(e) => setFormType(e.target.value as EquipmentRow["equipment_type"])}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{formatEnterpriseLabel(t)}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Branch">
              <select className={selectClass} value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)}>
                <option value="">None</option>
                {dashboard.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Brand">
              <input className={selectClass} value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="e.g. Life Fitness" />
            </DrawerField>
            <DrawerField label="Model">
              <input className={selectClass} value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="e.g. T5" />
            </DrawerField>
            <DrawerField label="Serial Number">
              <input className={selectClass} value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="ABC-123" />
            </DrawerField>
            <DrawerField label="Purchase Date">
              <input className={selectClass} type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
            </DrawerField>
            <DrawerField label="Purchase Price">
              <input className={selectClass} type="number" value={formPurchasePrice} onChange={(e) => setFormPurchasePrice(e.target.value)} placeholder="0" />
            </DrawerField>
            <DrawerField label="Warranty Expiry">
              <input className={selectClass} type="date" value={formWarrantyExpiry} onChange={(e) => setFormWarrantyExpiry(e.target.value)} />
            </DrawerField>
            <DrawerField label="Service Interval (days)">
              <input className={selectClass} type="number" value={formServiceInterval} onChange={(e) => setFormServiceInterval(e.target.value)} />
            </DrawerField>
            <DrawerField label="AMC Provider">
              <input className={selectClass} value={formAmcProvider} onChange={(e) => setFormAmcProvider(e.target.value)} placeholder="e.g. FitServ Ltd." />
            </DrawerField>
            <DrawerField label="AMC Expiry">
              <input className={selectClass} type="date" value={formAmcExpiry} onChange={(e) => setFormAmcExpiry(e.target.value)} />
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} value={formStatus} onChange={(e) => setFormStatus(e.target.value as EquipmentRow["status"])}>
                {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{formatEnterpriseLabel(s)}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Location">
              <input className={selectClass} value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="e.g. Floor 1, Zone A" />
            </DrawerField>
          </div>
          <DrawerField label="Notes">
            <input className={selectClass} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any additional notes" />
          </DrawerField>
          <div className="space-y-4 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <ImagePlus className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-black">Equipment Image</p>
                <p className="text-xs text-muted-foreground">Upload a real photo or generate a realistic AI preview before saving.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${imageMode === "upload" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"}`}
                disabled={jobPollStatus === "submitting" || jobPollStatus === "queued" || jobPollStatus === "processing"}
                onClick={() => {
                  setImageMode("upload");
                  setImageErrorMessage(null);
                  stopPolling();
                }}
                type="button"
              >
                <Upload className="size-4" />
                Upload from device
              </button>
              <button
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${imageMode === "ai" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"}`}
                disabled={jobPollStatus === "submitting" || jobPollStatus === "queued" || jobPollStatus === "processing"}
                onClick={() => {
                  setImageMode("ai");
                  setImageErrorMessage(null);
                }}
                type="button"
              >
                <Sparkles className="size-4" />
                Generate with AI
              </button>
            </div>

            {/* Completed AI job preview (ready to accept) */}
            {jobPollStatus === "ready" && pendingAiPreview ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  <Image
                    alt={`${formName || "Equipment"} AI preview`}
                    className="h-52 w-full object-cover"
                    height={208}
                    src={pendingAiPreview.previewUrl}
                    unoptimized
                    width={896}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { void acceptJobImage(); }} size="sm" variant="secondary">
                    <ImagePlus className="size-3.5" /> Use this image
                  </Button>
                  <Button onClick={() => { void handleGenerateImage(); }} size="sm" variant="secondary">
                    <RefreshCw className="size-3.5" /> Generate again
                  </Button>
                </div>
                {pendingAiPreview.prompt ? (
                  <p className="text-xs text-muted-foreground">AI prompt: {pendingAiPreview.prompt}</p>
                ) : null}
                {imageStatusMessage ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                    {imageStatusMessage}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Job in progress (queued / processing) */}
            {jobPollStatus === "submitting" || jobPollStatus === "queued" || jobPollStatus === "processing" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-6">
                  <Loader2 className="size-6 animate-spin text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">
                      {jobPollStatus === "submitting" ? "Submitting request..."
                      : jobPollStatus === "queued" ? "Queued — waiting to process..."
                      : "Generating image with AI..."}
                    </p>
                    <p className="text-xs text-blue-700">This typically takes a few seconds.</p>
                  </div>
                </div>
                {imageStatusMessage ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                    {imageStatusMessage}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Failed job state */}
            {jobPollStatus === "failed" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-bold text-red-800">Image generation failed</p>
                  <p className="mt-1 text-xs text-red-700">{jobErrorMsg || "An unknown error occurred."}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { void handleGenerateImage(); }} size="sm" variant="secondary">
                    <RefreshCw className="size-3.5" /> Retry
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Existing equipment image (persisted) */}
            {equipmentImage && jobPollStatus !== "ready" && jobPollStatus !== "submitting" && jobPollStatus !== "queued" && jobPollStatus !== "processing" && jobPollStatus !== "failed" ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  <Image
                    alt={`${formName || "Equipment"} preview`}
                    className="h-52 w-full object-cover"
                    height={208}
                    src={equipmentImage.previewUrl}
                    unoptimized
                    width={896}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {equipmentImage.source === "ai" ? (
                    <Button disabled={jobPollStatus === "submitting" || jobPollStatus === "queued" || jobPollStatus === "processing"} onClick={() => { void handleGenerateImage(); }} size="sm" variant="secondary">
                      <RefreshCw className="size-3.5" />
                      Regenerate
                    </Button>
                  ) : null}
                  <Button onClick={handleRemoveImage} size="sm" variant="secondary">
                    <XCircle className="size-3.5" /> Remove Image
                  </Button>
                </div>
                {equipmentImage.source === "ai" && equipmentImage.prompt ? (
                  <p className="text-xs text-muted-foreground">AI prompt: {equipmentImage.prompt}</p>
                ) : null}
              </div>
            ) : null}

            {imageStatusMessage && jobPollStatus !== "ready" && jobPollStatus !== "submitting" && jobPollStatus !== "queued" && jobPollStatus !== "processing" && jobPollStatus !== "failed" && !(equipmentImage && jobPollStatus !== "ready") ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                {imageStatusMessage}
              </div>
            ) : null}

            {imageErrorMessage && jobPollStatus !== "failed" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {imageErrorMessage}
              </div>
            ) : null}

            {/* Upload file input */}
            {imageMode === "upload" && !equipmentImage ? (
              <DrawerField label="Upload Image">
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
                  onChange={(e) => handleUploadSelection(e.target.files?.[0] ?? null)}
                  type="file"
                />
              </DrawerField>
            ) : null}

            {/* AI prompt + generate button (visible when no active job and no equipment image) */}
            {imageMode === "ai" && !jobPollStatus && !pendingAiPreview && !equipmentImage ? (
              <div className="space-y-3">
                <DrawerField label="AI Prompt Refinement">
                  <textarea
                    className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    maxLength={300}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Optional: matte black frame, premium studio lighting, side angle..."
                    value={imagePrompt}
                  />
                </DrawerField>
                <Button onClick={() => { void handleGenerateImage(); }} size="sm" variant="secondary">
                  <Sparkles className="size-3.5" />
                  Generate Realistic Image
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 pt-2">
            <Button disabled={imageLoading || jobPollStatus === "submitting" || jobPollStatus === "queued" || jobPollStatus === "processing"} onClick={handleSave} size="sm">{editingId ? "Update" : "Create"}</Button>
            <Button disabled={jobPollStatus === "submitting"} onClick={() => { resetForm(); setDrawerOpen(false); }} size="sm" variant="secondary">Cancel</Button>
          </div>
        </div>
      </OrgOwnerDrawer>
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
      <GenericConfirmDialog
        danger
        confirmLabel="Delete"
        itemName={pendingDelete?.name ?? ""}
        loading={false}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { void handleConfirmDelete(); }}
        open={pendingDelete !== null}
        title="Delete Equipment?"
        warning="This action cannot be undone. Equipment history and service logs may remain linked to your organization."
      />
    </div>
  );
}
