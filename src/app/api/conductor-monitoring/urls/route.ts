import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findConductorWebsiteForDomain, queryConductorUrls } from "@/lib/conductor-data";
import {
  URL_EXPORT_LIMIT,
  URL_FILTERS,
  URL_PAGE_SIZE,
  URL_SORT_FIELDS,
  type UrlFilter,
  type UrlListResponse,
  type UrlSortField,
} from "@/lib/technical-seo";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const domain = params.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain Parameter fehlt" }, { status: 400 });
    }

    const filterParam = params.get("filter") ?? "all";
    const sortParam = params.get("sort") ?? "url";
    const filter: UrlFilter = (URL_FILTERS as readonly string[]).includes(filterParam)
      ? (filterParam as UrlFilter)
      : "all";
    const sort: UrlSortField = (URL_SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as UrlSortField)
      : "url";
    const dir = params.get("dir") === "desc" ? "desc" : "asc";
    const search = (params.get("search") ?? "").trim();
    const issue = params.get("issue")?.trim() || undefined;
    const isExport = params.get("export") === "1";
    const page = Math.max(1, Number(params.get("page")) || 1);

    const website = await findConductorWebsiteForDomain(domain);
    if (!website) {
      return NextResponse.json({ rows: [], total: 0 } satisfies UrlListResponse);
    }

    const take = isExport ? URL_EXPORT_LIMIT : URL_PAGE_SIZE;
    const { rows, total } = await queryConductorUrls(website.id, {
      filter,
      search,
      issue,
      sort,
      dir,
      skip: isExport ? 0 : (page - 1) * URL_PAGE_SIZE,
      take,
    });

    return NextResponse.json({
      rows,
      total,
      truncated: isExport && total > take,
    } satisfies UrlListResponse);
  } catch (error) {
    console.error("[Conductor URLs]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Conductor-URLs" },
      { status: 500 }
    );
  }
}
