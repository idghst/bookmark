import { NextResponse, type NextRequest } from "next/server";
import { bookmarkClientAccess } from "@/app/lib/bookmarks/client-auth";
import { bookmarkStore, StoreError } from "@/app/lib/bookmarks/store";

type RouteContext = {
  params: Promise<{
    resource: string;
    path?: string[];
  }>;
};

function jsonError(error: unknown) {
  if (error instanceof StoreError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }

  return NextResponse.json({ detail: error instanceof Error ? error.message : "API request failed." }, { status: 500 });
}

function noRoute() {
  return NextResponse.json({ detail: "Not found." }, { status: 404 });
}

function requireBookmarkAccess() {
  if (bookmarkClientAccess() === "authorized") return null;
  return NextResponse.json(
    { detail: "Bookmark access is not configured." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

async function routeParts(context: RouteContext) {
  const params = await context.params;
  return { resource: params.resource, path: params.path ?? [] };
}

async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new StoreError("Request body must be valid JSON.", 400);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requireBookmarkAccess();
  if (denied) return denied;
  try {
    const { resource, path } = await routeParts(context);
    if (path.length > 0) return noRoute();
    if (resource === "bookmarks") return NextResponse.json(await bookmarkStore.listBookmarks());
    if (resource === "folders") return NextResponse.json(await bookmarkStore.listFolders());
    if (resource === "sections") return NextResponse.json(await bookmarkStore.listSections());
    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const denied = requireBookmarkAccess();
  if (denied) return denied;
  try {
    const { resource, path } = await routeParts(context);

    if (resource === "bookmarks") {
      if (path.length === 1 && path[0] === "reorder") {
        await bookmarkStore.reorderBookmarks(await readJson(request));
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) {
        return NextResponse.json(await bookmarkStore.createBookmark(await readJson(request)), { status: 201 });
      }
    }

    if (resource === "folders") {
      if (path.length === 1 && path[0] === "reorder") {
        await bookmarkStore.reorderFolders(await readJson(request));
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) {
        return NextResponse.json(await bookmarkStore.createFolder(await readJson(request)), { status: 201 });
      }
    }

    if (resource === "sections") {
      if (path.length === 1 && path[0] === "reorder") {
        await bookmarkStore.reorderSections(await readJson(request));
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) {
        const body = await readJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new StoreError("Section body is invalid.", 400);
        }
        const section = body as Record<string, unknown>;
        if (
          Object.keys(section).some((key) => !["folderId", "name", "color"].includes(key)) ||
          !Object.hasOwn(section, "folderId") ||
          !Object.hasOwn(section, "name")
        ) {
          throw new StoreError("Section body requires folderId and name, with an optional color.", 400);
        }
        return NextResponse.json(
          await bookmarkStore.createSection(section.folderId, section.name, section.color),
          { status: 201 }
        );
      }
    }

    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = requireBookmarkAccess();
  if (denied) return denied;
  try {
    const { resource, path } = await routeParts(context);
    const id = path[0];
    if (!id || path.length !== 1) return noRoute();

    const body = await readJson(request);
    if (resource === "bookmarks") return NextResponse.json(await bookmarkStore.updateBookmark(id, body));
    if (resource === "folders") return NextResponse.json(await bookmarkStore.updateFolder(id, body));
    if (resource === "sections") return NextResponse.json(await bookmarkStore.updateSection(id, body));
    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = requireBookmarkAccess();
  if (denied) return denied;
  try {
    const { resource, path } = await routeParts(context);
    const id = path[0];
    if (!id || path.length !== 1) return noRoute();

    if (resource === "bookmarks") {
      await bookmarkStore.deleteBookmark(id);
      return new Response(null, { status: 204 });
    }
    if (resource === "folders") {
      const destinationFolderId =
        request.nextUrl.searchParams.get("destination_folder_id") ??
        request.nextUrl.searchParams.get("destinationFolderId") ??
        undefined;
      await bookmarkStore.deleteFolder(id, destinationFolderId);
      return new Response(null, { status: 204 });
    }
    if (resource === "sections") {
      await bookmarkStore.deleteSection(id);
      return new Response(null, { status: 204 });
    }

    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}
