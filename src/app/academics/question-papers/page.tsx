"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  createRetryClickLock,
  failedPageRetryLabel,
  failedPageRetryingLabel,
  shouldRenderFailedPageRetryButton,
  shouldRenderRetryButton,
} from "@/lib/question-bank-v2-retry.mjs";
import { ALL_GRADES, ALL_YEARS, getSubjectsForGrade } from "@/lib/subjects";
import { uploadResultMessage } from "@/lib/question-bank-v2-review-ui.mjs";
import {
  detectSelectionConflicts,
  findDuplicatePaperNameWarning,
  formatDuration,
  groupQuestionsIntoSections,
  previewMarks,
  questionTypeLabel,
  romanClass,
  suggestGeneratedPaperName,
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
  updatedAt: string | null;
  lockVersion: number | null;
  editable: boolean;
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
  failedPageRetryEligible: boolean;
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

type UploadStage = "validating" | "uploading" | "extracting" | null;

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

const VIEW_NAMES: ViewName[] = ["review", "bank", "sources", "saved"];

const inputClass =
  "w-full min-h-[2.75rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const primaryButtonClass =
  "inline-flex min-h-[2.75rem] items-center justify-center rounded-lg bg-[#1e3a8a] px-4 py-2 font-medium text-white transition-colors hover:bg-[#1e40af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600";
const secondaryButtonClass =
  "inline-flex min-h-[2.75rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white";
const dangerButtonClass =
  "inline-flex min-h-[2.75rem] items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white";
const cardClass = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";

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
            <table className="my-1.5 border-collapse text-[13px]" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="border border-slate-300 bg-slate-50 px-2 py-1" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="border border-slate-300 px-2 py-1" {...props} />
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

function paperStatusBadgeClass(pdfStatus: string) {
  if (pdfStatus === "Ready") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (pdfStatus === "PDF pending") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function noticeToneClass(kind: UploadNotice["kind"]) {
  if (kind === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (kind === "partial") return "border-amber-200 bg-amber-50 text-amber-900";
  if (kind === "failed") return "border-red-200 bg-red-50 text-red-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function uploadStageText(stage: UploadStage) {
  if (stage === "validating") return "Validating PDF…";
  if (stage === "uploading") return "Uploading source…";
  if (stage === "extracting") return "Extracting and saving questions…";
  return "";
}

export default function QuestionPapers() {
  const [view, setViewState] = useState<ViewName | null>(null);
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
  const [builderPaperId, setBuilderPaperId] = useState<string | null>(null);
  const [builderLockVersion, setBuilderLockVersion] = useState<number | null>(null);
  const [builderDirty, setBuilderDirty] = useState(false);
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const savingRef = useRef(false);
  const [builderYear, setBuilderYear] = useState(String(new Date().getFullYear()));
  const [builderDuration, setBuilderDuration] = useState("180");
  const [builderSections, setBuilderSections] = useState<BuilderSection[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [creationKey, setCreationKey] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
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
  const [savedStatusFilter, setSavedStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    displayName: "",
    subject: "",
    grade: "",
    year: String(new Date().getFullYear()),
  });
  const lastNameSuggestionRef = useRef("");
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>(null);
  const [retryingSourceId, setRetryingSourceId] = useState<string | null>(null);
  const [retryingFailedPages, setRetryingFailedPages] = useState<number[]>([]);
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
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentReview = questions[reviewIndex] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const reviewPosition = (page - 1) * pageSize + reviewIndex + 1;
  const filterSubjects = filters.grade
    ? getSubjectsForGrade(parseInt(filters.grade, 10))
    : [];
  const addSubjects = addMeta.grade
    ? getSubjectsForGrade(parseInt(addMeta.grade, 10))
    : [];

  const selectView = useCallback((name: ViewName) => {
    setViewState(name);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", name);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const fetchList = useCallback(async () => {
    if (!view) return false;
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
      if (view === "saved") {
        if (savedStatusFilter) params.set("status", savedStatusFilter);
        if (filters.q) params.set("q", filters.q);
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
  }, [filters, page, pageSize, savedStatusFilter, sourceFilter, view]);

  const fetchReviewCount = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch(
        "/api/question-papers?view=review&page=1&pageSize=1",
      );
      const data = await response.json();
      if (response.ok && data.success) {
        const count = data.total ?? 0;
        setReviewTotal(count);
        return count;
      }
    } catch {
      /* keep the last known count */
    }
    return 0;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const explicit =
      tab && (VIEW_NAMES as string[]).includes(tab) ? (tab as ViewName) : null;
    if (explicit) setViewState(explicit);
    let cancelled = false;
    (async () => {
      const count = await fetchReviewCount();
      if (!cancelled && !explicit) {
        setViewState(count > 0 ? "review" : "bank");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReviewCount]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (view !== "saved") return;
    const trimmed = searchInput.trim();
    if (trimmed === filters.q) return;
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.q === trimmed ? current : { ...current, q: trimmed },
      );
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, view]);

  useEffect(() => {
    setReviewIndex(0);
  }, [page, view, filters]);

  useEffect(() => {
    if (view !== "bank") return;
    const trimmed = searchInput.trim();
    if (trimmed === filters.q) return;
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.q === trimmed ? current : { ...current, q: trimmed },
      );
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, view]);

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
    if (uploading) return;
    const gradeNum = uploadForm.grade ? parseInt(uploadForm.grade, 10) : 0;
    const named = validateDisplayName(uploadForm.displayName);
    if (!uploadForm.file || !uploadForm.subject || !uploadForm.grade || !uploadForm.year) {
      setUploadNotice({
        kind: "failed",
        text: "Please choose a class, subject, academic year, paper name, and PDF file.",
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
        text: "Please select a valid class (1–10).",
        sourceId: null,
      });
      return;
    }

    setUploading(true);
    setUploadStage("validating");
    setUploadNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("displayName", paperName);
      formData.append("subject", uploadForm.subject);
      formData.append("grade", uploadForm.grade);
      formData.append("year", uploadForm.year);
      setUploadStage("uploading");
      const data = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/question-papers");
          xhr.responseType = "json";
          xhr.upload.onloadend = () => setUploadStage("extracting");
          xhr.onload = () => resolve(xhr.response ?? {});
          xhr.onerror = () => reject(new Error("upload_failed"));
          xhr.send(formData);
        },
      );
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
        lastNameSuggestionRef.current = "";
        setSourceFilter(notice.sourceId || "");
        selectView("review");
        setPage(1);
        await fetchReviewCount();
      } else if (notice.kind === "duplicate" || notice.kind === "failed") {
        selectView("sources");
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
      setUploadStage(null);
    }
  };

  const beginSourceRetry = (sourceId: string, failedPages: number[] = []) => {
    if (!retryLockRef.current.tryAcquire() || retryingSourceId) return false;
    setRetryingSourceId(sourceId);
    setRetryingFailedPages(failedPages);
    setRetryLockedIds((current) =>
      current.includes(sourceId) ? current : [...current, sourceId],
    );
    setSources((current) =>
      current.map((source) =>
        source.id === sourceId
          ? { ...source, retryEligible: false, failedPageRetryEligible: false }
          : source,
      ),
    );
    setUploadNotice(null);
    return true;
  };

  const finishSourceRetry = async (
    sourceId: string,
    data: Record<string, unknown>,
  ) => {
    const notice = uploadResultMessage(data) as UploadNotice;
    setUploadNotice(notice);
    selectView("sources");
    setPage(1);
    const listReloaded = (await fetchList()) === true;
    if (listReloaded) {
      setRetryLockedIds((current) => current.filter((id) => id !== sourceId));
    }
    if (notice.kind === "completed" || notice.kind === "partial") {
      setSourceFilter(notice.sourceId || sourceId);
      selectView("review");
    }
    return notice;
  };

  const handleRetryExtraction = async (sourceId: string) => {
    if (!beginSourceRetry(sourceId)) return;
    try {
      const response = await fetch(`/api/question-papers/${sourceId}/retry`, {
        method: "POST",
      });
      const data = await response.json();
      await finishSourceRetry(sourceId, data);
    } catch {
      setUploadNotice({
        kind: "failed",
        text: "The extraction could not be retried.",
        sourceId,
      });
    } finally {
      retryLockRef.current.release();
      setRetryingSourceId(null);
      setRetryingFailedPages([]);
    }
  };

  const handleRetryFailedPages = async (sourceId: string, failedPages: number[]) => {
    if (!beginSourceRetry(sourceId, failedPages)) return;
    try {
      const response = await fetch(
        `/api/question-papers/${sourceId}/retry-failed-pages`,
        { method: "POST" },
      );
      const data = await response.json();
      await finishSourceRetry(sourceId, data);
    } catch {
      setUploadNotice({
        kind: "failed",
        text: "The failed pages could not be retried.",
        sourceId,
      });
    } finally {
      retryLockRef.current.release();
      setRetryingSourceId(null);
      setRetryingFailedPages([]);
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
    setReviewNotice(null);
    const result = await patchQuestion(currentReview, reviewDraft, action);
    setMutating(false);
    if (!result.ok) {
      setReviewError(result.error);
      return;
    }
    setReviewNotice(
      action === "approve"
        ? "Question approved."
        : action === "reject"
          ? "Question rejected."
          : "Draft saved.",
    );
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
    setSelectedMap((current) => {
      const next = new Map(current);
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
      selectView(action === "approve" ? "bank" : "review");
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
    setSelectionNotice(null);
  };

  const builderOrder = builderSections.flatMap((section) => section.questionIds);
  const selectedQuestions = builderOrder
    .map((id) => selectedMap.get(id))
    .filter((question): question is BankQuestion => Boolean(question));
  const selectionConflict = detectSelectionConflicts(
    Array.from(selectedMap.values()),
  );
  const selectionSummary = summarizeSelection(Array.from(selectedMap.values()));

  const newCreationKey = (seed: number) =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `paper-${Date.now()}-${seed}`;

  const openBuilder = () => {
    if (!selectionConflict.ok) {
      setSelectionNotice(
        "A question paper can contain questions from only one class and subject.",
      );
      return;
    }
    setSelectionNotice(null);
    const selected = Array.from(selectedMap.values());
    setBuilderSections(groupQuestionsIntoSections(selected));
    setBuilderTitle(
      suggestGeneratedPaperName({
        grade: selectionConflict.grade,
        subject: selectionConflict.subject,
        academicYear: new Date().getFullYear(),
      }),
    );
    setBuilderPaperId(null);
    setBuilderLockVersion(null);
    setBuilderDirty(false);
    setTemplateWarning(null);
    setDraftNotice(null);
    setBuilderYear(String(new Date().getFullYear()));
    setBuilderDuration("180");
    setBuilderError(null);
    setGenerateStage(null);
    setCreationKey(newCreationKey(selected.length));
    setBuilderOpen(true);
  };

  /**
   * Continue a draft, or start a new composition from a previous paper. Both
   * read the server's authoritative composition; a template keeps the previous
   * paper untouched by opening as an unsaved new paper.
   */
  const openComposition = async (
    paper: SavedPaper,
    mode: "continue" | "template",
  ) => {
    setMutating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/question-papers/${paper.id}?resource=composition`,
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "This paper could not be opened");
        return;
      }
      const questions: BankQuestion[] = (data.questions ?? []).map(
        (question: Record<string, unknown>) =>
          ({
            ...(question as unknown as BankQuestion),
            reviewStatus: "approved",
            options: [],
          }) as BankQuestion,
      );
      const nextMap = new Map<string, BankQuestion>();
      const nextIds = new Set<string>();
      for (const question of questions) {
        nextMap.set(question.id, question);
        nextIds.add(question.id);
      }
      if (nextIds.size === 0) {
        setError(
          data.warning ||
            "None of this paper's questions are available in the approved Question Bank.",
        );
        return;
      }
      setSelectedMap(nextMap);
      setSelectedIds(nextIds);
      setBuilderSections(
        (data.sections ?? []).map(
          (
            section: {
              title?: string;
              instructions?: string | null;
              questionIds?: string[];
            },
            index: number,
          ) => ({
            key: `section-${index + 1}`,
            title: section.title || `Section ${index + 1}`,
            instructions: section.instructions ?? "",
            questionIds: section.questionIds ?? [],
          }),
        ),
      );
      setBuilderYear(String(data.paper?.academicYear ?? new Date().getFullYear()));
      setBuilderDuration(String(data.paper?.durationMinutes ?? 180));
      if (mode === "continue") {
        setBuilderTitle(data.paper?.title ?? "");
        setBuilderPaperId(paper.id);
        setBuilderLockVersion(data.paper?.lockVersion ?? null);
      } else {
        setBuilderTitle(`${data.paper?.title ?? "Question paper"} – Copy`);
        setBuilderPaperId(null);
        setBuilderLockVersion(null);
      }
      setCreationKey(newCreationKey(nextIds.size));
      setTemplateWarning(data.warning ?? null);
      setDraftNotice(null);
      setBuilderDirty(false);
      setBuilderError(null);
      setGenerateStage(null);
      setBuilderOpen(true);
    } catch {
      setError("This paper could not be opened");
    } finally {
      setMutating(false);
    }
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
    setBuilderDirty(true);
  };

  const moveBuilderSection = (index: number, direction: -1 | 1) => {
    setBuilderDirty(true);
    setBuilderSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(target, 0, section);
      return next;
    });
  };

  const moveBuilderItem = (sectionKey: string, index: number, direction: -1 | 1) => {
    setBuilderDirty(true);
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
    setBuilderDirty(true);
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
    setSelectionNotice(null);
  };

  const resetFilters = () => {
    setFilters({ subject: "", grade: "", year: "", type: "", marks: "", q: "" });
    setSearchInput("");
    setSourceFilter("");
    setPage(1);
  };

  const duplicateNameWarning = findDuplicatePaperNameWarning(
    builderTitle,
    savedPapers.filter((paper) => paper.id !== builderPaperId),
  );

  const builderItems = () =>
    builderSections.flatMap((section, sectionIndex) =>
      section.questionIds.map((id, questionIndex) => ({
        questionId: id,
        sectionTitle: section.title,
        sectionInstructions: section.instructions,
        sectionOrder: sectionIndex + 1,
        questionOrder: questionIndex + 1,
      })),
    );

  const handleSaveDraft = async () => {
    if (savingRef.current) return;
    if (!builderTitle.trim()) {
      setBuilderError("Enter a question paper name before saving");
      return;
    }
    if (!selectionConflict.ok) {
      setBuilderError(selectionConflict.error || "Selected questions conflict");
      return;
    }
    if (builderOrder.length === 0) {
      setBuilderError("Select at least one question");
      return;
    }
    savingRef.current = true;
    setSavingDraft(true);
    setBuilderError(null);
    setDraftNotice(null);
    try {
      const response = await fetch("/api/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          creationKey,
          paperId: builderPaperId ?? undefined,
          expectedLockVersion: builderLockVersion ?? undefined,
          title: builderTitle,
          academicYear: Number(builderYear),
          durationMinutes: Number(builderDuration),
          items: builderItems(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setBuilderError(data.error || "The draft could not be saved");
        return;
      }
      setBuilderPaperId(data.paperId ?? builderPaperId);
      setBuilderLockVersion(data.lockVersion ?? null);
      setBuilderDirty(false);
      setDraftNotice(
        `Draft saved · ${data.itemCount ?? builderOrder.length} questions · ${data.totalMarks ?? 0} marks`,
      );
      if (view === "saved") await fetchList();
    } catch {
      setBuilderError("The draft could not be saved");
    } finally {
      savingRef.current = false;
      setSavingDraft(false);
    }
  };

  const handleGeneratePaper = async () => {
    if (savingRef.current) return;
    if (!builderTitle.trim()) {
      setBuilderError("Enter a question paper name before generating");
      return;
    }
    if (!selectionConflict.ok) {
      setBuilderError(selectionConflict.error || "Selected questions conflict");
      return;
    }
    if (builderOrder.length === 0) {
      setBuilderError("Select at least one question");
      return;
    }
    savingRef.current = true;
    setGenerateStage("Saving paper and creating the PDF");
    setBuilderError(null);
    try {
      const items = builderItems();
      const response = await fetch("/api/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationKey,
          paperId: builderPaperId ?? undefined,
          expectedLockVersion: builderLockVersion ?? undefined,
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
      setGenerateStage(null);
      setSelectedIds(new Set());
      setSelectedMap(new Map());
      setBuilderSections([]);
      setBuilderOpen(false);
      setBuilderPaperId(null);
      setBuilderLockVersion(null);
      setBuilderDirty(false);
      setTemplateWarning(null);
      setDraftNotice(null);
      selectView("saved");
      setPage(1);
      setSavedNotice(null);
      if (data.pdfUrl) {
        setSavedSuccess(
          "The paper was saved. Its PDF opened in a new tab and is available below.",
        );
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      } else {
        setSavedSuccess("The paper was saved.");
      }
    } catch {
      setGenerateStage(null);
      setBuilderError("The paper could not be saved");
    } finally {
      savingRef.current = false;
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
      setSavedSuccess("The PDF is ready.");
      selectView("saved");
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

  const tabs = useMemo(
    () =>
      [
        ["review", `Review${reviewTotal ? ` (${reviewTotal})` : ""}`],
        ["bank", "Question Bank"],
        ["sources", "Sources"],
        ["saved", "Saved Papers"],
      ] as const,
    [reviewTotal],
  );

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      tabs.findIndex(([name]) => name === view),
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = tabs.length - 1;
    }
    const [nextName] = tabs[nextIndex];
    tabRefs.current[nextIndex]?.focus();
    activateTab(nextName);
  };

  const activateTab = (name: ViewName) => {
    if (name === "sources" || name === "saved") setSourceFilter("");
    selectView(name);
    setPage(1);
    setError(null);
    if (name !== "saved") setSavedSuccess(null);
  };

  return (
    <div className={`min-h-screen bg-slate-50 py-8 ${dmSans.className}`}>
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Question Bank
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload source papers, review extracted questions, and prepare
              question papers.
            </p>
          </div>
          <PortalLogoutButton />
        </div>

        <div className="mb-6 overflow-x-auto">
          <div
            role="tablist"
            aria-label="Question bank views"
            onKeyDown={handleTabKeyDown}
            className="flex min-w-max gap-2 pb-1"
          >
            {tabs.map(([name, label], index) => (
              <button
                key={name}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`tab-${name}`}
                aria-selected={view === name}
                aria-controls={`panel-${name}`}
                tabIndex={view === name || (view === null && index === 0) ? 0 : -1}
                className={`inline-flex min-h-[2.75rem] items-center whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a] ${
                  view === name
                    ? "bg-[#1e3a8a] text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => activateTab(name)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {uploadNotice && (
          <div
            className={`mb-6 rounded-lg border p-4 text-sm ${noticeToneClass(uploadNotice.kind)}`}
            role={uploadNotice.kind === "failed" ? "alert" : "status"}
          >
            <p>{uploadNotice.text}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {uploadNotice.sourceId && (
                <>
                  <button
                    type="button"
                    className="font-medium text-[#1e3a8a] underline underline-offset-2"
                    onClick={() => {
                      setSourceFilter(uploadNotice.sourceId || "");
                      selectView("review");
                      setPage(1);
                    }}
                  >
                    Review questions
                  </button>
                  <button
                    type="button"
                    className="font-medium text-[#1e3a8a] underline underline-offset-2"
                    onClick={() => {
                      selectView("sources");
                      setPage(1);
                    }}
                  >
                    Open source
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-slate-600 underline underline-offset-2"
                onClick={() => setUploadNotice(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {view === null && (
          <section className={cardClass}>
            <p role="status" className="text-sm text-slate-600">
              Loading…
            </p>
          </section>
        )}

        {view === "review" && (
          <section
            role="tabpanel"
            id="panel-review"
            aria-labelledby="tab-review"
            className={cardClass}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {total} question{total === 1 ? "" : "s"} awaiting review
                {sourceFilter ? " from this upload" : ""}
              </p>
              {currentReview && (
                <p className="text-sm font-medium text-slate-900">
                  Question {reviewPosition} of {total}
                </p>
              )}
            </div>
            {sourceFilter && (
              <button
                type="button"
                className="mb-4 text-sm font-medium text-[#1e3a8a] underline underline-offset-2"
                onClick={() => {
                  setSourceFilter("");
                  setPage(1);
                }}
              >
                Show all questions awaiting review
              </button>
            )}
            {loading ? (
              <p role="status" className="text-sm text-slate-600">
                Loading questions…
              </p>
            ) : !currentReview ? (
              <div className="py-8 text-center">
                <p className="text-slate-700">No questions are waiting for review.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Upload a source PDF from the Sources tab to extract more
                  questions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold text-slate-900">
                    {currentReview.sourceDisplayName ||
                      sourcePdf?.displayName ||
                      "Manual question"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {currentReview.sourcePageNumber
                      ? `Source page ${currentReview.sourcePageNumber}`
                      : "No source page"}
                    {sourcePdf?.statusLabel ? ` · ${sourcePdf.statusLabel}` : ""}
                  </p>
                  {currentReview.sourceFilename && (
                    <p className="mb-2 mt-0.5 break-words text-xs text-slate-500">
                      File: {currentReview.sourceFilename}
                    </p>
                  )}
                  {sourcePdf?.url ? (
                    <>
                      <iframe
                        title="Source PDF"
                        src={`${sourcePdf.url}#page=${currentReview.sourcePageNumber || 1}`}
                        className="mt-2 hidden h-[36rem] w-full rounded-lg border border-slate-200 xl:block"
                      />
                      <a
                        href={`${sourcePdf.url}#page=${currentReview.sourcePageNumber || 1}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex min-h-[2.75rem] items-center font-medium text-[#1e3a8a] underline underline-offset-2"
                      >
                        Open source PDF at page {currentReview.sourcePageNumber || 1}
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
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
                    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-slate-700">
                        View original extracted text
                      </summary>
                      <p className="whitespace-pre-wrap break-words border-t border-slate-200 p-3 text-sm text-slate-600">
                        {currentReview.rawExtractedText}
                      </p>
                    </details>
                  )}
                  {currentReview.diagramUrl && (
                    <figure className="mt-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentReview.diagramUrl}
                        alt="Question diagram"
                        className="max-w-full rounded border border-slate-200"
                      />
                      <figcaption className="mt-1 text-xs text-slate-500">
                        Question diagram
                      </figcaption>
                    </figure>
                  )}
                  <div aria-live="polite">
                    {reviewNotice && (
                      <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
                        {reviewNotice}
                      </p>
                    )}
                  </div>
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
                      className={primaryButtonClass}
                    >
                      Approve & Next
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleReviewAction("save")}
                      className={secondaryButtonClass}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => handleReviewAction("reject")}
                      className={dangerButtonClass}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => setDiagramFor("review")}
                      className={secondaryButtonClass}
                    >
                      Edit diagram
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={mutating || (reviewIndex === 0 && page === 1)}
                      onClick={() => {
                        setReviewNotice(null);
                        if (reviewIndex > 0) setReviewIndex(reviewIndex - 1);
                        else if (page > 1) setPage(page - 1);
                      }}
                      className={secondaryButtonClass}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        mutating ||
                        (reviewIndex >= questions.length - 1 && page >= totalPages)
                      }
                      onClick={() => {
                        setReviewNotice(null);
                        if (reviewIndex < questions.length - 1) {
                          setReviewIndex(reviewIndex + 1);
                        } else if (page < totalPages) {
                          setPage(page + 1);
                        }
                      }}
                      className={secondaryButtonClass}
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
          <>
            <section className={`${cardClass} mb-6`}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-900">
                Filters
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        Class {grade}
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
                <div className="sm:col-span-2">
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
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={resetFilters}
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setAddOpen(true)}
                >
                  Add question
                </button>
              </div>
            </section>

            <section
              role="tabpanel"
              id="panel-bank"
              aria-labelledby="tab-bank"
              className={cardClass}
            >
              <div className="sticky top-[112px] z-30 mb-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      {selectionSummary.total} selected · {selectionSummary.marks}{" "}
                      marks
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
                      className={secondaryButtonClass}
                    >
                      Clear selection
                    </button>
                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={openBuilder}
                      className={primaryButtonClass}
                    >
                      Prepare Paper
                    </button>
                  </div>
                </div>
                {(selectionNotice || !selectionConflict.ok) && selectedCount > 0 && (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    A question paper can contain questions from only one class and
                    subject.
                    {!selectionConflict.ok && selectionConflict.error
                      ? ` ${selectionConflict.error}.`
                      : ""}
                  </p>
                )}
              </div>
              <p className="mb-4 text-sm text-slate-600">{total} approved questions</p>
              {loading ? (
                <p role="status" className="text-sm text-slate-600">
                  Loading questions…
                </p>
              ) : questions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-slate-700">
                    No approved questions match these filters.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Approve questions from the Review tab, or adjust the filters
                    above.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {questions.map((question) => (
                    <li
                      key={question.id}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={`select-${question.id}`}
                          type="checkbox"
                          aria-label="Select this question for the paper"
                          checked={selectedIds.has(question.id)}
                          onChange={() => toggleSelected(question)}
                          className="mt-1.5 h-5 w-5 rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-3 break-words text-slate-900">
                            {renderQuestionText(question.questionText)}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-800">
                              {questionTypeLabel(question.questionType)}
                            </span>
                            <span>
                              {question.marks} mark{question.marks === 1 ? "" : "s"}
                            </span>
                            {question.diagramUrl && (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                                Diagram
                              </span>
                            )}
                            {question.sourceDisplayName && (
                              <span className="break-words font-medium text-slate-800">
                                {question.sourceDisplayName}
                              </span>
                            )}
                            {question.sourcePageNumber != null && (
                              <span>Page {question.sourcePageNumber}</span>
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
                          className={secondaryButtonClass}
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
                          className={secondaryButtonClass}
                          onClick={() => handleArchive(question)}
                        >
                          Archive
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </section>
          </>
        )}

        {view === "sources" && (
          <div
            role="tabpanel"
            id="panel-sources"
            aria-labelledby="tab-sources"
          >
            <section className={`${cardClass} mb-6`}>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                Upload a source PDF
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                Questions are extracted from the PDF and placed in the review
                queue.
              </p>
              <div className="mb-4">
                <label htmlFor="upload-paper-name" className={labelClass}>
                  Paper name <span className="text-red-600">*</span>
                </label>
                <input
                  id="upload-paper-name"
                  value={uploadForm.displayName}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  disabled={uploading}
                  onChange={(event) =>
                    setUploadForm({ ...uploadForm, displayName: event.target.value })
                  }
                  className={inputClass}
                  aria-describedby="upload-paper-name-help"
                />
                <p id="upload-paper-name-help" className="mt-1 text-xs text-slate-500">
                  Give this source paper a recognizable name so you can find its
                  questions later. It appears in the Question Bank&apos;s Source
                  Paper filter and is not the title of a generated question paper.
                </p>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="upload-grade" className={labelClass}>
                    Class <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="upload-grade"
                    value={uploadForm.grade}
                    disabled={uploading}
                    onChange={(event) =>
                      setUploadForm({
                        ...uploadForm,
                        grade: event.target.value,
                        subject: "",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Select class</option>
                    {ALL_GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        Class {grade}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="upload-subject" className={labelClass}>
                    Subject <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="upload-subject"
                    value={uploadForm.subject}
                    disabled={!uploadForm.grade || uploading}
                    onChange={(event) =>
                      setUploadForm({ ...uploadForm, subject: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select subject</option>
                    {uploadForm.grade &&
                      getSubjectsForGrade(parseInt(uploadForm.grade, 10)).map(
                        (subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ),
                      )}
                  </select>
                </div>
                <div>
                  <label htmlFor="upload-year" className={labelClass}>
                    Academic year <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="upload-year"
                    value={uploadForm.year}
                    disabled={uploading}
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
                  PDF file <span className="text-red-600">*</span>
                </label>
                <label className="block cursor-pointer">
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && file.type === "application/pdf") {
                        const suggestion = suggestPaperNameFromFilename(file.name);
                        setUploadForm((current) => ({
                          ...current,
                          file,
                          displayName:
                            current.displayName.trim() === "" ||
                            current.displayName === lastNameSuggestionRef.current
                              ? suggestion
                              : current.displayName,
                        }));
                        lastNameSuggestionRef.current = suggestion;
                      } else if (file) {
                        setUploadNotice({
                          kind: "failed",
                          text: "Please select a PDF file.",
                          sourceId: null,
                        });
                      }
                    }}
                  />
                  <span className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 hover:border-[#1e3a8a] hover:bg-blue-50/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1e3a8a]">
                    <span className="break-words text-center text-sm font-medium text-slate-900">
                      {uploadForm.file
                        ? uploadForm.file.name
                        : "Choose a PDF to upload"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {uploadForm.file
                        ? "Choose a different file to replace it"
                        : "PDF files only"}
                    </span>
                  </span>
                </label>
              </div>
              <div aria-live="polite">
                {uploading && uploadStage && (
                  <p className="mb-3 text-sm text-slate-700" role="status">
                    {uploadStageText(uploadStage)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className={`${primaryButtonClass} w-full`}
              >
                {uploading ? "Working…" : "Upload and Extract Questions"}
              </button>
            </section>

            <section className={cardClass}>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Uploaded source papers
              </h2>
              {loading ? (
                <p role="status" className="text-sm text-slate-600">
                  Loading sources…
                </p>
              ) : sources.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-slate-700">No uploaded PDFs yet.</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Upload a source PDF above to extract questions.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {sources.map((source) => (
                    <li
                      key={source.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-900">
                            {source.displayName || source.filename}
                          </p>
                          <p className="break-words text-xs text-slate-500">
                            File: {source.filename}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Class {source.grade} · {source.subject} ·{" "}
                            {source.academicYear}
                          </p>
                          <p className="text-sm text-slate-600">
                            {source.processedPageCount} of {source.pageCount} pages
                            extracted · {source.savedQuestionCount} question
                            {source.savedQuestionCount === 1 ? "" : "s"} saved
                          </p>
                          {source.failedPages.length > 0 && (
                            <p className="text-sm text-amber-800">
                              Failed page
                              {source.failedPages.length === 1 ? "" : "s"}:{" "}
                              {source.failedPages.join(", ")}. Successful questions
                              remain available.
                            </p>
                          )}
                          {source.possiblyInterrupted && (
                            <p className="text-sm text-slate-700">
                              This upload may have been interrupted. It will not
                              retry on its own.
                            </p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            Uploaded {new Date(source.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(source.status)}`}
                        >
                          {source.statusLabel}
                        </span>
                      </div>
                      {renamingSourceId === source.id && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <label htmlFor={`rename-${source.id}`} className={labelClass}>
                            Paper name
                          </label>
                          <input
                            id={`rename-${source.id}`}
                            value={renameValue}
                            maxLength={MAX_DISPLAY_NAME_LENGTH}
                            disabled={mutating}
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
                              className={primaryButtonClass}
                              onClick={() => handleRenameSource(source.id)}
                            >
                              Save name
                            </button>
                            <button
                              type="button"
                              disabled={mutating}
                              className={secondaryButtonClass}
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
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        <SourcePdfLink sourceId={source.id} />
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            setSourceFilter(source.id);
                            selectView("review");
                            setPage(1);
                          }}
                        >
                          Review questions
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            setRenamingSourceId(source.id);
                            setRenameValue(source.displayName || "");
                            setRenameError(null);
                          }}
                        >
                          Rename
                        </button>
                        {shouldRenderRetryButton(source, {
                          retryingSourceId,
                          lockedSourceIds: retryLockedIds,
                        }) && (
                          <button
                            type="button"
                            disabled={retryingSourceId !== null}
                            className={secondaryButtonClass}
                            onClick={() => handleRetryExtraction(source.id)}
                          >
                            Retry Extraction
                          </button>
                        )}
                        {shouldRenderFailedPageRetryButton(source, {
                          retryingSourceId,
                          lockedSourceIds: retryLockedIds,
                        }) && (
                          <div>
                            <button
                              type="button"
                              disabled={retryingSourceId !== null}
                              className={secondaryButtonClass}
                              onClick={() =>
                                handleRetryFailedPages(source.id, source.failedPages)
                              }
                            >
                              {failedPageRetryLabel(source.failedPages)}
                            </button>
                            <p className="mt-1 text-xs text-slate-500">
                              Only failed pages are rescanned. Previously saved
                              questions are kept.
                            </p>
                          </div>
                        )}
                        <div aria-live="polite">
                          {retryingSourceId === source.id && (
                            <p className="text-sm text-slate-600" role="status">
                              {retryingFailedPages.length > 0
                                ? failedPageRetryingLabel(retryingFailedPages)
                                : "Retrying extraction…"}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </section>
          </div>
        )}

        {view === "saved" && (
          <section
            role="tabpanel"
            id="panel-saved"
            aria-labelledby="tab-saved"
            className={cardClass}
          >
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="saved-status" className={labelClass}>
                  Status
                </label>
                <select
                  id="saved-status"
                  value={savedStatusFilter}
                  onChange={(event) => {
                    setSavedStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">All</option>
                  <option value="draft">Draft</option>
                  <option value="final">Ready / PDF pending</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label htmlFor="saved-grade" className={labelClass}>
                  Class
                </label>
                <select
                  id="saved-grade"
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
                      Class {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="saved-subject" className={labelClass}>
                  Subject
                </label>
                <select
                  id="saved-subject"
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
                <label htmlFor="saved-year" className={labelClass}>
                  Academic year
                </label>
                <select
                  id="saved-year"
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
              <div>
                <label htmlFor="saved-search" className={labelClass}>
                  Paper name
                </label>
                <input
                  id="saved-search"
                  value={searchInput}
                  maxLength={200}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className={inputClass}
                  placeholder="Search paper names"
                />
              </div>
            </div>
            <div aria-live="polite">
              {savedSuccess && (
                <p
                  className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                  role="status"
                >
                  {savedSuccess}
                </p>
              )}
              {savedNotice && (
                <p
                  className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  role="status"
                >
                  The paper was saved. You can retry the PDF from this list.
                </p>
              )}
            </div>
            {loading ? (
              <p role="status" className="text-sm text-slate-600">
                Loading saved papers…
              </p>
            ) : savedPapers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-700">
                  No saved papers yet. Select approved questions from the Question
                  Bank to prepare one.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {savedPapers.map((paper) => (
                  <li
                    key={paper.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900">
                          {paper.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Class {paper.grade} · {paper.subject} · {paper.academicYear}
                          {paper.durationMinutes
                            ? ` · ${formatDuration(paper.durationMinutes)}`
                            : ""}
                          {` · ${paper.totalMarks} marks`}
                          {paper.itemCount != null
                            ? ` · ${paper.itemCount} question${paper.itemCount === 1 ? "" : "s"}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {paper.status === "draft"
                            ? paper.updatedAt
                              ? `Updated ${new Date(paper.updatedAt).toLocaleString()}`
                              : "Draft"
                            : paper.finalizedAt
                              ? `Finalized ${new Date(paper.finalizedAt).toLocaleString()}`
                              : paper.createdAt
                                ? `Created ${new Date(paper.createdAt).toLocaleString()}`
                                : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${paperStatusBadgeClass(paper.pdfStatus)}`}
                      >
                        {paper.pdfStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paper.editable ? (
                        <button
                          type="button"
                          disabled={mutating}
                          className={primaryButtonClass}
                          onClick={() => openComposition(paper, "continue")}
                        >
                          Continue editing
                        </button>
                      ) : null}
                      {paper.pdfAvailable ? (
                        <button
                          type="button"
                          className={primaryButtonClass}
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
                          Download PDF
                        </button>
                      ) : paper.status === "final" ? (
                        <button
                          type="button"
                          disabled={mutating}
                          className={secondaryButtonClass}
                          onClick={() => handleRetryPdf(paper.id)}
                        >
                          Retry PDF
                        </button>
                      ) : null}
                      {!paper.editable && (
                        <button
                          type="button"
                          disabled={mutating}
                          className={secondaryButtonClass}
                          onClick={() => openComposition(paper, "template")}
                        >
                          Use as template
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </section>
        )}
      </div>

      {builderOpen && (
        <Modal
          title={builderPaperId ? "Continue draft" : "Paper builder"}
          titleId="paper-builder-title"
          onClose={() => {
            if (generateStage || savingDraft) return;
            if (
              builderDirty &&
              !window.confirm(
                "This composition has unsaved changes. Close it anyway?",
              )
            ) {
              return;
            }
            setBuilderOpen(false);
          }}
        >
          {!selectionConflict.ok && (
            <p className="mb-4 text-sm text-red-700" role="alert">
              {selectionConflict.error}. Remove the conflicting questions to continue.
            </p>
          )}
          {templateWarning && (
            <p
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              role="alert"
            >
              {templateWarning} Add replacements from the Question Bank before
              generating.
            </p>
          )}
          <p className="mb-1 text-sm text-slate-700">
            {builderOrder.length} question{builderOrder.length === 1 ? "" : "s"} ·{" "}
            {previewMarks(selectedQuestions)} marks
            {selectionConflict.ok && selectionConflict.grade
              ? ` · Class ${romanClass(selectionConflict.grade)} ${selectionConflict.subject || ""}`
              : ""}
          </p>
          <p className="mb-4 text-sm text-slate-600">
            Questions are grouped by type. Source paper names are for finding
            questions and are not printed on the generated paper.
          </p>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="builder-title" className={labelClass}>
                Question paper name <span className="text-red-600">*</span>
              </label>
              <input
                id="builder-title"
                value={builderTitle}
                disabled={Boolean(generateStage) || savingDraft}
                onChange={(event) => {
                  setBuilderTitle(event.target.value);
                  setBuilderDirty(true);
                }}
                className={inputClass}
                maxLength={300}
                aria-describedby="builder-title-help"
              />
              <p id="builder-title-help" className="mt-1 text-xs text-slate-500">
                This name identifies the prepared paper and will appear on the
                generated PDF.
              </p>
              {duplicateNameWarning && (
                <p className="mt-1 text-xs text-amber-800" role="status">
                  {duplicateNameWarning}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="builder-year" className={labelClass}>
                Academic year
              </label>
              <select
                id="builder-year"
                value={builderYear}
                disabled={Boolean(generateStage)}
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
                disabled={Boolean(generateStage)}
                onChange={(event) => setBuilderDuration(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mb-4 space-y-4">
            {builderSections.map((section, sectionIndex) => (
              <section
                key={section.key}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {section.title || `Section ${sectionIndex + 1}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={sectionIndex === 0 || Boolean(generateStage)}
                      onClick={() => moveBuilderSection(sectionIndex, -1)}
                      className={secondaryButtonClass}
                    >
                      Move section up
                    </button>
                    <button
                      type="button"
                      disabled={
                        sectionIndex === builderSections.length - 1 ||
                        Boolean(generateStage)
                      }
                      onClick={() => moveBuilderSection(sectionIndex, 1)}
                      className={secondaryButtonClass}
                    >
                      Move section down
                    </button>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-3">
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
                      disabled={Boolean(generateStage)}
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
                      disabled={Boolean(generateStage)}
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
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <p className="text-sm font-medium text-slate-700">
                          {index + 1}. {questionTypeLabel(question.questionType)} ·{" "}
                          {question.marks} mark{question.marks === 1 ? "" : "s"}
                          {question.diagramUrl ? " · Has diagram" : ""}
                        </p>
                        <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                          {question.questionText}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={index === 0 || Boolean(generateStage)}
                            onClick={() => moveBuilderItem(section.key, index, -1)}
                            className={secondaryButtonClass}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === section.questionIds.length - 1 ||
                              Boolean(generateStage)
                            }
                            onClick={() => moveBuilderItem(section.key, index, 1)}
                            className={secondaryButtonClass}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(generateStage)}
                            onClick={() => removeBuilderItem(question.id)}
                            className={dangerButtonClass}
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
          <div aria-live="polite">
            {generateStage && (
              <p className="mb-3 text-sm text-slate-700" role="status">
                {generateStage}…
              </p>
            )}
            {savingDraft && !generateStage && (
              <p className="mb-3 text-sm text-slate-700" role="status">
                Saving draft…
              </p>
            )}
            {draftNotice && !savingDraft && !generateStage && (
              <p className="mb-3 text-sm font-medium text-emerald-800" role="status">
                {draftNotice}
              </p>
            )}
            {builderDirty && !savingDraft && !generateStage && (
              <p className="mb-3 text-sm text-amber-800" role="status">
                Unsaved changes
              </p>
            )}
          </div>
          {builderError && (
            <div className="mb-3 text-sm text-red-700" role="alert">
              <p>{builderError}</p>
              {savedNotice && (
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="font-medium text-[#1e3a8a] underline underline-offset-2"
                    onClick={() => {
                      setBuilderOpen(false);
                      selectView("saved");
                      setPage(1);
                    }}
                  >
                    Open Saved Papers
                  </button>
                  <button
                    type="button"
                    className="font-medium text-[#1e3a8a] underline underline-offset-2"
                    disabled={mutating}
                    onClick={() => handleRetryPdf(savedNotice)}
                  >
                    Retry PDF
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                Boolean(generateStage) ||
                savingDraft ||
                !selectionConflict.ok ||
                builderOrder.length === 0 ||
                !builderTitle.trim()
              }
              onClick={handleGeneratePaper}
              className={primaryButtonClass}
            >
              Generate final paper
            </button>
            <button
              type="button"
              disabled={
                Boolean(generateStage) ||
                savingDraft ||
                !selectionConflict.ok ||
                builderOrder.length === 0 ||
                !builderTitle.trim()
              }
              onClick={handleSaveDraft}
              className={secondaryButtonClass}
            >
              Save draft
            </button>
          </div>
        </Modal>
      )}

      {addOpen && (
        <Modal
          title="Add question"
          titleId="add-question-title"
          onClose={() => !mutating && setAddOpen(false)}
        >
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="add-grade" className={labelClass}>
                Class
              </label>
              <select
                id="add-grade"
                value={addMeta.grade}
                disabled={mutating}
                onChange={(event) =>
                  setAddMeta({ ...addMeta, grade: event.target.value, subject: "" })
                }
                className={inputClass}
              >
                <option value="">Select class</option>
                {ALL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    Class {grade}
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
                disabled={!addMeta.grade || mutating}
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
                Academic year
              </label>
              <select
                id="add-year"
                value={addMeta.year}
                disabled={mutating}
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
              className={secondaryButtonClass}
            >
              Save for review
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => handleAddQuestion("approve")}
              className={primaryButtonClass}
            >
              Save and approve
            </button>
          </div>
        </Modal>
      )}

      {editQuestion && (
        <Modal
          title="Edit question"
          titleId="edit-question-title"
          onClose={() => !mutating && setEditQuestion(null)}
        >
          <QuestionEditor
            idPrefix="edit"
            draft={editDraft}
            onChange={setEditDraft}
            disabled={mutating}
            onMath={() => setMathField("edit")}
          />
          {editQuestion.diagramUrl && (
            <figure className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editQuestion.diagramUrl}
                alt="Question diagram"
                className="max-w-full rounded border border-slate-200"
              />
              <figcaption className="mt-1 text-xs text-slate-500">
                Question diagram
              </figcaption>
            </figure>
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
              className={primaryButtonClass}
            >
              Save
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => setDiagramFor("edit")}
              className={secondaryButtonClass}
            >
              Edit diagram
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => setEditQuestion(null)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {diagramFor && (
        <Modal
          title="Edit diagram"
          titleId="edit-diagram-title"
          onClose={() => setDiagramFor(null)}
        >
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3">
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
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={`${idPrefix}-text`} className={labelClass}>
            Question text
          </label>
          <button
            type="button"
            className="mb-1.5 text-sm font-medium text-[#1e3a8a] underline underline-offset-2"
            onClick={onMath}
          >
            Math symbols
          </button>
        </div>
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
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Options
          </legend>
          <div className="space-y-2">
            {draft.options.map((option, index) => (
              <div
                key={`${idPrefix}-option-${index}`}
                className="flex items-center gap-3"
              >
                <label
                  htmlFor={`${idPrefix}-option-${index}`}
                  className="w-6 shrink-0 text-sm font-medium text-slate-700"
                >
                  {String.fromCharCode(65 + index)}
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
                />
              </div>
            ))}
          </div>
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
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center gap-3"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={secondaryButtonClass}
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
        className={secondaryButtonClass}
      >
        Next page
      </button>
    </nav>
  );
}

function Modal({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const root = containerRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 pb-8 pt-24 sm:pt-28">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold text-slate-900">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a]"
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
        className={secondaryButtonClass}
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
