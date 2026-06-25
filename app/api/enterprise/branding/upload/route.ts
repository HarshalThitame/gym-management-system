import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { requireApiFeatureAccess } from "@/features/entitlement";
import { validateAllowedFile } from "@/lib/security/file-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeFilename } from "@/lib/security/sanitize";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateLimit = await checkRateLimit(`branding-upload:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return new NextResponse(JSON.stringify({ error: "Too many uploads. Try again later." }), {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Max: 2MB" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const configId = formData.get("configId") as string | null;
    const type = formData.get("type") as string | null; // "logo" | "favicon"

    if (!file || !configId || !type) {
      return NextResponse.json({ error: "file, configId, and type are required" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 2MB` }, { status: 400 });
    }

    const validation = await validateAllowedFile(file, new Set(ALLOWED_TYPES), `Invalid file signature. Allowed: PNG, JPEG, SVG, ICO`);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const raw = supabase as never as {
      from(t: string): {
        select(c: string): { eq(c: string, v: string): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
        update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      };
    };
    const { data: config } = await raw.from("tenant_configs").select("id, organization_id, brand_name").eq("id", configId).single();
    if (!config) return NextResponse.json({ error: "Tenant config not found" }, { status: 404 });
    const organizationId = String(config.organization_id);
    const denied = await requireApiFeatureAccess(organizationId, "custom_branding");
    if (denied) return denied;

    const safeName = sanitizeFilename(file.name);
    const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : validation.extension;
    const fileName = `${type}-${configId.slice(0, 8)}-${Date.now()}.${ext}`;
    const filePath = `branding/${configId}/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const dimensionError = await validateImageDimensions(buffer, type as "logo" | "favicon");
    if (dimensionError) {
      return NextResponse.json({ error: dimensionError }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage.from("brand-assets").upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const updateField = type === "logo" ? "logo_url" : "favicon_url";
    const { error: updateError } = await supabase
      .from("tenant_configs")
      .update({ [updateField]: publicUrl } as never)
      .eq("id", configId)
      .eq("organization_id", organizationId);

    if (updateError) return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });

    await writeAuditLog({
      actorId: auth.context.userId,
      action: `branding.${type}_uploaded`,
      entityType: "tenant_config",
      entityId: configId,
      metadata: { fileName, fileSize: file.size, mimeType: file.type, publicUrl },
    });

    return NextResponse.json({ ok: true, url: publicUrl, fileName });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}

type ImageDimensions = { width: number; height: number } | null;

async function validateImageDimensions(buffer: Buffer, type: "logo" | "favicon"): Promise<string | null> {
  const dimensions = await getImageDimensions(buffer);
  if (!dimensions) {
    return type === "favicon"
      ? "Could not read image dimensions. Favicon must be a square image (max 256×256px)."
      : "Could not read image dimensions. Logo must be between 64×64 and 512×512px.";
  }

  const { width, height } = dimensions;

  if (type === "logo") {
    if (width < 64 || height < 64) {
      return `Logo too small: ${width}×${height}px. Minimum: 64×64px.`;
    }
    if (width > 512 || height > 512) {
      return `Logo too large: ${width}×${height}px. Maximum: 512×512px.`;
    }
  }

  if (type === "favicon") {
    if (width < 16 || height < 16) {
      return `Favicon too small: ${width}×${height}px. Minimum: 16×16px.`;
    }
    if (width > 256 || height > 256) {
      return `Favicon too large: ${width}×${height}px. Maximum: 256×256px.`;
    }
    if (width !== height) {
      return `Favicon must be square. Got ${width}×${height}px.`;
    }
  }

  return null;
}

async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  const firstBytes = buffer.subarray(0, 16);

  // PNG: IHDR at offset 16, width at 16-19, height at 20-23
  if (
    firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4e && firstBytes[3] === 0x47 &&
    firstBytes[4] === 0x0d && firstBytes[5] === 0x0a && firstBytes[6] === 0x1a && firstBytes[7] === 0x0a
  ) {
    if (buffer.length < 24) return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // JPEG: scan for SOF0 (0xFF 0xC0) or SOF2 (0xFF 0xC2)
  if (firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] === 0xff && (buffer[offset + 1] === 0xc0 || buffer[offset + 1] === 0xc2)) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      offset++;
    }
    return null;
  }

  // ICO: entry at offset 6 (width), 7 (height); 0 means 256
  if (firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x01 && firstBytes[3] === 0x00) {
    if (buffer.length < 8) return null;
    const wRaw = buffer[6];
    const hRaw = buffer[7];
    if (wRaw === undefined || hRaw === undefined) return null;
    const w = wRaw === 0 ? 256 : wRaw;
    const h = hRaw === 0 ? 256 : hRaw;
    if (w > 0 && h > 0) return { width: w, height: h };
    return null;
  }

  // SVG: parse XML for width/height or viewBox
  if (
    (firstBytes[0] === 0x3c && firstBytes[1] === 0x3f && firstBytes[2] === 0x78 && firstBytes[3] === 0x6d) ||
    (firstBytes[0] === 0x3c && firstBytes[1] === 0x73 && firstBytes[2] === 0x76 && firstBytes[3] === 0x67) ||
    (firstBytes[0] === 0xef && firstBytes[1] === 0xbb && firstBytes[2] === 0xbf &&
     firstBytes[3] === 0x3c && (firstBytes[4] === 0x3f || firstBytes[4] === 0x73))
  ) {
    return parseSvgDimensions(buffer.toString("utf8"));
  }

  return null;
}

function parseSvgDimensions(xml: string): ImageDimensions {
  const viewBoxMatch = xml.match(/viewBox\s*=\s*["']\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*["']/i);
  if (viewBoxMatch) {
    const wStr = viewBoxMatch[3];
    const hStr = viewBoxMatch[4];
    if (wStr && hStr) {
      const w = parseInt(wStr, 10);
      const h = parseInt(hStr, 10);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }

  const widthAttr = xml.match(/width\s*=\s*["']\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*["']/i);
  const heightAttr = xml.match(/height\s*=\s*["']\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*["']/i);
  if (widthAttr && heightAttr) {
    const wStr = widthAttr[1];
    const hStr = heightAttr[1];
    if (wStr && hStr) {
      const w = Math.round(parseFloat(wStr));
      const h = Math.round(parseFloat(hStr));
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }

  return null;
}
