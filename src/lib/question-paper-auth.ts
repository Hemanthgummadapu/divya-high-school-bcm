import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { assertServerOnly } from "@/lib/assert-server-only";
import { authOptions } from "@/lib/auth";
import {
  evaluateQuestionPaperIdentity,
  isTrustedMutationOrigin,
} from "@/lib/question-paper-security-policy.mjs";

assertServerOnly("Question-paper authorization");

type AuthorizedRequest = {
  ok: true;
  requestId: string;
};

type DeniedRequest = {
  ok: false;
  requestId: string;
  response: NextResponse;
};

export type QuestionPaperApiAuthorization =
  | AuthorizedRequest
  | DeniedRequest;

function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  if (supplied && /^[A-Za-z0-9._-]{1,64}$/.test(supplied)) return supplied;
  return randomUUID();
}

function denialResponse(status: 401 | 403, requestId: string): NextResponse {
  const error = status === 401 ? "Authentication required" : "Access denied";
  return NextResponse.json(
    { success: false, error, requestId },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function requireQuestionPaperApiAccess(
  request: NextRequest,
  options: { mutation?: boolean } = {},
): Promise<QuestionPaperApiAuthorization> {
  const requestId = getRequestId(request);
  let session;

  try {
    session = await getServerSession(authOptions);
  } catch {
    console.warn("[question-paper-auth]", {
      requestId,
      outcome: "session_error",
    });
    return {
      ok: false,
      requestId,
      response: denialResponse(403, requestId),
    };
  }

  const decision = evaluateQuestionPaperIdentity({
    sessionPresent: Boolean(session),
    email: session?.user?.email,
    emailVerified: session?.user?.emailVerified,
    allowedEmailsValue: process.env.QUESTION_PAPER_ALLOWED_EMAILS,
  });

  if (!decision.allowed) {
    console.warn("[question-paper-auth]", {
      requestId,
      outcome: decision.reason,
    });
    return {
      ok: false,
      requestId,
      response: denialResponse(decision.status as 401 | 403, requestId),
    };
  }

  if (
    options.mutation &&
    !isTrustedMutationOrigin({
      origin: request.headers.get("origin"),
      requestOrigin: request.nextUrl.origin,
      trustedOriginsValue: process.env.QUESTION_PAPER_TRUSTED_ORIGINS,
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    console.warn("[question-paper-auth]", {
      requestId,
      outcome: "untrusted_origin",
    });
    return {
      ok: false,
      requestId,
      response: denialResponse(403, requestId),
    };
  }

  return { ok: true, requestId };
}

export function questionPaperServerError(requestId: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "The request could not be completed",
      requestId,
    },
    {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
