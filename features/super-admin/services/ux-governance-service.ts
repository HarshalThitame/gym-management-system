import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

export type ViolationSeverity = "violation" | "warning" | "info";

export type Violation = {
  severity: ViolationSeverity;
  file: string;
  line: number;
  value: string;
  description: string;
};

export type CategoryScore = {
  id: string;
  label: string;
  score: number;
  status: "pass" | "warning" | "fail";
  violations: Violation[];
  detail: string;
  passed: number;
  total: number;
};

export type BundleInfo = {
  totalSourceSize: number;
  largeFiles: { file: string; size: number }[];
  totalFileCount: number;
};

export type AuditResult = {
  timestamp: string;
  overallScore: number;
  categories: CategoryScore[];
  bundle: BundleInfo;
  summary: {
    totalViolations: number;
    totalWarnings: number;
    passedCategories: number;
    totalCategories: number;
  };
};

const EXCLUDE = new Set(["node_modules", ".next", ".git", "dist", "build", ".turbo", "public", "coverage"]);
const SRC_EXT = new Set([".tsx", ".ts"]);
const ROOT = process.cwd();

function walk(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const e of readdirSync(dir)) {
      if (EXCLUDE.has(e) || e.startsWith(".")) continue;
      const p = join(dir, e);
      const s = statSync(p);
      if (s.isDirectory()) files.push(...walk(p));
      else if (s.isFile() && SRC_EXT.has(extname(e))) files.push(p);
    }
  } catch {}
  return files;
}

function walkTsx(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const e of readdirSync(dir)) {
      if (e.startsWith(".")) continue;
      const p = join(dir, e);
      const s = statSync(p);
      if (s.isDirectory()) files.push(...walkTsx(p));
      else if (s.isFile() && extname(e) === ".tsx") files.push(p);
    }
  } catch {}
  return files;
}

function sourceFiles(): string[] {
  const files: string[] = [];
  for (const d of ["app", "components", "features", "lib"]) {
    try {
      for (const e of readdirSync(join(ROOT, d))) {
        if (e.startsWith(".")) continue;
        const p = join(ROOT, d, e);
        const s = statSync(p);
        if (s.isDirectory()) files.push(...walk(p));
        else if (s.isFile() && SRC_EXT.has(extname(e))) files.push(p);
      }
    } catch {}
  }
  return files;
}

function isMultipleOf4(value: string): boolean {
  const num = parseInt(value, 10);
  if (isNaN(num)) return true;
  return num % 4 === 0;
}

function spacingViolationSeverity(value: string): ViolationSeverity | null {
  const pxMatch = value.match(/^(\d+)px$/);
  if (pxMatch) {
    const num = parseInt(pxMatch[1]!, 10);
    if (num % 4 !== 0) return "warning";
    return null;
  }
  if (/^\d/.test(value)) return "warning";
  return null;
}

export function scanDesignTokens(): { violations: Violation[]; score: number } {
  const files = sourceFiles();
  const violations: Violation[] = [];
  const hexPat = /(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))/g;
  const rgbPat = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
  const styleContainer = /\bstyle\s*=\s*(?:\{|\{`|"|')/gi;
  const arbitraryText = /text-\[([^\]]+)\]/g;
  const arbitrarySpace = /(?<![\w-])((?:[pm](?:[xystrble])?|gap(?:-[xy])?|space-[xy])-\[([^\]]+)\])/g;
  const fontPat = /font-family\s*:/gi;

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === "app/globals.css") continue;
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    let inStyleBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("import ") || t.startsWith("export ")) continue;

      if (t.includes("style=") || t.includes("style={")) {
        inStyleBlock = styleContainer.test(line);
        styleContainer.lastIndex = 0;
        if (inStyleBlock) {
          const hexes = line.match(hexPat) ?? [];
          const rgbs = line.match(rgbPat) ?? [];
          const all = [...new Set([...hexes, ...rgbs])];
          for (const v of all) {
            violations.push({ severity: "violation", file: rel, line: i + 1, value: v, description: "Hardcoded color in inline style — use CSS variable" });
          }
        }
      } else if (t.startsWith("style={") || t.startsWith("style={`")) {
        inStyleBlock = true;
      }

      if (line.includes("text-[")) {
        const matches = line.match(arbitraryText) ?? [];
        for (const m of matches) {
          violations.push({ severity: "warning", file: rel, line: i + 1, value: m, description: "Arbitrary text size — use design system typography tokens" });
        }
      }

      const spaceMatches = line.match(arbitrarySpace);
      if (spaceMatches) {
        for (const m of spaceMatches) {
          const valMatch = m.match(/\[([^\]]+)\]/);
          const val = valMatch ? valMatch[1]! : "";
          const sev = spacingViolationSeverity(val);
          if (sev) {
            violations.push({ severity: sev, file: rel, line: i + 1, value: m, description: sev === "warning" ? `Spacing value ${val} doesn't match 4px grid` : `Arbitrary spacing — use design system spacing scale` });
          }
        }
      } else if (/[pmg]\s*\[/.test(line)) {
        const fallback = line.match(/([pm]|gap)-\[([^\]]+)\]/g);
        if (fallback) {
          for (const m of fallback) {
            const valMatch = m.match(/\[([^\]]+)\]/);
            const val = valMatch ? valMatch[1]! : "";
            const sev = spacingViolationSeverity(val);
            if (sev) {
              violations.push({ severity: sev, file: rel, line: i + 1, value: m, description: sev === "warning" ? `Spacing value ${val} doesn't match 4px grid` : `Arbitrary spacing — use design system spacing scale` });
            }
          }
        }
      }

      if (!rel.includes("globals.css") && fontPat.test(line)) {
        violations.push({ severity: "violation", file: rel, line: i + 1, value: line.trim().slice(0, 80), description: "font-family declaration outside globals.css" });
      }
    }
  }

  const vc = violations.filter(v => v.severity === "violation").length;
  const wc = violations.filter(v => v.severity === "warning").length;
  return { violations, score: Math.max(0, Math.min(100, 100 - vc * 5 - wc * 2)) };
}

