import { useRef, useEffect, useCallback } from "react";

const METRICS: Record<string, number[]> = {};

export function usePerformanceMonitor(screenName: string) {
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();
    return () => {
      const duration = Date.now() - startTime.current;
      trackMetric(`screen:${screenName}`, duration);
    };
  }, [screenName]);

  const trackApiCall = useCallback((endpoint: string, durationMs: number) => {
    trackMetric(`api:${endpoint}`, durationMs);
  }, []);

  const trackQuery = useCallback((queryName: string, durationMs: number) => {
    trackMetric(`query:${queryName}`, durationMs);
  }, []);

  return { trackApiCall, trackQuery };
}

function trackMetric(name: string, value: number) {
  if (!METRICS[name]) METRICS[name] = [];
  METRICS[name].push(value);
  if (METRICS[name].length > 100) METRICS[name].shift();

  if (__DEV__ && value > 2000) {
    console.warn(`[PERF] ${name} took ${value}ms`);
  }
}

export function getPerformanceReport(): Record<string, { avg: number; min: number; max: number; count: number }> {
  const report: Record<string, { avg: number; min: number; max: number; count: number }> = {};
  for (const [key, values] of Object.entries(METRICS)) {
    report[key] = {
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }
  return report;
}
