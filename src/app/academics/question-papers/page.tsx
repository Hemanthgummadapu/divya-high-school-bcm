"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createRetryClickLock,
  shouldRenderRetryButton,
} from "@/lib/question-bank-v2-retry.mjs";
import { ALL_GRADES, ALL_YEARS, getSubjectsForGrade } from "@/lib/subjects";
import { uploadResultMessage } from "@/lib/question-bank-v2-review-ui.mjs";
import {
  detectSelectionConflicts,
  formatDuration,
  groupQuestionsIntoSections,
  previewMarks,
  questionTypeLabel,
  romanClass,
  summarizeSelection,
} from "@/lib/question-bank-v2-paper-ui.mjs";
import {
  MAX_DISPLAY_NAME_LENGTH,
  suggestPaperNameFromFilename,
  validateDisplayName,
} from "@/lib/question-bank-v2-source-name.mjs";
import DiagramSketchTool from "@/components/DiagramSketchTool";
import PortalLogoutButton from "@/components/PortalLogoutButton";
import MathKeyboard from "@/components/MathKeyboard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type ViewName = "review" | "bank" | "sources" | "saved";
type QuestionType = "MCQ" | "Short" | "Medium" | "Long";

type BankQuestion = {
  id: string;
  sourceId: string | null;
  sourcePageNumber: number | null;
  sourceDisplayName: string | null;
  sourceFilename: string | null;
  grade: number;
  subject: string;
  academicYear: number;
  questionType: QuestionType;
  language: string;
  questionText: string;
  rawExtractedText: string | null;
  options: Array<{ label: string; text: string }>;
  correctAnswer: string | null;
  marks: number;
  sectionLabel: string | null;
  chapter: string | null;
  topic: string | null;
  reviewStatus: string;
  lockVersion: number;
  diagramUrl: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
};

type SavedPaper = {
  id: string;
  title: string;
  grade: number;
  subject: string;
  academicYear: number;
  durationMinutes: number | null;
  totalMarks: number;
  itemCount: number | null;
  status: string;
  pdfAvailable: boolean;
  pdfStatus: string;
  finalizedAt: string | null;
  createdAt: string | null;
  pdfUrl: string | null;
};

type BankSource = {
  id: string;
  displayName: string | null;
  filename: string;
  grade: number;
  subject: string;
  academicYear: number;
  pageCount: number;
  status: string;
  statusLabel: string;
  processedPageCount: number;
  failedPages: number[];
  savedQuestionCount: number;
  createdAt: string;
  possiblyInterrupted: boolean;
  retryEligible: boolean;
};

type QuestionDraft = {
  questionText: string;
  questionType: QuestionType;
  marks: number;
  sectionLabel: string;
  options: string[];
  correctAnswer: string;
  language: string;
  chapter: string;
  topic: string;
};

type UploadNotice = {
  kind: "completed" | "partial" | "failed" | "duplicate";
  text: string;
  sourceId: string | null;
};

type SourceOption = {
  id: string;
  displayName: string;
};

type BuilderSection = {
  key: string;
  title: string;
  instructions: string;
  questionIds: string[];
};

const EMPTY_DRAFT: QuestionDraft = {
  questionText: "",
  questionType: "Short",
  marks: 1,
  sectionLabel: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  language: "",
  chapter: "",
  topic: "",
};

const inputClass =
  "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm font-medium text-gray-700 mb-2";

function draftFromQuestion(question: BankQuestion): QuestionDraft {
  const optionTexts =
    question.options.length > 0
      ? question.options.map((option) => option.text)
      : ["", "", "", ""];
  while (optionTexts.length < 2) optionTexts.push("");
  return {
    questionText: question.questionText,
    questionType: question.questionType,
    marks: question.marks,
    sectionLabel: question.sectionLabel ?? "",
    options: optionTexts,
    correctAnswer: question.correctAnswer ?? "",
    language: question.language ?? "",
    chapter: question.chapter ?? "",
    topic: question.topic ?? "",
  };
}

function draftPayload(draft: QuestionDraft) {
  return {
    questionText: draft.questionText,
    questionType: draft.questionType,
    marks: draft.marks,
    sectionLabel: draft.sectionLabel,
    options: draft.questionType === "MCQ" ? draft.options : [],
    correctAnswer: draft.correctAnswer,
    language: draft.language || undefined,
    chapter: draft.chapter,
    topic: draft.topic,
  };
}

