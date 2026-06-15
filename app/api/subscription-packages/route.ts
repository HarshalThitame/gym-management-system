import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import {
  getPackages, getPackage, createPackage, updatePackage,
  duplicatePackage, setPackageStatus, deletePackage, getPackageUsage,
} from "@/features/super-admin/services/package-management-service";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const usage = url.searchParams.get("usage");

  try {
    if (id) {
      if (usage) {
        const data = await getPackageUsage(id);
        return NextResponse.json({ ok: true, data });
      }
      const pkg = await getPackage(id);
      return NextResponse.json({ ok: true, data: pkg });
    }
    const { data } = await getPackages();
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action, ...data } = body;

    if (action === "duplicate") {
      const result = await duplicatePackage(data.id);
      return NextResponse.json(result);
    }

    if (action === "toggle_status") {
      const result = await setPackageStatus(data.id, data.isActive);
      return NextResponse.json(result);
    }

    if (action === "delete") {
      const result = await deletePackage(data.id);
      return NextResponse.json(result);
    }

    // Default: create package
    const result = await createPackage(data, data.features ?? []);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, features, ...data } = body;
    if (!id) return NextResponse.json({ ok: false, error: "Package ID required" }, { status: 400 });

    const result = await updatePackage(id, data, features);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
