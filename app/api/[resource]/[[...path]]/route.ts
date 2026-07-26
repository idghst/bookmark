import { NextResponse, type NextRequest } from "next/server";
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

async function routeParts(context: RouteContext) {
  const params = await context.params;
  return { resource: params.resource, path: params.path ?? [] };
}

export async function GET(_request: NextRequest, context: RouteContext) {
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
  try {
    const { resource, path } = await routeParts(context);
    const body = await request.json();

    if (resource === "bookmarks") {
      if (path[0] === "reorder") {
        await bookmarkStore.reorderBookmarks(body);
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) return NextResponse.json(await bookmarkStore.createBookmark(body), { status: 201 });
    }

    if (resource === "folders") {
      if (path[0] === "reorder") {
        await bookmarkStore.reorderFolders(body);
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) return NextResponse.json(await bookmarkStore.createFolder(body), { status: 201 });
    }

    if (resource === "sections") {
      if (path[0] === "reorder") {
        await bookmarkStore.reorderSections(body);
        return new Response(null, { status: 204 });
      }
      if (path.length === 0) return NextResponse.json(await bookmarkStore.createSection(body.folderId, body.name), { status: 201 });
    }

    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { resource, path } = await routeParts(context);
    const id = path[0];
    if (!id || path.length !== 1) return noRoute();

    const body = await request.json();
    if (resource === "bookmarks") return NextResponse.json(await bookmarkStore.updateBookmark(id, body));
    if (resource === "folders") return NextResponse.json(await bookmarkStore.updateFolder(id, body));
    return noRoute();
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { resource, path } = await routeParts(context);
    const id = path[0];
    if (!id || path.length !== 1) return noRoute();

    if (resource === "bookmarks") {
      await bookmarkStore.deleteBookmark(id);
      return new Response(null, { status: 204 });
    }
    if (resource === "folders") {
      await bookmarkStore.deleteFolder(id);
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