export function scanAccessibility(): { score: number; violations: Violation[]; attributesFound: number; imagesWithAlt: number; totalImages: number } {
  const files = sourceFiles();
  const violations: Violation[] = [];
  let ariaCount = 0, roleCount = 0, imagesWithAlt = 0, totalImages = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      ariaCount += (line.match(/\b(?:aria-\w+)\s*=/g) ?? []).length;
      roleCount += (line.match(/\brole\s*=\s*["']([^"']+)["']/g) ?? []).length;
      const imgs = line.match(/<img\b[^>]*>/gi);
      if (imgs) {
        for (const img of imgs) {
          totalImages++;
          if (/\balt\s*=\s*["']([^"']*)["']/.test(img)) imagesWithAlt++;
          else violations.push({ severity: "violation", file: rel, line: i + 1, value: img.slice(0, 60), description: "Image missing alt attribute" });
        }
      }
    }
  }

  let score = 100;
  if (totalImages > 0) {
    const r = imagesWithAlt / totalImages;
    if (r < 0.5) score -= 40; else if (r < 0.9) score -= 20; else if (r < 1) score -= 10;
  }
  const totalAttr = ariaCount + roleCount;
  if (totalAttr < 10) score -= 20; else if (totalAttr < 30) score -= 5;

  return { score: Math.max(0, score), violations, attributesFound: totalAttr, imagesWithAlt, totalImages };
}

export function scanComponentUsage(): { score: number; violations: Violation[]; rawButtons: number; rawInputs: number; componentUsagePct: number } {
  const files = sourceFiles();
  const violations: Violation[] = [];
  let rawButtons = 0, rawInputs = 0, buttonComponents = 0, inputComponents = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel.startsWith("components/ui/")) continue;
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes("import ") && line.includes("Button")) buttonComponents++;
      if (line.includes("import ") && line.includes("Input")) inputComponents++;
      const rb = line.match(/<button[\s>]/gi);
      if (rb) { rawButtons += rb.length; violations.push({ severity: "warning", file: rel, line: i + 1, value: "<button>", description: "Raw <button> used instead of <Button> component" }); }
      const ri = line.match(/<input[\s>]/gi);
      if (ri) { rawInputs += ri.length; violations.push({ severity: "warning", file: rel, line: i + 1, value: "<input>", description: "Raw <input> used instead of <Input> component" }); }
    }
  }

  const total = rawButtons + rawInputs + buttonComponents + inputComponents;
  const pct = total > 0 ? Math.round(((buttonComponents + inputComponents) / total) * 100) : 100;

  let score: number;
  if (pct >= 90) score = 100;
  else if (pct >= 75) score = 80;
  else if (pct >= 50) score = 50;
  else if (pct >= 25) score = 25;
  else score = 10;

  return { score, violations, rawButtons, rawInputs, componentUsagePct: pct };
}

function countRouteFiles(suffix: string): number {
  let count = 0;
  for (const d of ["app", "features"]) {
    try {
      const dir = join(ROOT, d);
      for (const e of readdirSync(dir)) {
        if (e.startsWith(".")) continue;
        const p = join(dir, e);
        if (statSync(p).isDirectory()) count += walkTsx(p).filter(f => f.endsWith(suffix)).length;
      }
    } catch {}
  }
  return count;
}

export function scanLoadingStates(): { score: number; violations: Violation[]; loadingCount: number } {
  const loadingCount = countRouteFiles("loading.tsx");
  const violations: Violation[] = [];
  if (loadingCount < 10) violations.push({ severity: "info", file: "app/", line: 0, value: `${loadingCount} loading.tsx`, description: `Only ${loadingCount} loading.tsx files found — target 16+` });
  const score = loadingCount >= 16 ? 100 : loadingCount >= 10 ? 70 : loadingCount >= 5 ? 40 : 10;
  return { score, violations, loadingCount };
}

