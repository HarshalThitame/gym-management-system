/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const CACHE_SECONDS = 15;

export type ObservabilityDashboard = {
  platformHealth: {
    overallScore: number; uptimePercent: number; availabilityScore: number;
    reliabilityScore: number; slaCompliance: number; errorRate: number;
    activeIncidents: number; openAlerts: number; criticalServices: number; totalServices: number;
    criticalServicesHealthy: number; criticalServicesDegraded: number; criticalServicesDown: number;
  };
  services: Array<{ id: string; name: string; version: string; type: string; status: string; description: string; ownerTeam: string; responseTime: number; errorRate: number; lastCheck: string; dependencies: string[] }>;
  incidents: Array<{ id: string; number: number; title: string; severity: string; status: string; serviceName: string; detectedAt: string; ownerId: string | null; rootCause: string | null; timelineCount?: number }>;
  queues: Array<{ id: string; name: string; type: string; depth: number; processingRate: number; retryCount: number; failureCount: number; successCount: number; avgLatency: number; status: string }>;
  cronJobs: Array<{ id: string; name: string; type: string; schedule: string; status: string; lastRun: string | null; nextRun: string | null; lastDuration: number | null; avgDuration: number | null; successCount: number; failureCount: number; isOverdue: boolean }>;
  errors: Array<{ id: string; type: string; message: string; severity: string; service: string; frequency: number; firstSeen: string; lastSeen: string; isResolved: boolean }>;
  oncallSchedules: Array<{ id: string; name: string; team: string; level: number; primaryUser: string | null; backupUser: string | null; rotationType: string; isActive: boolean }>;
  statusComponents: Array<{ id: string; pageId: string; serviceId: string | null; name: string; status: string; displayOrder: number }>;
  capacityMetrics: Array<{ id: string; type: string; currentValue: number; forecast30d: number | null; forecast90d: number | null; growthRate: number | null; limit: number | null; usagePercent: number | null }>;
  tenantHealth: Array<{ id: string; orgId: string; availabilityScore: number; errorCount: number; healthScore: number; lastCheck: string }>;
  escalationPolicies: Array<{ id: string; name: string; description: string | null; levels: Array<{ level: number; name: string; timeout: number }> }>;
  // NEW: Advanced features
  traces: Array<{ id: string; traceId: string; spanName: string; serviceName: string; durationMs: number; statusCode: string; startTime: string; attributes: Record<string, any>; events: Array<{ name: string; timestamp: string }> }>;
  tracesByService: Array<{ service: string; count: number; avgDuration: number; errorCount: number; p95: number }>;
  infraMetrics: Array<{ id: string; hostName: string; hostRole: string; region: string; cpuPct: number | null; memPct: number | null; diskPct: number | null; loadAvg1: number | null; collectedAt: string }>;
  infraSummary: { totalHosts: number; avgCpu: number; avgMem: number; avgDisk: number; criticalHosts: number; hostsByRole: Array<{ role: string; count: number }> };
  containerMetrics: Array<{ id: string; podName: string; nodeName: string; namespace: string; containerName: string; restartCount: number; status: string; deploymentName: string | null }>;
  containerSummary: { totalPods: number; running: number; failed: number; crashLoop: number; totalRestarts: number };
  sloDefinitions: Array<{ id: string; name: string; description: string | null; serviceName: string; metricSource: string; targetValue: number; windowDays: number; errorBudgetInitial: number; errorBudgetRemaining: number; isActive: boolean; ownerTeam: string | null }>;
  sloCompliance: Array<{ id: string; sloId: string; compliancePct: number; errorBudgetRemaining: number; burnRate: number | null; goodEvents: number; totalEvents: number; windowStart: string; windowEnd: string }>;
  errorBudgetSummary: Array<{ sloName: string; serviceName: string; budgetRemaining: number; budgetPercent: number; burnRate: number; riskStatus: string }>;
  deployments: Array<{ id: string; serviceName: string; version: string; status: string; commitMessage: string | null; deployedBy: string | null; durationMs: number | null; startedAt: string; completedAt: string | null }>;
  liveMetrics: Array<{ id: number; metricName: string; metricValue: number; tags: Record<string, any>; recordedAt: string }>;
  regions: Array<{ id: string; name: string; code: string; provider: string; healthStatus: string; isActive: boolean }>;
  drStatus: Array<{ id: string; planName: string; status: string; lastTestedAt: string | null; estimatedRto: number | null; estimatedRpo: number | null; hasAutoFailover: boolean; secondaryRegion: string | null }>;
  statusPageSubscribers: Array<{ id: string; email: string; isVerified: boolean; subscribedAt: string; statusPageId: string }>;
  dependencyGraph: Array<{ source: string; target: string; weight: number }>;
};

