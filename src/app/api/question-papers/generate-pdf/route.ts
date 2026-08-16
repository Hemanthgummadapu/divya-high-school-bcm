import { NextRequest, NextResponse } from "next/server";
import { requireQuestionPaperApiAccess } from "@/lib/question-paper-auth";

/**
 * POST /api/question-papers/generate-pdf
 * Retired. Use POST /api/question-papers/generate.
 */
export async function POST(request: NextRequest) {
  const authorization = await requireQuestionPaperApiAccess(request, {
    mutation: true,
  });
  if (!authorization.ok) return authorization.response;
  return NextResponse.json(
    {
      success: false,
      error: "Use POST /api/question-papers/generate",
      requestId: authorization.requestId,
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
