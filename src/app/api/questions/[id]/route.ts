import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Question } from "@/lib/questionPapers";

/**
 * PATCH /api/questions/[id]
 * Update a question (e.g. diagram). If diagram base64 is provided, upload to Storage and set diagram_url.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { text, options, marks, diagram } = body;

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      );
    }

    const { data: existing, error: fetchError } = await getSupabase()
      .from("questions")
      .select("id, text, options, marks, diagram_url")
      .eq("id", params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "Question not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (typeof text === "string") updates.text = text;
    if (Array.isArray(options)) updates.options = options;
    if (typeof marks === "number" && marks >= 0) updates.marks = marks;

    if (typeof diagram === "string" && diagram.trim().length > 0) {
      try {
        const buffer = Buffer.from(diagram, "base64");
        const supabase = getSupabase();
        const bucket = "diagrams";
        const path = `${params.id}.png`;
        const { error: bucketError } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
        });
        if (!bucketError) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          const diagramUrl = urlData?.publicUrl;
          if (diagramUrl) updates.diagram_url = diagramUrl;
        }
      } catch (uploadErr) {
        console.warn("Diagram upload failed:", uploadErr);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        question: existing,
        diagram_url: (existing as { diagram_url?: string }).diagram_url,
      });
    }

    const { data: updated, error: updateError } = await getSupabase()
      .from("questions")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    const q = updated as {
      id: string;
      number: string;
      text: string;
      options: string[];
      section: string;
      type: string;
      marks: number;
      diagram_url?: string;
    };

    const question: Question = {
      id: q.id,
      number: String(q.number ?? ""),
      text: q.text ?? "",
      options: Array.isArray(q.options) ? q.options : [],
      section: q.section ?? "",
      type: (q.type as Question["type"]) || "Short",
      marks: Number(q.marks) ?? 0,
      diagram_url: q.diagram_url ?? undefined,
    };

    return NextResponse.json({
      success: true,
      question,
      diagram_url: q.diagram_url,
    });
  } catch (error: any) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
