import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { getGstr1Report, getTaxSummary } from "@/features/billing/services/tax-reporting-service";

export async function GET(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "report";
  const gymId = searchParams.get("gymId");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  if (action === "summary") {
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "from and to query params required" }, { status: 400 });
    }
    const summary = await getTaxSummary(gymId ?? "", fromDate, toDate);
    return NextResponse.json({ data: summary });
  }

  const report = await getGstr1Report(gymId ?? null);
  const csvHeader = "supplierGstin,supplierAddress,supplierCity,supplierState,supplierZip,invoiceNumber,invoiceDate,invoiceValue,totalTax,customerName,customerGstin,taxRate,taxableAmount,lineTax\n";
  const csvRows = report.map((r) =>
    [
      r.supplierGstin, r.supplierAddress, r.supplierCity, r.supplierState, r.supplierZip,
      r.invoiceNumber, r.invoiceDate, r.invoiceValue, r.totalTax,
      r.customerName, r.customerGstin, r.taxRate, r.taxableAmount, r.lineTax,
    ].map((v) => `"${v ?? ""}"`).join(",")
  ).join("\n");
  const csv = csvHeader + csvRows;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="gstr1-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