export async function getObservabilityDashboard(): Promise<ObservabilityDashboard> {
  return getCachedObservabilityDashboard();
}

const getCachedObservabilityDashboard = unstable_cache(
  async (): Promise<ObservabilityDashboard> => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return getEmptyDashboard();
    const s = supabase as any;

    try {
      const [
        svcRes, incRes, qRes, cronRes, errRes, ocRes, scRes, capRes, thRes, epRes,
        traceRes, infraRes, containerRes, sloDefRes, sloCompRes, deployRes, liveRes,
        regionRes, drRes, subRes
      ] = await Promise.all([
        s.from("observability_services").select("*").order("service_name"),
        s.from("observability_incidents").select("*").order("detected_at", { ascending: false }).limit(50),
        s.from("observability_queues").select("*").order("queue_name"),
        s.from("observability_cron_jobs").select("*").order("job_name"),
        s.from("observability_errors").select("*").order("last_seen_at", { ascending: false }).limit(100),
        s.from("observability_oncall_schedules").select("*").order("escalation_level"),
        s.from("observability_status_components").select("*").order("display_order"),
        s.from("observability_capacity_metrics").select("*").order("recorded_at", { ascending: false }).limit(50),
        s.from("observability_tenant_health").select("*").order("health_score", { ascending: true }).limit(20),
        s.from("observability_escalation_policies").select("*").limit(10),
        s.from("obs_tracing_spans").select("*").order("start_time", { ascending: false }).limit(100),
        s.from("obs_infra_metrics").select("*").order("collected_at", { ascending: false }).limit(100),
        s.from("obs_container_metrics").select("*").order("collected_at", { ascending: false }).limit(100),
        s.from("obs_slo_definitions").select("*").order("slo_name"),
        s.from("obs_slo_compliance").select("*").order("recorded_at", { ascending: false }).limit(50),
        s.from("obs_deployments").select("*").order("started_at", { ascending: false }).limit(50),
        s.from("obs_live_metrics").select("*").order("recorded_at", { ascending: false }).limit(200),
        s.from("obs_regions").select("*").order("region_name"),
        s.from("obs_dr_status").select("*"),
        s.from("obs_status_subscribers").select("*").order("subscribed_at", { ascending: false })
      ]);

      const services = svcRes?.data ?? [];
      const incidents = incRes?.data ?? [];
      const queues = qRes?.data ?? [];
      const cronJobs = cronRes?.data ?? [];
      const errors = errRes?.data ?? [];
      const oncall = ocRes?.data ?? [];
      const statusComponents = scRes?.data ?? [];
      const capacityMetrics = capRes?.data ?? [];
      const tenantHealthRows = thRes?.data ?? [];
      const escalationPolicies = epRes?.data ?? [];
      const traces = traceRes?.data ?? [];
      const infraMetrics = infraRes?.data ?? [];
      const containerMetrics = containerRes?.data ?? [];
      const sloDefs = sloDefRes?.data ?? [];
      const sloComps = sloCompRes?.data ?? [];
      const deployments = deployRes?.data ?? [];
      const liveMetrics = liveRes?.data ?? [];
      const regions = regionRes?.data ?? [];
      const drRows = drRes?.data ?? [];
      const subscribers = subRes?.data ?? [];

      const healthyCount = services.filter((s: any) => s.status === "healthy").length;
      const totalCount = services.length;
      const degradedCount = services.filter((s: any) => s.status === "degraded").length;
      const downCount = services.filter((s: any) => s.status === "down").length;
      const critSvcs = services.filter((s: any) => ["api", "database", "auth", "payment"].includes(s.service_type));
      const critHealthy = critSvcs.filter((s: any) => s.status === "healthy").length;
      const critDegraded = critSvcs.filter((s: any) => s.status === "degraded").length;
      const critDown = critSvcs.filter((s: any) => s.status === "down").length;
      const activeIncidents = incidents.filter((i: any) => !["resolved", "closed"].includes(i.status)).length;
      const openAlerts = errors.filter((e: any) => !e.is_resolved && ["critical", "high"].includes(e.severity)).length;
      const errorRate = totalCount > 0 ? Math.round((degradedCount + downCount) / totalCount * 100) : 0;

      // Traces by service
      const traceBySvc = new Map<string, { count: number; totalDuration: number; errors: number; durations: number[] }>();
      for (const t of traces) {
        const key = t.service_name ?? "unknown";
        if (!traceBySvc.has(key)) traceBySvc.set(key, { count: 0, totalDuration: 0, errors: 0, durations: [] });
        const s = traceBySvc.get(key)!;
        s.count++; s.totalDuration += (t.duration_ms ?? 0); s.durations.push(t.duration_ms ?? 0);
        if (t.status_code === "error") s.errors++;
      }
      const tracesByService = Array.from(traceBySvc.entries()).map(([service, data]) => ({
        service, count: data.count, avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
        errorCount: data.errors,
        p95: data.durations.length > 0 ? (data.durations.sort((a, b) => a - b)[Math.floor(data.durations.length * 0.95)] ?? 0) : 0
      }));

      // Infra summary
      const hosts = new Set(infraMetrics.map((m: any) => m.host_name));
      const avgCpu = infraMetrics.length > 0 ? Math.round(infraMetrics.reduce((s: number, m: any) => s + Number(m.cpu_usage_pct ?? 0), 0) / infraMetrics.length) : 0;
      const avgMem = infraMetrics.length > 0 ? Math.round(infraMetrics.reduce((s: number, m: any) => s + Number(m.memory_usage_pct ?? 0), 0) / infraMetrics.length) : 0;
      const avgDisk = infraMetrics.length > 0 ? Math.round(infraMetrics.reduce((s: number, m: any) => s + Number(m.disk_usage_pct ?? 0), 0) / infraMetrics.length) : 0;
      const criticalHosts = infraMetrics.filter((m: any) => Number(m.cpu_usage_pct ?? 0) > 90 || Number(m.memory_usage_pct ?? 0) > 90 || Number(m.disk_usage_pct ?? 0) > 90).length;
      const hostsByRole = Array.from(new Set(infraMetrics.map((m: any) => m.host_role))).map((role: any) => ({
        role, count: new Set(infraMetrics.filter((m: any) => m.host_role === role).map((m: any) => m.host_name)).size
      }));

      // Container summary
      const containerSummary = {
        totalPods: new Set(containerMetrics.map((m: any) => m.pod_name)).size,
        running: containerMetrics.filter((m: any) => m.status === "running").length,
        failed: containerMetrics.filter((m: any) => m.status === "failed").length,
        crashLoop: containerMetrics.filter((m: any) => m.status === "crash_loop_backoff").length,
        totalRestarts: containerMetrics.reduce((s: number, m: any) => s + (m.restart_count ?? 0), 0)
      };

      // Error budget summary
      const errorBudgetSummary = sloDefs.slice(0, 10).map((slo: any) => {
        const latestComp = sloComps.filter((c: any) => c.slo_id === slo.id).sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
        const remaining = latestComp?.error_budget_remaining ?? slo.error_budget_remaining;
        const pct = slo.error_budget_initial > 0 ? Math.round(remaining / slo.error_budget_initial * 100) : 0;
        const burnRate = latestComp?.error_budget_burn_rate ?? 0;
        return {
          sloName: slo.slo_name, serviceName: slo.service_name,
          budgetRemaining: remaining, budgetPercent: pct, burnRate,
          riskStatus: pct <= 0 ? "exhausted" : pct < 20 ? "critical" : pct < 50 ? "high" : pct < 80 ? "medium" : "healthy"
        };
      });

      // Dependency graph edges
      const depGraph: Array<{ source: string; target: string; weight: number }> = [];
      for (const svc of services) {
        if (svc.dependencies && Array.isArray(svc.dependencies)) {
          for (const dep of svc.dependencies) {
            depGraph.push({ source: dep, target: svc.service_name, weight: 1 });
          }
        }
      }

      return {
        platformHealth: {
          overallScore: Math.max(0, 100 - (downCount * 15 + degradedCount * 5 + Math.round(activeIncidents * 3))),
          uptimePercent: totalCount > 0 ? Math.round((healthyCount / totalCount) * 10000) / 100 : 0,
          availabilityScore: Math.max(0, 100 - errorRate),
          reliabilityScore: Math.max(0, 100 - Math.round(incidents.filter((i: any) => i.severity === "sev1_critical").length * 5)),
          slaCompliance: Math.max(0, 100 - errorRate * 2),
          errorRate, activeIncidents, openAlerts,
          criticalServices: critSvcs.length, totalServices: totalCount,
          criticalServicesHealthy: critHealthy, criticalServicesDegraded: critDegraded, criticalServicesDown: critDown
        },
        services: services.map((s: any) => ({
          id: s.id, name: s.service_name, version: s.service_version, type: s.service_type,
          status: s.status, description: s.description ?? "", ownerTeam: s.owner_team ?? "Unassigned",
          responseTime: 0, errorRate: 0, lastCheck: s.last_health_check_at ?? s.created_at, dependencies: s.dependencies ?? []
        })),
        incidents: incidents.slice(0, 25).map((i: any) => ({
          id: i.id, number: i.incident_number, title: i.title, severity: i.severity,
          status: i.status, serviceName: i.affected_services?.[0] ?? "Unknown",
          detectedAt: i.detected_at, ownerId: i.owner_id, rootCause: i.root_cause,
          timelineCount: 0
        })),
        queues: queues.map((q: any) => ({
          id: q.id, name: q.queue_name, type: q.queue_type, depth: q.current_depth,
          processingRate: q.processing_rate ?? 0, retryCount: q.retry_count,
          failureCount: q.failure_count, successCount: q.success_count,
          avgLatency: q.avg_processing_time_ms ?? 0, status: q.status
        })),
        cronJobs: cronJobs.map((c: any) => ({
          id: c.id, name: c.job_name, type: c.job_type, schedule: c.schedule,
          status: c.status, lastRun: c.last_run_at, nextRun: c.next_run_at,
          lastDuration: c.last_duration_ms, avgDuration: c.average_duration_ms,
          successCount: c.success_count, failureCount: c.failure_count, isOverdue: c.is_overdue ?? false
        })),
        errors: errors.slice(0, 50).map((e: any) => ({
          id: e.id, type: e.error_type, message: e.error_message, severity: e.severity,
          service: e.service_name ?? "Unknown", frequency: e.frequency,
          firstSeen: e.first_seen_at, lastSeen: e.last_seen_at, isResolved: e.is_resolved
        })),
        oncallSchedules: oncall.map((o: any) => ({
          id: o.id, name: o.schedule_name, team: o.team_name, level: o.escalation_level,
          primaryUser: o.primary_user_id, backupUser: o.backup_user_id,
          rotationType: o.rotation_type, isActive: o.is_active
        })),
        statusComponents: statusComponents.map((sc: any) => ({
          id: sc.id, pageId: sc.status_page_id, serviceId: sc.service_id,
          name: sc.name, status: sc.status, displayOrder: sc.display_order
        })),
        capacityMetrics: capacityMetrics.slice(0, 10).map((cm: any) => ({
          id: cm.id, type: cm.metric_type, currentValue: Number(cm.current_value),
          forecast30d: cm.forecast_value_30d ? Number(cm.forecast_value_30d) : null,
          forecast90d: cm.forecast_value_90d ? Number(cm.forecast_value_90d) : null,
          growthRate: cm.growth_rate ? Number(cm.growth_rate) : null,
          limit: cm.capacity_limit ? Number(cm.capacity_limit) : null,
          usagePercent: cm.usage_percent ? Number(cm.usage_percent) : null
        })),
        tenantHealth: tenantHealthRows.map((th: any) => ({
          id: th.id, orgId: th.organization_id, availabilityScore: th.availability_score,
          errorCount: th.error_count, healthScore: th.health_score, lastCheck: th.checked_at
        })),
        escalationPolicies: escalationPolicies.map((ep: any) => ({
          id: ep.id, name: ep.policy_name, description: ep.description,
          levels: (ep.levels ?? []).map((l: any) => ({ level: l.level, name: l.name, timeout: l.timeout_minutes ?? 0 }))
        })),
        // Advanced features
        traces: traces.slice(0, 50).map((t: any) => ({
          id: t.id, traceId: t.trace_id, spanName: t.span_name,
          serviceName: t.service_name, durationMs: t.duration_ms ?? 0,
          statusCode: t.status_code, startTime: t.start_time,
          attributes: t.attributes ?? {},
          events: (t.events ?? []).map((e: any) => ({ name: e.name ?? e, timestamp: e.timestamp ?? "" }))
        })),
        tracesByService,
        infraMetrics: infraMetrics.slice(0, 50).map((m: any) => ({
          id: m.id, hostName: m.host_name, hostRole: m.host_role, region: m.region,
          cpuPct: m.cpu_usage_pct, memPct: m.memory_usage_pct, diskPct: m.disk_usage_pct,
          loadAvg1: m.load_avg_1m, collectedAt: m.collected_at
        })),
        infraSummary: { totalHosts: hosts.size, avgCpu, avgMem, avgDisk, criticalHosts, hostsByRole },
        containerMetrics: containerMetrics.slice(0, 50).map((m: any) => ({
          id: m.id, podName: m.pod_name, nodeName: m.node_name, namespace: m.namespace,
          containerName: m.container_name, restartCount: m.restart_count,
          status: m.status, deploymentName: m.deployment_name
        })),
        containerSummary,
        sloDefinitions: sloDefs.map((s: any) => ({
          id: s.id, name: s.slo_name, description: s.slo_description,
          serviceName: s.service_name, metricSource: s.metric_source,
          targetValue: Number(s.target_value), windowDays: s.window_days,
          errorBudgetInitial: Number(s.error_budget_initial),
          errorBudgetRemaining: Number(s.error_budget_remaining),
          isActive: s.is_active, ownerTeam: s.owner_team
        })),
        sloCompliance: sloComps.map((c: any) => ({
          id: c.id, sloId: c.slo_id, compliancePct: Number(c.compliance_pct),
          errorBudgetRemaining: Number(c.error_budget_remaining),
          burnRate: c.error_budget_burn_rate ? Number(c.error_budget_burn_rate) : null,
          goodEvents: c.good_events, totalEvents: c.total_events,
          windowStart: c.window_start, windowEnd: c.window_end
        })),
        errorBudgetSummary,
        deployments: deployments.slice(0, 20).map((d: any) => ({
          id: d.id, serviceName: d.service_name, version: d.version, status: d.status,
          commitMessage: d.commit_message, deployedBy: d.deployed_by,
          durationMs: d.duration_ms, startedAt: d.started_at, completedAt: d.completed_at
        })),
        liveMetrics: liveMetrics.slice(0, 100).map((m: any) => ({
          id: m.id, metricName: m.metric_name, metricValue: Number(m.metric_value),
          tags: m.tags ?? {}, recordedAt: m.recorded_at
        })),
        regions: regions.map((r: any) => ({
          id: r.id, name: r.region_name, code: r.region_code, provider: r.provider,
          healthStatus: r.health_status, isActive: r.is_active
        })),
        drStatus: drRows.map((d: any) => ({
          id: d.id, planName: d.dr_plan_name, status: d.status,
          lastTestedAt: d.last_tested_at, estimatedRto: d.estimated_recovery_time_minutes,
          estimatedRpo: d.estimated_data_loss_minutes, hasAutoFailover: d.is_automatic_failover,
          secondaryRegion: d.secondary_region
        })),
        statusPageSubscribers: subscribers.map((s: any) => ({
          id: s.id, email: s.email, isVerified: s.is_verified,
          subscribedAt: s.subscribed_at, statusPageId: s.status_page_id
        })),
        dependencyGraph: depGraph
      };
    } catch (err: any) {
      console.error("Observability fetch error:", err.message);
      return getEmptyDashboard();
    }
  },
  ["observability-advanced-dashboard"],
  { revalidate: CACHE_SECONDS }
);

function getEmptyDashboard(): ObservabilityDashboard {
  return {
    platformHealth: { overallScore: 0, uptimePercent: 0, availabilityScore: 0, reliabilityScore: 0, slaCompliance: 0, errorRate: 0, activeIncidents: 0, openAlerts: 0, criticalServices: 0, totalServices: 0, criticalServicesHealthy: 0, criticalServicesDegraded: 0, criticalServicesDown: 0 },
    services: [], incidents: [], queues: [], cronJobs: [], errors: [], oncallSchedules: [], statusComponents: [], capacityMetrics: [], tenantHealth: [], escalationPolicies: [],
    traces: [], tracesByService: [], infraMetrics: [], infraSummary: { totalHosts: 0, avgCpu: 0, avgMem: 0, avgDisk: 0, criticalHosts: 0, hostsByRole: [] }, containerMetrics: [], containerSummary: { totalPods: 0, running: 0, failed: 0, crashLoop: 0, totalRestarts: 0 },
    sloDefinitions: [], sloCompliance: [], errorBudgetSummary: [], deployments: [], liveMetrics: [], regions: [], drStatus: [], statusPageSubscribers: [], dependencyGraph: []
  };
}
