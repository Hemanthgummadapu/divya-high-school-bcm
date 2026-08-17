import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { validatePngDiagram } from "./question-paper-upload-policy.mjs";
import { isSafeDiagramCropRef } from "./question-bank-v2-extract.mjs";

/**
 * Resolve extraction-internal diagram crop references into validated PNG
 * bytes before normalization. Refs point at request-owned files the Python
 * worker wrote inside this request's work directory; anything that is not a
 * canonical "crops/<uuid>.png" reference inside the work directory, or that
 * fails PNG validation, is dropped so the textual description fallback keeps
 * the question honest instead of attaching a broken image.
 *
 * Kept out of question-bank-v2-extract.mjs so that module stays free of
 * filesystem imports and safe for the browser bundle to reach.
 */
export async function inlineDiagramCrops(pages, workDir, maxDiagramBytes) {
  const workRoot = resolve(workDir);
  for (const page of pages) {
    if (page.status !== "succeeded" || !Array.isArray(page.questions)) continue;
    for (const question of page.questions) {
      if (!question || typeof question !== "object") continue;
      const ref = question.diagramCropRef;
      delete question.diagramCropRef;
      if (!isSafeDiagramCropRef(ref)) continue;
      const cropPath = resolve(workRoot, ref);
      if (!cropPath.startsWith(workRoot + sep)) continue;
      let bytes = null;
      try {
        bytes = await readFile(cropPath);
      } catch {
        continue;
      }
      if (!bytes || bytes.byteLength === 0 || bytes.byteLength > maxDiagramBytes) {
        continue;
      }
      const base64 = bytes.toString("base64");
      const validated = validatePngDiagram(base64, maxDiagramBytes);
      if (validated.status !== 200) continue;
      question.diagramPngBase64 = base64;
    }
  }
}