function renderQuestionText(text: string) {
  return (
    <div className="prose prose-sm max-w-none break-words font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ ...props }) => (
            <table className="border-collapse text-[13px] my-1.5" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="border border-gray-300 px-2 py-1 bg-gray-50" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="border border-gray-300 px-2 py-1" {...props} />
          ),
        }}
      >
        {text || ""}
      </ReactMarkdown>
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "partial") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "failed") return "bg-red-50 text-red-800 border-red-200";
  if (status === "processing") return "bg-blue-50 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function QuestionPapers() {
  const [view, setView] = useState<ViewName>("review");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [sources, setSources] = useState<BankSource[]>([]);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMap, setSelectedMap] = useState<Map<string, BankQuestion>>(
    new Map(),
  );
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderYear, setBuilderYear] = useState(String(new Date().getFullYear()));
  const [builderDuration, setBuilderDuration] = useState("180");
  const [builderSections, setBuilderSections] = useState<BuilderSection[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [creationKey, setCreationKey] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [sourcePdf, setSourcePdf] = useState<{
    url: string | null;
    displayName: string;
    filename: string;
    statusLabel: string;
  } | null>(null);
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    year: "",
    type: "",
    marks: "",
    q: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    displayName: "",
    subject: "",
    grade: "",
    year: String(new Date().getFullYear()),
  });
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retryingSourceId, setRetryingSourceId] = useState<string | null>(null);
  const [retryLockedIds, setRetryLockedIds] = useState<string[]>([]);
  const retryLockRef = useRef(createRetryClickLock());
  const [uploadNotice, setUploadNotice] = useState<UploadNotice | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [addMeta, setAddMeta] = useState({
    grade: "",
    subject: "",
    year: String(new Date().getFullYear()),
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState<BankQuestion | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [editError, setEditError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [diagramFor, setDiagramFor] = useState<"review" | "edit" | null>(null);
  const [mathField, setMathField] = useState<"review" | "edit" | "add" | null>(null);

  const currentReview = questions[reviewIndex] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filterSubjects = filters.grade
    ? getSubjectsForGrade(parseInt(filters.grade, 10))
    : [];
  const addSubjects = addMeta.grade
    ? getSubjectsForGrade(parseInt(addMeta.grade, 10))
    : [];

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        view,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.grade) params.set("grade", filters.grade);
      if (filters.year) params.set("year", filters.year);
      if (view === "bank" || view === "review") {
        if (filters.type) params.set("type", filters.type);
        if (filters.marks) params.set("marks", filters.marks);
        if (filters.q) params.set("q", filters.q);
        if (sourceFilter) params.set("sourceId", sourceFilter);
      }
      const response = await fetch(`/api/question-papers?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "The list could not be loaded");
        setQuestions([]);
        setSources([]);
        setSavedPapers([]);
        setTotal(0);
        return false;
      }
      if (view === "sources") {
        setSources(data.sources ?? []);
        setQuestions([]);
        setSavedPapers([]);
        setSourceOptions([]);
      } else if (view === "saved") {
        setSavedPapers(data.papers ?? []);
        setQuestions([]);
        setSources([]);
        setSourceOptions([]);
      } else {
        setQuestions(data.questions ?? []);
        setSources([]);
        setSavedPapers([]);
        setSourceOptions(data.sourceOptions ?? []);
      }
      setTotal(data.total ?? 0);
      return true;
    } catch {
      setError("The list could not be loaded");
      return false;
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sourceFilter, view]);

  const fetchReviewCount = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/question-papers?view=review&page=1&pageSize=1",
      );
      const data = await response.json();
      if (response.ok && data.success) setReviewTotal(data.total ?? 0);
    } catch {
      /* keep the last known count */
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchReviewCount();
  }, [fetchList, fetchReviewCount]);

  useEffect(() => {
    setReviewIndex(0);
  }, [page, view, filters]);

  useEffect(() => {
    if (view !== "review" || !currentReview) {
      setReviewDraft(EMPTY_DRAFT);
      setReviewError(null);
      return;
    }
    setReviewDraft(draftFromQuestion(currentReview));
    setReviewError(null);
  }, [currentReview, view]);

  useEffect(() => {
    if (view !== "review" || !currentReview?.sourceId) {
      setSourcePdf(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/question-papers/${currentReview.sourceId}?pageSize=1`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setSourcePdf({
          url: data.pdfUrl ?? null,
          displayName: data.source?.displayName ?? data.source?.filename ?? "Source PDF",
          filename: data.source?.filename ?? "",
          statusLabel: data.source?.statusLabel ?? "",
        });
      })
      .catch(() => {
        if (!cancelled) setSourcePdf(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentReview?.sourceId, view]);

  const handleUpload = async () => {
    const gradeNum = uploadForm.grade ? parseInt(uploadForm.grade, 10) : 0;
    const named = validateDisplayName(uploadForm.displayName);
    if (!uploadForm.file || !uploadForm.subject || !uploadForm.grade || !uploadForm.year) {
      setUploadNotice({
        kind: "failed",
        text: "Please choose a grade, subject, year, paper name, and PDF file.",
        sourceId: null,
      });
      return;
    }
    if (!named.ok) {
      setUploadNotice({
        kind: "failed",
        text: named.error,
        sourceId: null,
      });
      return;
    }
    const paperName = named.displayName;
    if (!gradeNum || gradeNum < 1 || gradeNum > 10) {
      setUploadNotice({
        kind: "failed",
        text: "Please select a valid grade (1–10).",
        sourceId: null,
      });
      return;
    }

    setUploading(true);
    setUploadNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("displayName", paperName);
      formData.append("subject", uploadForm.subject);
      formData.append("grade", uploadForm.grade);
      formData.append("year", uploadForm.year);
      const response = await fetch("/api/question-papers", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const notice = uploadResultMessage(data) as UploadNotice;
      setUploadNotice(notice);
      if (notice.kind === "completed" || notice.kind === "partial") {
        setUploadForm({
          file: null,
          displayName: "",
          subject: "",
          grade: "",
          year: String(new Date().getFullYear()),
        });
        setSourceFilter(notice.sourceId || "");
        setView("review");
        setPage(1);
        await fetchReviewCount();
      } else if (notice.kind === "duplicate" || notice.kind === "failed") {
        setView("sources");
        setPage(1);
      }
    } catch {
      setUploadNotice({
        kind: "failed",
        text: "The PDF could not be uploaded.",
        sourceId: null,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRetryExtraction = async (sourceId: string) => {
    if (!retryLockRef.current.tryAcquire() || retryingSourceId) return;
    setRetryingSourceId(sourceId);
    setRetryLockedIds((current) =>
      current.includes(sourceId) ? current : [...current, sourceId],
    );
    setSources((current) =>
      current.map((source) =>
        source.id === sourceId ? { ...source, retryEligible: false } : source,
      ),
    );
    setUploadNotice(null);
    let listReloaded = false;
    try {
      const response = await fetch(`/api/question-papers/${sourceId}/retry`, {
        method: "POST",
      });
      const data = await response.json();
      const notice = uploadResultMessage(data) as UploadNotice;
      setUploadNotice(notice);
      setView("sources");
      setPage(1);
      listReloaded = (await fetchList()) === true;
      if (listReloaded) {
        setRetryLockedIds((current) => current.filter((id) => id !== sourceId));
      }
      if (notice.kind === "completed" || notice.kind === "partial") {
        setSourceFilter(notice.sourceId || sourceId);
        setView("review");
      }
    } catch {
      setUploadNotice({
        kind: "failed",
        text: "The extraction could not be retried.",
        sourceId,
      });
    } finally {
      retryLockRef.current.release();
      setRetryingSourceId(null);
    }
  };

  const patchQuestion = async (
    question: BankQuestion,
    draft: QuestionDraft,
    action: string,
    diagram?: string,
  ) => {
    const response = await fetch(`/api/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draftPayload(draft),
        lockVersion: question.lockVersion,
        action,
        diagram,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { ok: false as const, error: data.error || "The question could not be saved" };
    }
    return { ok: true as const, question: data.question as BankQuestion };
  };

  const handleReviewAction = async (action: string) => {
    if (!currentReview) return;
    setMutating(true);
    setReviewError(null);
    const result = await patchQuestion(currentReview, reviewDraft, action);
    setMutating(false);
    if (!result.ok) {
      setReviewError(result.error);
      return;
    }
    await fetchList();
    await fetchReviewCount();
    if (action === "approve") {
      setReviewIndex((current) => Math.max(0, current));
    }
  };

  const handleArchive = async (question: BankQuestion) => {
    setMutating(true);
    const result = await patchQuestion(question, draftFromQuestion(question), "archive");
    setMutating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(question.id);
      return next;
    });
    await fetchList();
  };

  const handleEditSave = async () => {
    if (!editQuestion) return;
    setMutating(true);
    setEditError(null);
    const result = await patchQuestion(editQuestion, editDraft, "save");
    setMutating(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditQuestion(null);
    await fetchList();
  };

  const handleAddQuestion = async (action: "save" | "approve") => {
    setMutating(true);
    setAddError(null);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftPayload(addDraft),
          grade: addMeta.grade,
          subject: addMeta.subject,
          academicYear: addMeta.year,
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setAddError(data.error || "The question could not be saved");
        return;
      }
      setAddOpen(false);
      setAddDraft(EMPTY_DRAFT);
      setSourceFilter("");
      setView(action === "approve" ? "bank" : "review");
      setPage(1);
      await fetchReviewCount();
    } catch {
      setAddError("The question could not be saved");
    } finally {
      setMutating(false);
    }
  };

  const handleDiagramSave = async (imageBase64: string) => {
    const raw = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;
    if (diagramFor === "review" && currentReview) {
      setMutating(true);
      const result = await patchQuestion(currentReview, reviewDraft, "save", raw);
      setMutating(false);
      setDiagramFor(null);
      if (!result.ok) {
        setReviewError(result.error);
        return;
      }
      await fetchList();
    }
    if (diagramFor === "edit" && editQuestion) {
      setMutating(true);
      const result = await patchQuestion(editQuestion, editDraft, "save", raw);
      setMutating(false);
      setDiagramFor(null);
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      setEditQuestion(result.question);
      await fetchList();
    }
  };

  const toggleSelected = (question: BankQuestion) => {
    if (question.reviewStatus !== "approved") return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
    setSelectedMap((current) => {
      const next = new Map(current);
      if (next.has(question.id)) next.delete(question.id);
      else next.set(question.id, question);
      return next;
    });
  };

  const builderOrder = builderSections.flatMap((section) => section.questionIds);
  const selectedQuestions = builderOrder
    .map((id) => selectedMap.get(id))
    .filter((question): question is BankQuestion => Boolean(question));
  const selectionConflict = detectSelectionConflicts(
    Array.from(selectedMap.values()),
  );
  const selectionSummary = summarizeSelection(Array.from(selectedMap.values()));

  const openBuilder = () => {
    const selected = Array.from(selectedMap.values());
    setBuilderSections(groupQuestionsIntoSections(selected));
    setBuilderTitle("");
    setBuilderYear(String(new Date().getFullYear()));
    setBuilderDuration("180");
    setBuilderError(null);
    setGenerateStage(null);
    setCreationKey(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `paper-${Date.now()}-${selected.length}`,
    );
    setBuilderOpen(true);
  };

  const updateBuilderSection = (
    sectionKey: string,
    patch: Partial<Pick<BuilderSection, "title" | "instructions">>,
  ) => {
    setBuilderSections((current) =>
      current.map((section) =>
        section.key === sectionKey ? { ...section, ...patch } : section,
      ),
    );
  };

  const moveBuilderItem = (sectionKey: string, index: number, direction: -1 | 1) => {
    setBuilderSections((current) =>
      current.map((section) => {
        if (section.key !== sectionKey) return section;
        const next = [...section.questionIds];
        const target = index + direction;
        if (target < 0 || target >= next.length) return section;
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        return { ...section, questionIds: next };
      }),
    );
  };

  const removeBuilderItem = (id: string) => {
    setBuilderSections((current) =>
      current
        .map((section) => ({
          ...section,
          questionIds: section.questionIds.filter((item) => item !== id),
        }))
        .filter((section) => section.questionIds.length > 0),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setSelectedMap((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectedMap(new Map());
    setBuilderSections([]);
  };

  const handleGeneratePaper = async () => {
    if (!selectionConflict.ok) {
      setBuilderError(selectionConflict.error || "Selected questions conflict");
      return;
    }
    if (builderOrder.length === 0) {
      setBuilderError("Select at least one question");
      return;
    }
    setGenerateStage("Saving paper");
    setBuilderError(null);
    try {
      const items = builderSections.flatMap((section, sectionIndex) =>
        section.questionIds.map((id, questionIndex) => ({
          questionId: id,
          sectionTitle: section.title,
          sectionInstructions: section.instructions,
          sectionOrder: sectionIndex + 1,
          questionOrder: questionIndex + 1,
        })),
      );
      const response = await fetch("/api/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationKey,
          title: builderTitle,
          academicYear: Number(builderYear),
          durationMinutes: Number(builderDuration),
          items,
        }),
      });
      const data = await response.json();
      if (data.paperSaved && !data.success) {
        setGenerateStage(null);
        setBuilderError(data.error || "The paper was saved, but the PDF could not be created");
        setSavedNotice(data.paperId ?? null);
        return;
      }
      if (!response.ok || !data.success) {
        setGenerateStage(null);
        setBuilderError(data.error || "The paper could not be saved");
        return;
      }
      setGenerateStage("Ready");
      setSelectedIds(new Set());
      setSelectedMap(new Map());
      setBuilderSections([]);
      setBuilderOpen(false);
      setView("saved");
      setPage(1);
      setSavedNotice(null);
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setGenerateStage(null);
      setBuilderError("The paper could not be saved");
    }
  };

  const handleRetryPdf = async (paperId: string) => {
    setMutating(true);
    setError(null);
    try {
      const response = await fetch("/api/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", paperId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "The PDF could not be created");
        return;
      }
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      }
      setBuilderOpen(false);
      setSavedNotice(null);
      setView("saved");
      await fetchList();
    } catch {
      setError("The PDF could not be created");
    } finally {
      setMutating(false);
    }
  };

  const handleRenameSource = async (sourceId: string) => {
    const named = validateDisplayName(renameValue);
    if (!named.ok) {
      setRenameError(named.error);
      return;
    }
    const paperName = named.displayName;
    setMutating(true);
    setRenameError(null);
    try {
      const response = await fetch(`/api/question-papers/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: paperName }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setRenameError(data.error || "The paper name could not be saved");
        return;
      }
      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? { ...source, displayName: data.source.displayName }
            : source,
        ),
      );
      setRenamingSourceId(null);
    } catch {
      setRenameError("The paper name could not be saved");
    } finally {
      setMutating(false);
    }
  };

  useEffect(() => {
    if (view !== "bank" || !sourceFilter || loading) return;
    if (!sourceOptions.some((option) => option.id === sourceFilter)) {
      setSourceFilter("");
    }
  }, [view, sourceFilter, sourceOptions, loading]);

  useEffect(() => {
    if (questions.length === 0) {
      setReviewIndex(0);
      return;
    }
    setReviewIndex((current) => Math.min(current, questions.length - 1));
  }, [questions]);

  const selectedCount = selectedIds.size;
  const years = useMemo(
    () => ALL_YEARS.map(String).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)),
    [],
  );

  return (
    <div className={`min-h-screen bg-slate-50 py-8 ${dmSans.className}`}>
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-4xl font-bold text-slate-900 text-center sm:text-left">
            Question Bank
          </h1>
          <PortalLogoutButton />
        </div>

        <section className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-slate-100">
          <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
            Upload PDF
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="upload-grade" className={labelClass}>
                Grade <span className="text-red-500">*</span>
              </label>
              <select
                id="upload-grade"
                value={uploadForm.grade}
                onChange={(event) =>
                  setUploadForm({
                    ...uploadForm,
                    grade: event.target.value,
                    subject: "",
                  })
                }
                className={inputClass}
              >
                <option value="">Select grade</option>
                {ALL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="upload-subject" className={labelClass}>
                Subject <span className="text-red-500">*</span>
              </label>
              <select
                id="upload-subject"
                value={uploadForm.subject}
                disabled={!uploadForm.grade}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, subject: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Select subject</option>
                {uploadForm.grade &&
                  getSubjectsForGrade(parseInt(uploadForm.grade, 10)).map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="upload-year" className={labelClass}>
                Year <span className="text-red-500">*</span>
              </label>
              <select
                id="upload-year"
                value={uploadForm.year}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, year: event.target.value })
                }
                className={inputClass}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="pdf-upload" className={labelClass}>
              PDF File <span className="text-red-500">*</span>
            </label>
            <label htmlFor="pdf-upload">
              <div className="relative flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer">
                <p className="text-sm font-medium text-slate-900">
                  {uploadForm.file ? uploadForm.file.name : "Click to upload a PDF"}
                </p>
                <p className="text-xs text-slate-500">PDF files only</p>
              </div>
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && file.type === "application/pdf") {
                  setUploadForm({
                    ...uploadForm,
                    file,
                    displayName: suggestPaperNameFromFilename(file.name),
                  });
                } else if (file) {
                  setUploadNotice({
                    kind: "failed",
                    text: "Please select a PDF file.",
                    sourceId: null,
                  });
                }
              }}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="upload-paper-name" className={labelClass}>
              Paper name <span className="text-red-500">*</span>
            </label>
            <input
              id="upload-paper-name"
              value={uploadForm.displayName}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              onChange={(event) =>
                setUploadForm({ ...uploadForm, displayName: event.target.value })
              }
              className={inputClass}
              placeholder="Class 10 Pre-Final Mathematics 2026"
            />
            <p className="mt-1 text-xs text-slate-500">
              A name for finding this paper later. The original filename is kept
              separately.
            </p>
          </div>
          {uploading && (
            <p className="mb-3 text-sm text-slate-600" role="status">
              Extracting questions from the PDF…
            </p>
          )}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading and extracting…" : "Upload and extract questions"}
          </button>
          {uploadNotice && (
            <div
              className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
              role="status"
            >
              <p>{uploadNotice.text}</p>
              {uploadNotice.sourceId && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-blue-700 underline"
                    onClick={() => {
                      setSourceFilter(uploadNotice.sourceId || "");
                      setView("review");
                      setPage(1);
                    }}
                  >
                    Review questions
                  </button>
                  <button
                    type="button"
                    className="text-blue-700 underline"
                    onClick={() => {
                      setView("sources");
                      setPage(1);
                    }}
                  >
                    Open source
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <div
          role="tablist"
          aria-label="Question bank views"
          className="mb-6 flex flex-wrap gap-2"
        >
          {(
            [
              ["review", `Review${reviewTotal ? ` (${reviewTotal})` : ""}`],
              ["bank", "Question Bank"],
              ["sources", "Sources"],
              ["saved", "Saved Papers"],
            ] as const
          ).map(([name, label]) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={view === name}
              className={`px-4 py-2 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 ${
                view === name
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
              onClick={() => {
                if (name === "sources" || name === "saved") setSourceFilter("");
                setView(name);
                setPage(1);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== "review" && (
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 tracking-[0.18em] uppercase mb-4">
              Filters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filter-grade" className={labelClass}>
                  Class
                </label>
                <select
                  id="filter-grade"
                  value={filters.grade}
                  onChange={(event) => {
                    setFilters({ ...filters, grade: event.target.value, subject: "" });
                    setPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">All classes</option>
                  {ALL_GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-subject" className={labelClass}>
                  Subject
                </label>
                <select
                  id="filter-subject"
                  value={filters.subject}
                  disabled={!filters.grade}
                  onChange={(event) => {
                    setFilters({ ...filters, subject: event.target.value });
                    setPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">All subjects</option>
                  {filterSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-year" className={labelClass}>
                  Academic year
                </label>
                <select
                  id="filter-year"
                  value={filters.year}
                  onChange={(event) => {
                    setFilters({ ...filters, year: event.target.value });
                    setPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">All years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {view === "bank" && (
                <>
                  <div>
                    <label htmlFor="filter-source" className={labelClass}>
                      Source Paper
                    </label>
                    <select
                      id="filter-source"
                      value={sourceFilter}
                      onChange={(event) => {
                        setSourceFilter(event.target.value);
                        setPage(1);
                      }}
                      className={inputClass}
                    >
                      <option value="">All source papers</option>
                      {sourceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-type" className={labelClass}>
                      Question Type
                    </label>
                    <select
                      id="filter-type"
                      value={filters.type}
                      onChange={(event) => {
                        setFilters({ ...filters, type: event.target.value });
                        setPage(1);
                      }}
                      className={inputClass}
                    >
                      <option value="">All types</option>
                      <option value="MCQ">MCQ</option>
                      <option value="Short">Short Answer</option>
                      <option value="Medium">Medium Answer</option>
                      <option value="Long">Long Answer</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-marks" className={labelClass}>
                      Marks
                    </label>
                    <input
                      id="filter-marks"
                      type="number"
                      min={1}
                      max={100}
                      value={filters.marks}
                      onChange={(event) => {
                        setFilters({ ...filters, marks: event.target.value });
                        setPage(1);
                      }}
                      className={inputClass}
                      placeholder="All marks"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-search" className={labelClass}>
                      Search
                    </label>
                    <input
                      id="filter-search"
                      value={searchInput}
                      maxLength={200}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setFilters({ ...filters, q: searchInput.trim() });
                          setPage(1);
                        }
                      }}
                      className={inputClass}
                      placeholder="Search question text"
                    />
                  </div>
                </>
              )}
            </div>
            {view === "bank" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  onClick={() => {
                    setFilters({ ...filters, q: searchInput.trim() });
                    setPage(1);
                  }}
                >
                  Search
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                  onClick={() => setAddOpen(true)}
                >
                  Add question
                </button>
              </div>
            )}
          </section>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {view === "review" && (
          <section className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
            <p className="mb-4 text-sm text-slate-600">
              {sourceFilter ? total : reviewTotal} question
              {(sourceFilter ? total : reviewTotal) === 1 ? "" : "s"} awaiting review
              {sourceFilter ? " from this upload" : ""}
            </p>
            {sourceFilter && (
              <button
                type="button"
                className="mb-4 text-sm text-blue-700 underline"
                onClick={() => {
                  setSourceFilter("");
                  setPage(1);
                }}
              >
                Show all questions awaiting review
              </button>
            )}
            {loading ? (
              <p>Loading questions…</p>
            ) : !currentReview ? (
              <p>No questions are waiting for review.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 font-medium mb-1 break-words">
                    {currentReview.sourceDisplayName ||
                      sourcePdf?.displayName ||
                      "Manual question"}
                    {currentReview.sourcePageNumber
                      ? ` · page ${currentReview.sourcePageNumber}`
                      : ""}
                    {sourcePdf?.statusLabel ? ` · ${sourcePdf.statusLabel}` : ""}
                  </p>
                  {currentReview.sourceFilename && (
                    <p className="text-xs text-slate-500 mb-2 break-words">
                      File: {currentReview.sourceFilename}
                    </p>
                  )}
                  {sourcePdf?.url ? (
                    <>
                      <iframe
                        title="Source PDF"
                        src={`${sourcePdf.url}#page=${currentReview.sourcePageNumber || 1}`}
                        className="hidden xl:block w-full h-[36rem] rounded-lg border border-slate-200"
                      />
                      <a
                        href={`${sourcePdf.url}#page=${currentReview.sourcePageNumber || 1}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-blue-700 underline"
                      >
                        Open source PDF at page {currentReview.sourcePageNumber || 1}
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No retained source PDF is available for this question.
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <QuestionEditor
                    idPrefix="review"
                    draft={reviewDraft}
                    onChange={setReviewDraft}
                    disabled={mutating}
                    onMath={() => setMathField("review")}
                  />
                  {currentReview.rawExtractedText && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">
                        Original extracted text
                      </h3>
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-600 border border-slate-200 rounded-lg p-3 bg-slate-50">
                        {currentReview.rawExtractedText}
                      </p>
                    </div>
                  )}
                  {currentReview.diagramUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentReview.diagramUrl}
                      alt="Question diagram"
                      className="mt-3 max-w-full border border-slate-200 rounded"
                    />
                  )}
                  {reviewError && (
                    <p className="mt-3 text-sm text-red-700" role="alert">
                      {reviewError}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleReviewAction("approve")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
                    >
                      Approve & Next
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleReviewAction("save")}
                      className="px-4 py-2 border border-slate-300 rounded-lg disabled:text-gray-400"
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleReviewAction("reject")}
                      className="px-4 py-2 border border-red-300 text-red-700 rounded-lg disabled:text-gray-400"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => setDiagramFor("review")}
                      className="px-4 py-2 border border-slate-300 rounded-lg"
                    >
                      Edit diagram
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={reviewIndex === 0 && page === 1}
                      onClick={() => {
                        if (reviewIndex > 0) setReviewIndex(reviewIndex - 1);
                        else if (page > 1) setPage(page - 1);
                      }}
                      className="px-4 py-2 border border-slate-300 rounded-lg disabled:text-gray-400"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        reviewIndex >= questions.length - 1 && page >= totalPages
                      }
                      onClick={() => {
                        if (reviewIndex < questions.length - 1) {
                          setReviewIndex(reviewIndex + 1);
                        } else if (page < totalPages) {
                          setPage(page + 1);
                        }
                      }}
                      className="px-4 py-2 border border-slate-300 rounded-lg disabled:text-gray-400"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "bank" && (
          <section className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
            <div className="sticky top-[112px] z-20 mb-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    {selectionSummary.total} selected · {selectionSummary.marks} marks
                  </p>
                  <p className="mt-1 text-slate-600">
                    MCQ {selectionSummary.mcq} · Short {selectionSummary.short} ·
                    Medium {selectionSummary.medium} · Long {selectionSummary.long}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={clearSelection}
                    className="px-4 py-2 border border-slate-300 rounded-lg disabled:text-gray-400"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={openBuilder}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                  >
                    Prepare Paper
                  </button>
                </div>
              </div>
            </div>
            <p className="mb-4 text-sm text-slate-600">{total} approved questions</p>
            {loading ? (
              <p>Loading questions…</p>
            ) : questions.length === 0 ? (
              <p>No approved questions match these filters.</p>
            ) : (
              <ul className="space-y-3">
                {questions.map((question) => (
                  <li
                    key={question.id}
                    className="border border-slate-200 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id={`select-${question.id}`}
                        type="checkbox"
                        checked={selectedIds.has(question.id)}
                        onChange={() => toggleSelected(question)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-slate-900">
                          {renderQuestionText(question.questionText)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-800">
                            {questionTypeLabel(question.questionType)}
                          </span>
                          <span>
                            {question.marks} mark{question.marks === 1 ? "" : "s"}
                          </span>
                          {question.sourceDisplayName && (
                            <span className="font-medium text-slate-800">
                              {question.sourceDisplayName}
                            </span>
                          )}
                          {question.sourcePageNumber != null && (
                            <span>p. {question.sourcePageNumber}</span>
                          )}
                          {question.sectionLabel && (
                            <span>{question.sectionLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 border border-slate-300 rounded-lg"
                        onClick={() => {
                          setEditQuestion(question);
                          setEditDraft(draftFromQuestion(question));
                          setEditError(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={mutating}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
                        onClick={() => handleArchive(question)}
                      >
                        Archive
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
            />
          </section>
        )}

        {view === "sources" && (
          <section className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
            {loading ? (
              <p>Loading sources…</p>
            ) : sources.length === 0 ? (
              <p>No uploaded PDFs yet.</p>
            ) : (
              <ul className="space-y-4">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 break-words">
                          {source.displayName || source.filename}
                        </p>
                        <p className="text-xs text-slate-500 break-words">
                          File: {source.filename}
                        </p>
                        <p className="text-sm text-slate-600">
                          Class {source.grade} · {source.subject} · {source.academicYear}
                        </p>
                        <p className="text-sm text-slate-600">
                          {source.processedPageCount} of {source.pageCount} pages
                          extracted · {source.savedQuestionCount} questions saved
                        </p>
                        {source.failedPages.length > 0 && (
                          <p className="text-sm text-amber-800">
                            Failed pages: {source.failedPages.join(", ")}. Successful
                            questions remain available. Failed pages can be uploaded
                            later as a smaller PDF.
                          </p>
                        )}
                        {source.possiblyInterrupted && (
                          <p className="text-sm text-slate-700">
                            This upload may have been interrupted. It will not retry
                            automatically.
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Uploaded {new Date(source.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadgeClass(source.status)}`}
                      >
                        {source.statusLabel}
                      </span>
                    </div>
                    {renamingSourceId === source.id && (
                      <div className="mt-3">
                        <label htmlFor={`rename-${source.id}`} className={labelClass}>
                          Paper name
                        </label>
                        <input
                          id={`rename-${source.id}`}
                          value={renameValue}
                          maxLength={MAX_DISPLAY_NAME_LENGTH}
                          onChange={(event) => setRenameValue(event.target.value)}
                          className={inputClass}
                        />
                        {renameError && (
                          <p className="mt-1 text-sm text-red-700" role="alert">
                            {renameError}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={mutating}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
                            onClick={() => handleRenameSource(source.id)}
                          >
                            Save name
                          </button>
                          <button
                            type="button"
                            disabled={mutating}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg"
                            onClick={() => {
                              setRenamingSourceId(null);
                              setRenameError(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SourcePdfLink sourceId={source.id} />
                      <button
                        type="button"
                        className="px-3 py-1.5 border border-slate-300 rounded-lg"
                        onClick={() => {
                          setRenamingSourceId(source.id);
                          setRenameValue(source.displayName || "");
                          setRenameError(null);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg"
                        onClick={() => {
                          setSourceFilter(source.id);
                          setView("review");
                          setPage(1);
                        }}
                      >
                        Review questions
                      </button>
                      {shouldRenderRetryButton(source, {
                        retryingSourceId,
                        lockedSourceIds: retryLockedIds,
                      }) && (
                        <button
                          type="button"
                          disabled={retryingSourceId !== null}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
                          onClick={() => handleRetryExtraction(source.id)}
                        >
                          Retry Extraction
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
            />
          </section>
        )}

        {view === "saved" && (
          <section className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
            {savedNotice && (
              <p className="mb-4 text-sm text-amber-800" role="status">
                The paper was saved. You can retry the PDF from this list.
              </p>
            )}
            {loading ? (
              <p>Loading saved papers…</p>
            ) : savedPapers.length === 0 ? (
              <p>No saved papers yet.</p>
            ) : (
              <ul className="space-y-4">
                {savedPapers.map((paper) => (
                  <li
                    key={paper.id}
                    className="border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 break-words">
                          {paper.title}
                        </p>
                        <p className="text-sm text-slate-600">
                          Class {paper.grade} · {paper.subject} · {paper.academicYear}
                          {paper.durationMinutes
                            ? ` · ${formatDuration(paper.durationMinutes)}`
                            : ""}
                          {` · ${paper.totalMarks} marks`}
                          {paper.itemCount != null
                            ? ` · ${paper.itemCount} questions`
                            : ""}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {paper.finalizedAt
                            ? `Finalized ${new Date(paper.finalizedAt).toLocaleString()}`
                            : paper.createdAt
                              ? `Created ${new Date(paper.createdAt).toLocaleString()}`
                              : ""}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-100 text-slate-700 border-slate-200">
                        {paper.pdfStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paper.pdfAvailable ? (
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg"
                          onClick={async () => {
                            const response = await fetch(
                              `/api/question-papers/${paper.id}?resource=paper`,
                            );
                            const data = await response.json();
                            if (data.pdfUrl) {
                              window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
                            } else {
                              setError(data.error || "The PDF is not available");
                            }
                          }}
                        >
                          Download
                        </button>
                      ) : paper.status === "final" ? (
                        <button
                          type="button"
                          disabled={mutating}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
                          onClick={() => handleRetryPdf(paper.id)}
                        >
                          Retry PDF
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
            />
          </section>
        )}
      </div>

      {builderOpen && (
        <Modal title="Paper builder" onClose={() => !generateStage && setBuilderOpen(false)}>
          {!selectionConflict.ok && (
            <p className="mb-4 text-sm text-red-700" role="alert">
              {selectionConflict.error}. Remove the conflicting questions to continue.
            </p>
          )}
          <p className="mb-3 text-sm text-slate-600">
            {builderOrder.length} questions · {previewMarks(selectedQuestions)} marks
            {selectionConflict.ok && selectionConflict.grade
              ? ` · Class ${romanClass(selectionConflict.grade)} ${selectionConflict.subject || ""}`
              : ""}
          </p>
          <p className="mb-4 text-sm text-slate-600">
            Questions are grouped by type. Source paper names are for finding
            questions and are not printed on the generated paper.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-3">
              <label htmlFor="builder-title" className={labelClass}>
                Paper title
              </label>
              <input
                id="builder-title"
                value={builderTitle}
                onChange={(event) => setBuilderTitle(event.target.value)}
                className={inputClass}
                maxLength={300}
              />
            </div>
            <div>
              <label htmlFor="builder-year" className={labelClass}>
                Academic year
              </label>
              <select
                id="builder-year"
                value={builderYear}
                onChange={(event) => setBuilderYear(event.target.value)}
                className={inputClass}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="builder-duration" className={labelClass}>
                Duration (minutes)
              </label>
              <input
                id="builder-duration"
                type="number"
                min={1}
                max={600}
                value={builderDuration}
                onChange={(event) => setBuilderDuration(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-6 mb-4">
            {builderSections.map((section) => (
              <section
                key={section.key}
                className="border border-slate-200 rounded-xl p-4"
              >
                <div className="grid grid-cols-1 gap-3 mb-3">
                  <div>
                    <label
                      htmlFor={`builder-section-${section.key}`}
                      className={labelClass}
                    >
                      Section title
                    </label>
                    <input
                      id={`builder-section-${section.key}`}
                      value={section.title}
                      onChange={(event) =>
                        updateBuilderSection(section.key, {
                          title: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`builder-instructions-${section.key}`}
                      className={labelClass}
                    >
                      Section instructions
                    </label>
                    <input
                      id={`builder-instructions-${section.key}`}
                      value={section.instructions}
                      onChange={(event) =>
                        updateBuilderSection(section.key, {
                          instructions: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
                <ol className="space-y-3">
                  {section.questionIds.map((id, index) => {
                    const question = selectedMap.get(id);
                    if (!question) return null;
                    return (
                      <li
                        key={question.id}
                        className="border border-slate-200 rounded-lg p-3"
                      >
                        <p className="text-sm font-medium text-slate-700">
                          {index + 1}. {questionTypeLabel(question.questionType)} ·{" "}
                          {question.marks} marks
                        </p>
                        <p className="text-sm text-slate-600 break-words whitespace-pre-wrap">
                          {question.questionText}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={index === 0 || Boolean(generateStage)}
                            onClick={() =>
                              moveBuilderItem(section.key, index, -1)
                            }
                            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === section.questionIds.length - 1 ||
                              Boolean(generateStage)
                            }
                            onClick={() =>
                              moveBuilderItem(section.key, index, 1)
                            }
                            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(generateStage)}
                            onClick={() => removeBuilderItem(question.id)}
                            className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg disabled:text-gray-400"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
          {generateStage && (
            <p className="mb-3 text-sm text-slate-700" role="status">
              {generateStage}…
            </p>
          )}
          {builderError && (
            <p className="mb-3 text-sm text-red-700" role="alert">
              {builderError}
              {savedNotice && (
                <>
                  <button
                    type="button"
                    className="ml-2 text-blue-700 underline"
                    onClick={() => {
                      setBuilderOpen(false);
                      setView("saved");
                      setPage(1);
                    }}
                  >
                    Open Saved Papers
                  </button>
                  <button
                    type="button"
                    className="ml-2 text-blue-700 underline"
                    disabled={mutating}
                    onClick={() => handleRetryPdf(savedNotice)}
                  >
                    Retry PDF
                  </button>
                </>
              )}
            </p>
          )}
          <button
            type="button"
            disabled={
              Boolean(generateStage) ||
              !selectionConflict.ok ||
              builderOrder.length === 0 ||
              !builderTitle.trim()
            }
            onClick={handleGeneratePaper}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
          >
            Generate and save
          </button>
        </Modal>
      )}

      {addOpen && (
        <Modal title="Add question" onClose={() => !mutating && setAddOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="add-grade" className={labelClass}>
                Grade
              </label>
              <select
                id="add-grade"
                value={addMeta.grade}
                onChange={(event) =>
                  setAddMeta({ ...addMeta, grade: event.target.value, subject: "" })
                }
                className={inputClass}
              >
                <option value="">Select grade</option>
                {ALL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-subject" className={labelClass}>
                Subject
              </label>
              <select
                id="add-subject"
                value={addMeta.subject}
                disabled={!addMeta.grade}
                onChange={(event) =>
                  setAddMeta({ ...addMeta, subject: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Select subject</option>
                {addSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-year" className={labelClass}>
                Year
              </label>
              <select
                id="add-year"
                value={addMeta.year}
                onChange={(event) =>
                  setAddMeta({ ...addMeta, year: event.target.value })
                }
                className={inputClass}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <QuestionEditor
            idPrefix="add"
            draft={addDraft}
            onChange={setAddDraft}
            disabled={mutating}
            onMath={() => setMathField("add")}
          />
          {addError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {addError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mutating}
              onClick={() => handleAddQuestion("save")}
              className="px-4 py-2 border border-slate-300 rounded-lg disabled:text-gray-400"
            >
              Save for review
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => handleAddQuestion("approve")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
            >
              Save and approve
            </button>
          </div>
        </Modal>
      )}

      {editQuestion && (
        <Modal title="Edit question" onClose={() => !mutating && setEditQuestion(null)}>
          <QuestionEditor
            idPrefix="edit"
            draft={editDraft}
            onChange={setEditDraft}
            disabled={mutating}
            onMath={() => setMathField("edit")}
          />
          {editQuestion.diagramUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={editQuestion.diagramUrl}
              alt="Question diagram"
              className="mt-3 max-w-full border border-slate-200 rounded"
            />
          )}
          {editError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {editError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mutating}
              onClick={handleEditSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
            >
              Save
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => setDiagramFor("edit")}
              className="px-4 py-2 border border-slate-300 rounded-lg"
            >
              Edit diagram
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => setEditQuestion(null)}
              className="px-4 py-2 border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {diagramFor && (
        <Modal title="Edit diagram" onClose={() => setDiagramFor(null)}>
          <DiagramSketchTool
            onSave={handleDiagramSave}
            onCancel={() => setDiagramFor(null)}
            existingImage={
              diagramFor === "review"
                ? currentReview?.diagramUrl ?? undefined
                : editQuestion?.diagramUrl ?? undefined
            }
          />
        </Modal>
      )}

      {mathField && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 p-3">
          <MathKeyboard
            visible
            onInsert={(symbol) => {
              const apply = (draft: QuestionDraft) => ({
                ...draft,
                questionText: `${draft.questionText}${symbol}`,
              });
              if (mathField === "review") setReviewDraft(apply);
              if (mathField === "edit") setEditDraft(apply);
              if (mathField === "add") setAddDraft(apply);
            }}
            onClose={() => setMathField(null)}
          />
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  idPrefix,
  draft,
  onChange,
  disabled,
  onMath,
}: {
  idPrefix: string;
  draft: QuestionDraft;
  onChange: (draft: QuestionDraft) => void;
  disabled: boolean;
  onMath: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-text`} className={labelClass}>
          Question text
        </label>
        <textarea
          id={`${idPrefix}-text`}
          value={draft.questionText}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, questionText: event.target.value })
          }
          rows={6}
          className={`${inputClass} break-words`}
        />
        <button
          type="button"
          className="mt-2 text-sm text-blue-700 underline"
          onClick={onMath}
        >
          Math symbols
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-type`} className={labelClass}>
            Type
          </label>
          <select
            id={`${idPrefix}-type`}
            value={draft.questionType}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...draft,
                questionType: event.target.value as QuestionType,
              })
            }
            className={inputClass}
          >
            <option value="MCQ">MCQ</option>
            <option value="Short">Short Answer</option>
            <option value="Medium">Medium Answer</option>
            <option value="Long">Long Answer</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-marks`} className={labelClass}>
            Marks
          </label>
          <input
            id={`${idPrefix}-marks`}
            type="number"
            min={1}
            max={100}
            value={draft.marks}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...draft, marks: Number(event.target.value) })
            }
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-section`} className={labelClass}>
            Section
          </label>
          <input
            id={`${idPrefix}-section`}
            value={draft.sectionLabel}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...draft, sectionLabel: event.target.value })
            }
            className={inputClass}
          />
        </div>
      </div>
      {draft.questionType === "MCQ" && (
        <fieldset>
          <legend className={labelClass}>Options</legend>
          {draft.options.map((option, index) => (
            <div key={`${idPrefix}-option-${index}`} className="mb-2">
              <label htmlFor={`${idPrefix}-option-${index}`} className="sr-only">
                Option {String.fromCharCode(65 + index)}
              </label>
              <input
                id={`${idPrefix}-option-${index}`}
                value={option}
                disabled={disabled}
                onChange={(event) => {
                  const options = [...draft.options];
                  options[index] = event.target.value;
                  onChange({ ...draft, options });
                }}
                className={inputClass}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
              />
            </div>
          ))}
        </fieldset>
      )}
      <div>
        <label htmlFor={`${idPrefix}-answer`} className={labelClass}>
          Correct answer
        </label>
        <input
          id={`${idPrefix}-answer`}
          value={draft.correctAnswer}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, correctAnswer: event.target.value })
          }
          className={inputClass}
        />
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
      >
        Previous page
      </button>
      <p className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
      >
        Next page
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 pb-8 pt-28">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 hover:bg-slate-50"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SourcePdfLink({ sourceId }: { sourceId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPdf = async () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/question-papers/${sourceId}?pageSize=1`);
      const data = await response.json();
      if (!response.ok || !data.success || !data.pdfUrl) {
        setError(data.error || "The source PDF is not available");
        return;
      }
      setUrl(data.pdfUrl);
      window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("The source PDF is not available");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={openPdf}
        disabled={loading}
        className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:text-gray-400"
      >
        {loading ? "Opening PDF…" : "View PDF"}
      </button>
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
