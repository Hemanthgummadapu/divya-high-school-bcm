import { NextRequest, NextResponse } from "next/server";
import {
  questionPaperServerError,
  requireQuestionPaperApiAccess,
} from "@/lib/question-paper-auth";
import { isSafeQuestionPaperResourceId } from "@/lib/question-paper-security-policy.mjs";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isUuid,
  parsePositiveInt,
} from "@/lib/question-bank-v2-review.mjs";
import { getV2SourceDetail, renameV2Source } from "@/lib/question-bank-v2-review-api";
import { getSavedPaperDetail } from "@/lib/question-bank-v2-paper-api";
import { validateDisplayName } from "@/lib/question-bank-v2-source-name.mjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/question-papers/[id]
 * V2 source details, questions, and a short-lived signed source-PDF URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request);
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  if (!isSafeQuestionPaperResourceId(params.id) || !isUuid(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page")) ?? 1;
    const pageSize =
      parsePositiveInt(request.nextUrl.searchParams.get("pageSize")) ??
      DEFAULT_PAGE_SIZE;
    if (page == null || page < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid page", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (pageSize == null || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Invalid page size", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (request.nextUrl.searchParams.get("resource") === "paper") {
      const detail = await getSavedPaperDetail(params.id);
      if (!detail) {
        return NextResponse.json(
          { success: false, error: "Paper not found", requestId },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.json(
        {
          success: true,
          paper: detail.paper,
          pdfUrl: detail.pdfUrl,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const status = request.nextUrl.searchParams.get("status") || "";
    const result = await getV2SourceDetail({
      sourceId: params.id,
      page,
      pageSize,
      status: status || undefined,
    });
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Source not found", requestId },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        success: true,
        source: result.source,
        pdfUrl: result.pdfUrl,
        questions: result.questions,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        requestId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "get_source",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

/**
 * PATCH /api/question-papers/[id]
 * Rename a source paper. Does not re-extract, change the PDF, or touch questions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  const { requestId } = authorization;
  if (!isSafeQuestionPaperResourceId(params.id) || !isUuid(params.id)) {
    return NextResponse.json(
      { success: false, error: "Invalid resource identifier", requestId },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid rename request", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const unexpected = Object.keys(body).filter(
      (key) => key !== "displayName" && key !== "display_name",
    );
    if (unexpected.length > 0) {
      return NextResponse.json(
        { success: false, error: "Only the paper name can be changed", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const named = validateDisplayName(body.displayName ?? body.display_name);
    if (!named.ok) {
      return NextResponse.json(
        { success: false, error: named.error, requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const source = await renameV2Source(params.id, named.displayName as string);
    if (!source) {
      return NextResponse.json(
        { success: false, error: "Source not found", requestId },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { success: true, source, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[question-paper-api]", {
      requestId,
      operation: "rename_source",
      outcome: "request_error",
    });
    return questionPaperServerError(requestId);
  }
}

/**
 * POST /api/question-papers/[id]
 * Legacy paper-attached create is retired. Use POST /api/questions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  if (!isSafeQuestionPaperResourceId(params.id)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid resource identifier",
        requestId: authorization.requestId,
      },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: "Use POST /api/questions to add a question",
      requestId: authorization.requestId,
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * DELETE /api/question-papers/[id]
 * Hard-delete is not part of the V2 Question Bank.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  if (!isSafeQuestionPaperResourceId(params.id)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid resource identifier",
        requestId: authorization.requestId,
      },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: "Sources cannot be deleted from this screen",
      requestId: authorization.requestId,
    },
    { status: 405, headers: { "Cache-Control": "no-store" } },
  );
}