export function scanErrorStates(): { score: number; violations: Violation[]; errorCount: number } {
  const errorCount = countRouteFiles("error.tsx");
  const violations: Violation[] = [];
  if (errorCount < 10) violations.push({ severity: "info", file: "app/", line: 0, value: `${errorCount} error.tsx`, description: `Only ${errorCount} error.tsx files found — target 16+` });
  const score = errorCount >= 16 ? 100 : errorCount >= 10 ? 70 : errorCount >= 5 ? 40 : 10;
  return { score, violations, errorCount };
}

export function scanResponsive(): { score: number; violations: Violation[]; responsiveModules: number; totalModules: number } {
  const files = sourceFiles();
  const violations: Violation[] = [];
  let responsiveModules = 0, totalModules = 0;
  const seen = new Set<string>();

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    totalModules++;
    const content = readFileSync(file, "utf-8");
    if (/\b(md:|lg:|xl:|sm:)\b/.test(content) || /grid-(cols|rows)-\d/.test(content) || content.includes("flex-") || content.includes("max-w-")) {
      responsiveModules++;
    } else {
      violations.push({ severity: "info", file: rel, line: 1, value: "No responsive classes", description: "File may lack responsive design patterns" });
    }
  }

  const pct = totalModules > 0 ? Math.round((responsiveModules / totalModules) * 100) : 0;
  const score = pct >= 80 ? 100 : pct >= 60 ? 70 : pct >= 40 ? 40 : 10;

  return { score, violations, responsiveModules, totalModules };
}

export function scanBundleSize(): BundleInfo {
  const files = sourceFiles();
  let totalSize = 0;
  const largeFiles: { file: string; size: number }[] = [];

  for (const file of files) {
    try {
      const s = statSync(file);
      totalSize += s.size;
      if (s.size > 50000) {
        largeFiles.push({ file: relative(ROOT, file), size: s.size });
      }
    } catch {}
  }

  largeFiles.sort((a, b) => b.size - a.size);

  return { totalSourceSize: totalSize, largeFiles: largeFiles.slice(0, 20), totalFileCount: files.length };
}

export function computeOverallScore(categories: CategoryScore[]): number {
  const weights: Record<string, number> = { designTokens: 0.25, accessibility: 0.20, componentUsage: 0.15, loadingStates: 0.15, errorStates: 0.15, responsive: 0.10 };
  let total = 0, weighted = 0;
  for (const cat of categories) {
    const w = weights[cat.id] ?? 0.1;
    weighted += cat.score * w;
    total += w;
  }
  return total > 0 ? Math.round(weighted / total) : 0;
}

export function runFullAudit(): AuditResult {
  const dt = scanDesignTokens();
  const ax = scanAccessibility();
  const cu = scanComponentUsage();
  const ls = scanLoadingStates();
  const es = scanErrorStates();
  const rs = scanResponsive();
  const bundle = scanBundleSize();

  const categories: CategoryScore[] = [
    { id: "designTokens", label: "Design Tokens", detail: `${dt.violations.length} issues`, score: dt.score, status: dt.score >= 80 ? "pass" : dt.score >= 40 ? "warning" : "fail", violations: dt.violations, passed: dt.violations.filter(v => v.severity === "info").length, total: dt.violations.length || 1 },
    { id: "accessibility", label: "Accessibility", detail: `${ax.attributesFound} ARIA/role attributes`, score: ax.score, status: ax.score >= 80 ? "pass" : ax.score >= 40 ? "warning" : "fail", violations: ax.violations, passed: ax.imagesWithAlt, total: Math.max(ax.totalImages, 1) },
    { id: "componentUsage", label: "Component Usage", detail: `${cu.componentUsagePct}% component usage`, score: cu.score, status: cu.score >= 80 ? "pass" : cu.score >= 40 ? "warning" : "fail", violations: cu.violations, passed: cu.componentUsagePct, total: 100 },
    { id: "loadingStates", label: "Loading States", detail: `${ls.loadingCount} loading.tsx files`, score: ls.score, status: ls.score >= 80 ? "pass" : ls.score >= 40 ? "warning" : "fail", violations: ls.violations, passed: ls.loadingCount, total: 16 },
    { id: "errorStates", label: "Error States", detail: `${es.errorCount} error.tsx files`, score: es.score, status: es.score >= 80 ? "pass" : es.score >= 40 ? "warning" : "fail", violations: es.violations, passed: es.errorCount, total: 16 },
    { id: "responsive", label: "Responsive Design", detail: `${rs.responsiveModules}/${rs.totalModules} modules responsive`, score: rs.score, status: rs.score >= 80 ? "pass" : rs.score >= 40 ? "warning" : "fail", violations: rs.violations, passed: rs.responsiveModules, total: rs.totalModules },
  ];

  return {
    timestamp: new Date().toISOString(),
    overallScore: computeOverallScore(categories),
    categories,
    bundle,
    summary: {
      totalViolations: categories.reduce((a, c) => a + c.violations.filter(v => v.severity === "violation").length, 0),
      totalWarnings: categories.reduce((a, c) => a + c.violations.filter(v => v.severity === "warning").length, 0),
      passedCategories: categories.filter(c => c.status === "pass").length,
      totalCategories: categories.length
    }
  };
}
