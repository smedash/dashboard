import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

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
    const dimension = searchParams.get("dimension");

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
        const workbook = new ExcelJS.Workbook();

        // Daten-Sheet
        const dataSheet = workbook.addWorksheet("Daten");
        dataSheet.columns = [
          { header: "Dimension", key: "Dimension", width: 15 },
          { header: "Wert", key: "Wert", width: 40 },
          { header: "Klicks", key: "Klicks", width: 12 },
          { header: "Impressionen", key: "Impressionen", width: 15 },
          { header: "CTR", key: "CTR", width: 10 },
          { header: "Position", key: "Position", width: 10 },
        ];
        exportData.forEach((row) => dataSheet.addRow(row));

        // Info-Sheet
        const infoSheet = workbook.addWorksheet("Info");
        infoSheet.columns = [
          { header: "Feld", key: "Feld", width: 25 },
          { header: "Wert", key: "Wert", width: 50 },
        ];
        infoSheet.addRow({ Feld: "Snapshot Name", Wert: snapshot.name });
        infoSheet.addRow({ Feld: "Property", Wert: snapshot.property.siteUrl });
        infoSheet.addRow({
          Feld: "Zeitraum",
          Wert: `${snapshot.startDate.toISOString().split("T")[0]} - ${snapshot.endDate.toISOString().split("T")[0]}`,
        });
        infoSheet.addRow({ Feld: "Erstellt am", Wert: snapshot.createdAt.toISOString().split("T")[0] });
        infoSheet.addRow({ Feld: "Gesamt Klicks", Wert: (snapshot.totals as Record<string, number>).clicks });
        infoSheet.addRow({ Feld: "Gesamt Impressionen", Wert: (snapshot.totals as Record<string, number>).impressions });

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
          },
        });
      }

      case "csv":
      default: {
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
