import { NextRequest, NextResponse } from "next/server";
import { tripsToCsv } from "@/lib/csv";
import { badRequest, internalError, parsePlateList } from "@/lib/http";
import { buildTripsReport } from "@/lib/reporting";
import { parseDateRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const range = parseDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );

    const plates = parsePlateList(request.nextUrl.searchParams.get("plate"));
    const trips = await buildTripsReport({
      plates,
      fromIso: range.from.toISOString(),
      toIso: range.to.toISOString()
    });

    const csv = tripsToCsv(trips);
    const filename = `trip-report-${range.from.toISOString()}-${range.to.toISOString()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("GET /api/reports/trips/export.csv error", error);
    if (error instanceof Error && error.message.toLowerCase().includes("date range")) {
      return badRequest(error.message);
    }
    return internalError("Failed to export CSV");
  }
}
