import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "csv";
    const dimension = searchParams.get("dimension"); // optional filter

    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
      include: {
        property: true,
        data: dimension
          ? {
              where: { dimension },
              orderBy: { clicks: "desc" },
            }
          : {
              orderBy: [{ dimension: "asc" }, { clicks: "desc" }],
            },
      },
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // Prepare data for export
    const exportData = snapshot.data.map((row) => ({
      Dimension: row.dimension,
      Wert: row.key,
      Klicks: row.clicks,
      Impressionen: row.impressions,
      CTR: `${(row.ctr * 100).toFixed(2)}%`,
      Position: row.position.toFixed(1),
    }));

    const filename = `${snapshot.name.replace(/[^a-zA-Z0-9]/g, "_")}_${dimension || "alle"}`;

    switch (format) {
      case "json": {
        return new NextResponse(JSON.stringify(exportData, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
          },
        });
      }

      case "xlsx": {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daten");

        // Add metadata sheet
        const metadata = [
          { Feld: "Snapshot Name", Wert: snapshot.name },
          { Feld: "Property", Wert: snapshot.property.siteUrl },
          { Feld: "Zeitraum", Wert: `${snapshot.startDate.toISOString().split("T")[0]} - ${snapshot.endDate.toISOString().split("T")[0]}` },
          { Feld: "Erstellt am", Wert: snapshot.createdAt.toISOString().split("T")[0] },
          { Feld: "Gesamt Klicks", Wert: (snapshot.totals as Record<string, number>).clicks },
          { Feld: "Gesamt Impressionen", Wert: (snapshot.totals as Record<string, number>).impressions },
        ];
        const metaSheet = XLSX.utils.json_to_sheet(metadata);
        XLSX.utils.book_append_sheet(workbook, metaSheet, "Info");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
          },
        });
      }

      case "csv":
      default: {
        // Create CSV
        const headers = ["Dimension", "Wert", "Klicks", "Impressionen", "CTR", "Position"];
        const csvRows = [
          headers.join(";"),
          ...exportData.map((row) =>
            [
              row.Dimension,
              `"${row.Wert.replace(/"/g, '""')}"`,
              row.Klicks,
              row.Impressionen,
              row.CTR,
              row.Position,
            ].join(";")
          ),
        ];
        const csv = csvRows.join("\n");

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.csv"`,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error exporting snapshot:", error);
    return NextResponse.json(
      { error: "Failed to export snapshot" },
      { status: 500 }
    );
  }
}


