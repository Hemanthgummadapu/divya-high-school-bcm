"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QuestionPaper, Question } from "@/lib/questionPapers";
import { ALL_GRADES, ALL_YEARS, getSubjectsForGrade } from "@/lib/subjects";
import jsPDF from "jspdf";
import MathKeyboard from "@/components/MathKeyboard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Statistics {
  totalPapers: number;
  totalQuestions: number;
  bySubject: Record<string, number>;
  byType: Record<string, number>;
}

export default function QuestionPapers() {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [generatedPaper, setGeneratedPaper] = useState<any>(null);
  const [addQuestionModalOpen, setAddQuestionModalOpen] = useState(false);
  const [addQuestionForm, setAddQuestionForm] = useState<{
    paperId: string;
    text: string;
    type: "MCQ" | "Short" | "Long";
    options: string[];
    marks: number;
    correctAnswer: string;
  }>({
    paperId: "",
    text: "",
    type: "MCQ",
    options: ["", "", "", ""],
    marks: 1,
    correctAnswer: "",
  });
  const [activeSectionTab, setActiveSectionTab] = useState<string>("All");
  const [editPreviewMode, setEditPreviewMode] = useState(false);
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);
  const [editableSections, setEditableSections] = useState<Record<string, string>>({});
  const [paperMetadata, setPaperMetadata] = useState<{ subject: string; grade: string; year: string } | null>(null);
  const [headerFields, setHeaderFields] = useState({
    schoolName: "Divya High School",
    location: "Bhadrachalam",
    examTitle: "PRE-FINAL EXAMINATIONS, FEBRUARY - 2026",
    subject: "MATHEMATICS (English Version)",
    class: "X",
    maxMarks: "80",
    time: "3.00 Hrs",
    date: "",
  });
  
  // Filters
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    year: "",
    type: "",
    section: "",
  });
  
  // Upload form: default year to current year
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    subject: "",
    grade: "",
    year: String(new Date().getFullYear()),
  });
  
  // Math symbol keyboard (Edit & Preview modal)
  const [mathKeyboardVisible, setMathKeyboardVisible] = useState(false);
  const [mathActiveField, setMathActiveField] = useState<{
    questionIndex: number;
    field: "text" | "option";
    optionIndex?: number;
  } | null>(null);
  const [mathSelection, setMathSelection] = useState({ start: 0, end: 0 });
  const mathActiveInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [pdfGenLogs, setPdfGenLogs] = useState<string[]>([]);
  const generatedPaperRef = useRef<HTMLDivElement | null>(null);
  
  // Render question text with basic table detection
  const renderQuestionText = (text: string) => {
    return (
      <div className="prose prose-sm max-w-none font-sans">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node, ...props }) => (
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  margin: "6px 0",
                }}
                {...props}
              />
            ),
            th: ({ node, ...props }) => (
              <th
                style={{
                  border: "1px solid #d1d5db",
                  padding: "4px 8px",
                  background: "#f9fafb",
                }}
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                style={{
                  border: "1px solid #d1d5db",
                  padding: "4px 8px",
                }}
                {...props}
              />
            ),
          }}
        >
          {text || ""}
        </ReactMarkdown>
      </div>
    );
  };
  
  // Get filter options: grade/subject from subjects.ts, years from ALL_YEARS
  const filterGrades = ALL_GRADES.map(String);
  const filterSubjects = filters.grade
    ? getSubjectsForGrade(parseInt(filters.grade, 10))
    : [];
  const years = ALL_YEARS.map(String).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  
  // Get unique sections for tabs
  const sections = Array.from(new Set(allQuestions.map((q) => q.section))).sort();
  
  // Fetch papers
  const fetchPapers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.grade) params.append("grade", filters.grade);
      if (filters.year) params.append("year", filters.year);
      if (filters.type) params.append("type", filters.type);
      if (filters.section) params.append("section", filters.section);
      
      const response = await fetch(`/api/question-papers?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPapers(data.papers);
        setStatistics(data.statistics);
        
        // Flatten all questions
        const questions: Question[] = [];
        data.papers.forEach((paper: QuestionPaper) => {
          paper.questions.forEach((q) => {
            questions.push({ ...q, paperId: paper.id } as any);
          });
        });
        setAllQuestions(questions);
      }
    } catch (error) {
      console.error("Error fetching papers:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);
  
  useEffect(() => {
    if (!editPreviewMode) setMathKeyboardVisible(false);
  }, [editPreviewMode]);
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadForm({ ...uploadForm, file });
    } else {
      alert("Please select a PDF file");
    }
  };
  
  // Handle upload
  const handleUpload = async () => {
    const gradeNum = uploadForm.grade ? parseInt(uploadForm.grade, 10) : 0;
    if (!uploadForm.file || !uploadForm.subject || !uploadForm.grade || !uploadForm.year) {
      alert("Please fill all fields and select a PDF file");
      return;
    }
    if (!gradeNum || gradeNum < 1 || gradeNum > 10) {
      alert("Please select a valid grade (1–10)");
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadSuccessMessage(null);
      
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("subject", uploadForm.subject);
      formData.append("grade", uploadForm.grade);
      formData.append("year", uploadForm.year);
      
      // Simulate progress (actual progress would come from server)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 99) {
            clearInterval(progressInterval);
            return 99;
          }
          return prev + 3;
        });
      }, 500);
      
      const response = await fetch("/api/question-papers", {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(99);
      await new Promise((r) => setTimeout(r, 5000));
      setUploadProgress(100);
      
      const data = await response.json();
      
      if (data.success) {
        setUploadSuccessMessage(`Successfully uploaded! Extracted ${data.paper.questions.length} questions.`);
        if (data.duplicatesSkipped > 0) {
          alert(`Warning: ${data.duplicatesSkipped} duplicate question(s) skipped.`);
        }
        setUploadForm({ file: null, subject: "", grade: "", year: "" });
        fetchPapers();
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  // Toggle question selection
  const toggleQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };
  
  // Select all questions
  const selectAll = () => {
    if (selectedQuestions.size === allQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(allQuestions.map((q) => q.id)));
    }
  };

  const openAddQuestionModal = () => {
    let defaultPaperId = "";
    if (selectedQuestions.size > 0) {
      const firstSelectedId = Array.from(selectedQuestions)[0];
      const firstQuestion = allQuestions.find((q: any) => q.id === firstSelectedId) as any;
      if (firstQuestion && firstQuestion.paperId) {
        defaultPaperId = firstQuestion.paperId;
      }
    }
    if (!defaultPaperId && papers.length > 0) {
      defaultPaperId = papers[0].id;
    }
    setAddQuestionForm((prev) => ({
      ...prev,
      paperId: defaultPaperId,
    }));
    setAddQuestionModalOpen(true);
  };

  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { paperId, text, type, options, marks, correctAnswer } = addQuestionForm;
    if (!paperId || !text.trim()) {
      alert("Please select a paper and enter question text");
      return;
    }
    try {
      const payload: any = {
        text: text.trim(),
        type,
        marks: Number(marks) || 1,
        options: type === "MCQ" ? options.map((o) => o.trim()).filter((o) => o.length > 0) : [],
        correctAnswer: correctAnswer.trim() || null,
      };
      const res = await fetch(`/api/question-papers/${paperId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed to add question: ${data.error}`);
        return;
      }
      setAddQuestionModalOpen(false);
      setAddQuestionForm({
        paperId: "",
        text: "",
        type: "MCQ",
        options: ["", "", "", ""],
        marks: 1,
        correctAnswer: "",
      });
      fetchPapers();
    } catch (error: any) {
      alert(`Error adding question: ${error.message}`);
    }
  };
  
  // Generate paper
  const handleGeneratePaper = async () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question");
      return;
    }
    
    // Build a simple preview paper on the client from selected questions
    const selected = allQuestions.filter((q) => selectedQuestions.has(q.id));
    if (selected.length === 0) {
      alert("No questions found for preview");
      return;
    }

    const totalMarks = selected.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const bySection: Record<string, Question[]> = {};
    const sectionCounters: Record<string, number> = {};
    selected.forEach((q: any) => {
      const section = q.section || "General";
      if (!bySection[section]) bySection[section] = [];
      sectionCounters[section] = (sectionCounters[section] || 0) + 1;
      bySection[section].push({ ...q, number: sectionCounters[section] });
    });

    setGeneratedPaper({
      totalQuestions: selected.length,
      totalMarks,
      bySection,
    });
  };
  
  // Download all questions as JSON
  const handleDownloadAllJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      totalQuestions: allQuestions.length,
      questions: allQuestions,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `question-bank-all-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Download selected questions as JSON
  const handleDownloadSelectedJSON = () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question");
      return;
    }
    
    const selected = allQuestions.filter((q) => selectedQuestions.has(q.id));
    const data = {
      exportDate: new Date().toISOString(),
      totalQuestions: selected.length,
      questions: selected,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `question-bank-selected-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Export as CSV
  const handleExportCSV = () => {
    const questionsToExport = selectedQuestions.size > 0
      ? allQuestions.filter((q) => selectedQuestions.has(q.id))
      : allQuestions;
    
    if (questionsToExport.length === 0) {
      alert("No questions to export");
      return;
    }
    
    // CSV header
    const headers = ["Question No", "Section", "Type", "Marks", "Question Text"];
    const rows = questionsToExport.map((q) => {
      // Escape quotes and wrap in quotes if contains comma or newline
      const escapeCSV = (text: string) => {
        if (text.includes(",") || text.includes('"') || text.includes("\n")) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };
      
      return [
        q.number,
        q.section,
        q.type,
        q.marks.toString(),
        escapeCSV(q.text),
      ].join(",");
    });
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `question-bank-${selectedQuestions.size > 0 ? "selected" : "all"}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Open edit preview mode
  const handleOpenEditPreview = () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question");
      return;
    }
    
    // Get selected questions
    const selected = allQuestions.filter((q) => selectedQuestions.has(q.id));
    
    // Get subject, grade, year from the first question's paper
    const selectedQuestionIds = Array.from(selectedQuestions);
    const firstSelectedQuestion = allQuestions.find(q => selectedQuestionIds.includes(q.id));
    const paperInfo = firstSelectedQuestion ? papers.find(p => p.id === (firstSelectedQuestion as any).paperId) : null;
    
    // Create editable copy of questions
    const editable = selected.map(q => ({ ...q }));
    
    // Group by section and create section name mapping
    const sectionsMap: Record<string, string> = {};
    selected.forEach(q => {
      if (!sectionsMap[q.section]) {
        sectionsMap[q.section] = q.section;
      }
    });
    
    setEditableQuestions(editable);
    setEditableSections(sectionsMap);
    setPaperMetadata({
      subject: paperInfo?.subject || "N/A",
      grade: paperInfo?.grade || "N/A",
      year: paperInfo?.year || "N/A",
    });
    const totalFromQuestions = selected.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    setHeaderFields({
      schoolName: "Divya High School BCM",
      location: "Bhadrachalam",
      examTitle: paperInfo ? `${paperInfo.subject} - ${paperInfo.year} EXAMINATIONS` : "PRE-FINAL EXAMINATIONS, FEBRUARY - 2026",
      subject: paperInfo?.subject ?? "MATHEMATICS (English Version)",
      class: paperInfo?.grade ?? "X",
      maxMarks: String(totalFromQuestions || 80),
      time: "3.00 Hrs",
      date: "",
    });
    setEditPreviewMode(true);
  };
  
  // Clean text by replacing special characters with plain text equivalents
  const cleanText = (text: string): string => {
    return text
      .replace(/θ/g, 'theta')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√/g, 'sqrt')
      .replace(/₁/g, '1')
      .replace(/₂/g, '2')
      .replace(/₁₀/g, '10')
      .replace(/°/g, ' degrees')
      .replace(/∠/g, 'angle')
      .replace(/△/g, 'triangle')
      .replace(/∑/g, 'sum')
      .replace(/π/g, 'pi')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/∞/g, 'infinity');
  };

  const formatMathForPdf = (text: string): string => {
    return (text || "")
      .replace(/\bsqrt\b/g, "√")
      .replace(/\^2/g, "²")
      .replace(/\^3/g, "³")
      .replace(/\btheta\b/g, "θ")
      .replace(/\bdegrees\b/g, "°")
      .replace(/\s+°/g, "°")
      .replace(/\btriangle\b/g, "△")
      .replace(/\bangle\b/g, "∠");
  };
  
  // Generate PDF from edited questions (via API with reportlab, fallback to jsPDF)
  const handleDownloadPDFFromPreview = async () => {
    if (!paperMetadata) return;
    
    const payload = {
      questions: editableQuestions.map((q) => ({
        id: q.id,
        number: q.number,
        text: q.text,
        options: q.options || [],
        section: q.section,
        type: q.type,
        marks: Math.max(1, Number(q.marks) || 1),
      })),
      header: headerFields,
    };
    
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: payload.questions,
          header: { ...payload.header, examCode: "JK-82" },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Question_Paper_${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setPdfGenLogs([]);
        setEditPreviewMode(false);
        return;
      }
    } catch (e) {
      console.warn("API PDF failed, using jsPDF fallback", e);
    }
    
    // Fallback: jsPDF in-browser
    const totalMarks = editableQuestions.reduce((sum, q) => sum + q.marks, 0);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2 - 10;
    const numberColWidth = 12;
    let y = 20;
    const maxY = 270;
    
    doc.setFont('helvetica');
    
    const checkPageBreak = (requiredSpace: number) => {
      if (y + requiredSpace > maxY) {
        doc.addPage();
        y = 20;
      }
    };
    
    doc.setFontSize(18).setFont('helvetica', 'bold');
    doc.text(headerFields.schoolName, pageWidth / 2, y, { align: 'center' });
    y += 7;
    
    doc.setFontSize(14).setFont('helvetica', 'normal');
    doc.text(headerFields.location, pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(12).setFont('helvetica', 'bold');
    doc.text(headerFields.examTitle, pageWidth / 2, y, { align: 'center' });
    y += 7;
    
    doc.setFontSize(11).setFont('helvetica', 'normal');
    doc.text(headerFields.subject, pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    const classTimeText = `Class: ${headerFields.class} | Max. Marks: ${headerFields.maxMarks} | Time: ${headerFields.time}`;
    doc.text(classTimeText, pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    if (headerFields.date) {
      doc.text(`Date: ${headerFields.date}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
    }
    
    doc.text(`Total Questions: ${editableQuestions.length} | Total Marks: ${totalMarks}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    const questionsBySection: Record<string, Question[]> = {};
    editableQuestions.forEach((q) => {
      const sectionName = editableSections[q.section] || q.section;
      if (!questionsBySection[sectionName]) {
        questionsBySection[sectionName] = [];
      }
      questionsBySection[sectionName].push(q);
    });
    
    const fixedOrder = ['SECTION-I', 'SECTION-II', 'SECTION-III'];
    const allSections = Object.keys(questionsBySection);
    const mcqSections: string[] = [];
    const regularSections: string[] = [];
    
    allSections.forEach(section => {
      const upperSection = section.toUpperCase();
      if (upperSection.includes('PART-B') || upperSection.includes('SECTION-A') || upperSection.includes('OBJECTIVE')) {
        mcqSections.push(section);
      } else {
        regularSections.push(section);
      }
    });
    
    const orderedRegularSections: string[] = [];
    fixedOrder.forEach(orderSection => {
      const found = regularSections.find(s => s.toUpperCase().includes(orderSection));
      if (found) {
        orderedRegularSections.push(found);
      }
    });
    
    regularSections.forEach(section => {
      if (!orderedRegularSections.includes(section)) {
        orderedRegularSections.push(section);
      }
    });
    
    const sectionsWithQuestions = [...orderedRegularSections, ...mcqSections].filter(
      section => questionsBySection[section] && questionsBySection[section].length > 0
    );
    
    for (let i = 0; i < sectionsWithQuestions.length; i++) {
      const section = sectionsWithQuestions[i];
      const questions = questionsBySection[section];
      const upperSection = section.toUpperCase();
      const isMcqSection = upperSection.includes('PART-B') || upperSection.includes('SECTION-A') || upperSection.includes('OBJECTIVE');
      
      checkPageBreak(22);
      doc.setFontSize(12).setFont('helvetica', 'bold');
      doc.text(section, margin, y);
      y += 7;

      doc.setFontSize(10).setFont('helvetica', 'normal');
      doc.text(`Each question carries ${Math.max(1, Number((questions?.[0] as any)?.marks) || 1)} marks`, margin, y);
      y += 6;
      
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      let sectionQuestionNumber = 1;
      
      for (const q of questions) {
        checkPageBreak(20);
        doc.setFontSize(11).setFont('helvetica', 'normal');
        const questionNumberText = `Q${sectionQuestionNumber}.`;
        sectionQuestionNumber++;
        doc.text(questionNumberText, margin, y);
        
        checkPageBreak(15);
        const textStartX = margin + numberColWidth + 2;
        const textWidth = Math.max(20, (pageWidth - margin) - textStartX);
        const formattedQuestionText = formatMathForPdf(q.text);
        const lines = (q.text || "").split("\n");
        const isTableRow = (line: string) => (line.match(/\|/g) || []).length >= 3;
        const tableLines = lines.filter(isTableRow);
        const nonTableLines = lines.filter((l) => !isTableRow(l));

        if (tableLines.length === 0) {
          const questionLines = doc.splitTextToSize(formattedQuestionText, textWidth);
          doc.text(questionLines, textStartX, y);
          y += questionLines.length * 6 + 1;
        } else {
          if (nonTableLines.length > 0) {
            const nonTableText = formatMathForPdf(nonTableLines.join("\n"));
            const qLines = doc.splitTextToSize(nonTableText, textWidth);
            doc.text(qLines, textStartX, y);
            y += qLines.length * 6 + 2;
          }
          const colCount = Math.max(1, ...tableLines.map((line) => line.split("|").map((c) => c.trim()).filter((c) => c.length).length));
          const tableWidth = textWidth;
          const colWidth = tableWidth / colCount;
          const rowHeight = 7;
          const tableX = textStartX;
          doc.setFontSize(9);
          for (let rowIdx = 0; rowIdx < tableLines.length; rowIdx++) {
            checkPageBreak(rowHeight + 2);
            const rawCells = tableLines[rowIdx].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
            const cellY = y + rowHeight - 2;
            for (let colIdx = 0; colIdx < colCount; colIdx++) {
              const cellX = tableX + colIdx * colWidth;
              doc.rect(cellX, y, colWidth, rowHeight);
              const cellText = formatMathForPdf(rawCells[colIdx] || "");
              const cellLines = doc.splitTextToSize(cellText, Math.max(5, colWidth - 2));
              doc.text(cellLines, cellX + 1, cellY);
            }
            y += rowHeight;
          }
          doc.setFontSize(11);
          y += 2;
        }
        
        if (q.options && q.options.length > 0) {
          checkPageBreak(Math.ceil(q.options.length / 2) * 6 + 6);
          const optGap = 6;
          const optWidth = (textWidth - optGap) / 2;
          const leftX = textStartX;
          const rightX = textStartX + optWidth + optGap;
          
          for (let optIdx = 0; optIdx < q.options.length; optIdx += 2) {
            const leftLabel = `${String.fromCharCode(65 + optIdx)}) `;
            const leftOpt = `${leftLabel}${formatMathForPdf(q.options[optIdx])}`;
            const leftLines = doc.splitTextToSize(leftOpt, optWidth);
            doc.text(leftLines, leftX, y);
            const leftHeight = leftLines.length * 6;
            let rightHeight = 0;
            if (optIdx + 1 < q.options.length) {
              const rightLabel = `${String.fromCharCode(65 + optIdx + 1)}) `;
              const rightOpt = `${rightLabel}${formatMathForPdf(q.options[optIdx + 1])}`;
              const rightLines = doc.splitTextToSize(rightOpt, optWidth);
              doc.text(rightLines, rightX, y);
              rightHeight = rightLines.length * 6;
            }
            y += Math.max(leftHeight, rightHeight) + 2;
          }
          y += 3;
        }
        
        y += 3;
      }
      
      y += 5;
    }
    
    doc.save(`Question_Paper_${new Date().toISOString().split('T')[0]}.pdf`);
    setEditPreviewMode(false);
  };
  
  // Download as PDF using jsPDF (legacy - now opens preview)
  const handleDownloadPDF = async () => {
    handleOpenEditPreview();
  };
  
  // Helper functions for editing
  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQuestions = [...editableQuestions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    setEditableQuestions(newQuestions);
  };
  
  const moveQuestionDown = (index: number) => {
    if (index === editableQuestions.length - 1) return;
    const newQuestions = [...editableQuestions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    setEditableQuestions(newQuestions);
  };
  
  const deleteQuestion = (index: number) => {
    const newQuestions = editableQuestions.filter((_, i) => i !== index);
    setEditableQuestions(newQuestions);
  };
  
  const updateQuestionText = useCallback((index: number, text: string) => {
    setEditableQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, text } : q))
    );
  }, []);

  const updateOption = useCallback((questionIndex: number, optionIndex: number, value: string) => {
    setEditableQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = [...(q.options || [])];
        while (options.length <= optionIndex) options.push("");
        options[optionIndex] = value;
        return { ...q, options };
      })
    );
  }, []);

  const updateQuestionMarks = (index: number, marks: number) => {
    const v = Math.round(Number(marks));
    const value = (v >= 1 && v <= 10) ? v : (v === 0 || isNaN(v) ? 0 : Math.min(10, Math.max(1, v)));
    setEditableQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, marks: value } : q))
    );
  };

  const updateSectionName = (oldSection: string, newSection: string) => {
    const newSections = { ...editableSections };
    newSections[oldSection] = newSection;
    setEditableSections(newSections);
    
    // Update all questions with this section
    const newQuestions = editableQuestions.map(q => {
      if (q.section === oldSection) {
        return { ...q, section: newSection };
      }
      return q;
    });
    setEditableQuestions(newQuestions);
  };
  
  const handleMathSymbolInsert = useCallback((symbol: string) => {
    if (!mathActiveField) return;
    const { questionIndex, field, optionIndex } = mathActiveField;
    const { start, end } = mathSelection;
    if (field === "text") {
      const q = editableQuestions[questionIndex];
      if (!q) return;
      const val = q.text || "";
      const newVal = val.slice(0, start) + symbol + val.slice(end);
      updateQuestionText(questionIndex, newVal);
    } else if (field === "option" && optionIndex !== undefined) {
      const q = editableQuestions[questionIndex];
      if (!q) return;
      const opts = [...(q.options || [])];
      while (opts.length <= optionIndex) opts.push("");
      const val = opts[optionIndex] || "";
      const newVal = val.slice(0, start) + symbol + val.slice(end);
      updateOption(questionIndex, optionIndex, newVal);
    }
    const nextPos = start + symbol.length;
    setTimeout(() => {
      const el = mathActiveInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
        setMathSelection({ start: nextPos, end: nextPos });
      }
    }, 0);
  }, [mathActiveField, mathSelection, editableQuestions, updateOption, updateQuestionText]);
  
  // Delete paper
  const handleDeletePaper = async (paperId: string) => {
    if (!confirm("Are you sure you want to delete this paper?")) return;
    
    try {
      const response = await fetch(`/api/question-papers/${paperId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchPapers();
      } else {
        alert(`Delete failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Delete error: ${error.message}`);
    }
  };
  
  // Clear all questions
  const handleClearAll = async () => {
    const totalQuestions = allQuestions.length;
    if (!confirm(`Are you sure? This will delete all ${totalQuestions} questions.`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/question-papers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [] }), // Empty array means clear all
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully cleared all questions.`);
        setSelectedQuestions(new Set());
        fetchPapers();
      } else {
        alert(`Clear failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Clear error: ${error.message}`);
    }
  };
  
  // Delete selected questions
  const handleDeleteSelected = async () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question to delete");
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedQuestions.size} selected question(s)?`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/question-papers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQuestions),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully deleted ${data.deletedCount} question(s).`);
        setSelectedQuestions(new Set());
        fetchPapers();
      } else {
        alert(`Delete failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Delete error: ${error.message}`);
    }
  };
  
  // Filtered questions
  const filteredQuestions = allQuestions
    .filter((q) => {
      // Filter by active section tab
      if (activeSectionTab !== "All" && q.section !== activeSectionTab) return false;
      // Filter by type
      if (filters.type && q.type !== filters.type) return false;
      return true;
    })
    .sort((a, b) => {
      const order: Record<string, number> = {
        "SECTION-I": 0,
        "SECTION-II": 1,
        "SECTION-III": 2,
        "PART-B": 3,
      };
      const aSec = (a.section || "").toUpperCase();
      const bSec = (b.section || "").toUpperCase();
      const aOrder = order[aSec] ?? 99;
      const bOrder = order[bSec] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aNum = parseInt(String(a.number), 10);
      const bNum = parseInt(String(b.number), 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return String(a.number).localeCompare(String(b.number));
    });
  
  // Get question counts per section for tabs
  const getSectionCount = (section: string) => {
    if (section === "All") {
      return allQuestions.filter((q) => {
        if (filters.type && q.type !== filters.type) return false;
        return true;
      }).length;
    }
    return allQuestions.filter((q) => {
      if (q.section !== section) return false;
      if (filters.type && q.type !== filters.type) return false;
      return true;
    }).length;
  };
  
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 text-slate-900">
          Question Bank
        </h1>
        
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Papers</h3>
              <p className="text-3xl font-bold text-slate-900">{statistics.totalPapers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Questions</h3>
              <p className="text-3xl font-bold text-slate-900">{statistics.totalQuestions}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">MCQ Questions</h3>
              <p className="text-3xl font-bold text-blue-600">{statistics.byType?.MCQ ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Selected</h3>
              <p className="text-3xl font-bold text-green-600">{selectedQuestions.size}</p>
            </div>
          </div>
        )}
        
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">Upload PDF</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade <span className="text-red-500">*</span>
              </label>
              <select
                value={uploadForm.grade}
                onChange={(e) => {
                  const grade = e.target.value;
                  setUploadForm({ ...uploadForm, grade, subject: "" });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select grade</option>
                {ALL_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <select
                value={uploadForm.subject}
                onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!uploadForm.grade}
              >
                <option value="">Select subject</option>
                {uploadForm.grade &&
                  getSubjectsForGrade(parseInt(uploadForm.grade, 10)).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year <span className="text-red-500">*</span>
              </label>
              <select
                value={uploadForm.year}
                onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ALL_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer text-blue-600 hover:text-blue-700"
              >
                {uploadForm.file ? uploadForm.file.name : "Click to select PDF file"}
              </label>
            </div>
          </div>
          
          {uploading && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Processing PDF with OCR...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading & Processing..." : "Upload & Extract Questions"}
          </button>
          {uploadSuccessMessage && (
            <p className="mt-3 text-sm font-medium text-green-600 text-center">{uploadSuccessMessage}</p>
          )}
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">Filters</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade
              </label>
              <select
                value={filters.grade}
                onChange={(e) => setFilters({ ...filters, grade: e.target.value, subject: "" })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                {filterGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <select
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!filters.grade}
              >
                <option value="">All Subjects</option>
                {filterSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="MCQ">MCQ</option>
                <option value="Short">Short</option>
                <option value="Medium">Medium</option>
                <option value="Long">Long</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section
              </label>
              <input
                type="text"
                value={filters.section}
                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., SECTION-A"
              />
            </div>
          </div>
        </div>
        
        {/* Export/Download Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">Export & Download</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Download All (JSON) - commented out
            <button
              onClick={handleDownloadAllJSON}
              disabled={allQuestions.length === 0}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download All (JSON)
            </button>
            */}
            {/* Download Selected (JSON) - commented out
            <button
              onClick={handleDownloadSelectedJSON}
              disabled={selectedQuestions.size === 0}
              className="bg-indigo-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Selected (JSON)
            </button>
            */}
            {/* Export as CSV - commented out
            <button
              onClick={handleExportCSV}
              disabled={allQuestions.length === 0}
              className="bg-purple-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as CSV
            </button>
            */}
            
            <button
              onClick={handleDownloadPDF}
              disabled={selectedQuestions.size === 0}
              className="bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate Paper
            </button>
            <button
              onClick={openAddQuestionModal}
              disabled={papers.length === 0}
              className="bg-teal-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
          </div>
          
          {/* Legacy Generate Button (for preview) */}
          {selectedQuestions.size > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleGeneratePaper}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Preview Paper (without print)
              </button>
            </div>
          )}
        </div>
        
        {/* Section Tabs */}
        {allQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveSectionTab("All")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeSectionTab === "All"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All ({getSectionCount("All")})
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSectionTab(section)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeSectionTab === section
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {section} ({getSectionCount(section)})
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Question Bank Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Question Bank ({filteredQuestions.length} questions)
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedQuestions.size === filteredQuestions.length ? "Deselect All" : "Select All"}
                </button>
                {selectedQuestions.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete Selected ({selectedQuestions.size})
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  disabled={allQuestions.length === 0}
                >
                  Clear All Questions
                </button>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No questions found. Upload a PDF to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Select
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Question
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Section
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Marks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredQuestions.map((question, index) => (
                    <tr
                      key={question.id}
                      className={`hover:bg-gray-50 ${
                        selectedQuestions.has(question.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedQuestions.has(question.id)}
                          onChange={() => toggleQuestion(question.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-2xl align-top">
                        <div className="question-text">{renderQuestionText(question.text)}</div>
                        {question.diagram && (
                          <div className="mt-2 block text-sm text-gray-500 italic bg-gray-100 rounded px-2 py-1.5">
                            📐 Diagram: {question.diagram}
                          </div>
                        )}
                        {question.type === "MCQ" && question.options && question.options.length > 0 ? (
                          <div className="options-grid mt-1.5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "6px" }}>
                            {question.options.map((opt, idx) => {
                              const label = String.fromCharCode(65 + idx);
                              const cleanedOpt = opt.replace(/^[A-Da-d]\)\s*/, "");
                              return (
                                <span key={idx} className="text-sm text-gray-600" style={{ fontSize: "13px", color: "#374151" }}>
                                  {label}) {cleanedOpt}
                                </span>
                              );
                            })}
                          </div>
                        ) : question.options && question.options.length > 0 ? (
                          <div className="text-sm text-gray-600 mt-1.5">
                            {question.options.map((opt, idx) => {
                              const label = String.fromCharCode(65 + idx);
                              const cleanedOpt = opt.replace(/^[A-Da-d]\)\s*/, "");
                              return (
                                <span key={idx}>
                                  {label}) {cleanedOpt}
                                  {idx < question.options.length - 1 ? " " : ""}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            question.type === "MCQ"
                              ? "bg-blue-100 text-blue-800"
                              : question.type === "Long"
                              ? "bg-purple-100 text-purple-800"
                              : question.type === "Medium"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {question.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {question.section}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {question.marks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Generated Paper Preview - Modal */}
        {generatedPaper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 font-sans">
            <div className="flex flex-col items-center max-h-[95vh] overflow-hidden font-sans">
              <div className="flex justify-end gap-2 w-full max-w-[210mm] mb-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-sans"
                >
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => setGeneratedPaper(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-sans"
                >
                  Close
                </button>
              </div>
              <div
                ref={generatedPaperRef}
                className="bg-white shadow-2xl overflow-y-auto text-base leading-relaxed font-sans"
                style={{ width: "210mm", minHeight: "297mm", maxHeight: "calc(95vh - 60px)", padding: "20mm", fontFamily: "inherit" }}
              >
                <h2 className="text-2xl font-semibold text-slate-900 mb-6 text-center font-sans">
                  Generated Question Paper
                </h2>
                
                <div className="border-t border-slate-200 pt-5 font-sans">
                  <div className="mb-6 text-sm text-gray-600 flex gap-6 font-sans">
                    <p className="font-sans"><strong>Total Questions:</strong> {generatedPaper.totalQuestions}</p>
                    <p className="font-sans"><strong>Total Marks:</strong> {generatedPaper.totalMarks}</p>
                  </div>
                  
                  {(() => {
                    const sectionOrderIndex = (s: string) => {
                      const u = s.toUpperCase();
                      if (u.includes("SECTION-I") || u.includes("SECTION I")) return 0;
                      if (u.includes("SECTION-II") || u.includes("SECTION II")) return 1;
                      if (u.includes("SECTION-III") || u.includes("SECTION III")) return 2;
                      if (u.includes("PART-B")) return 3;
                      return 4;
                    };
                    const ordered = Object.entries(generatedPaper.bySection).sort(
                      ([a], [b]) => sectionOrderIndex(a) - sectionOrderIndex(b)
                    );
                    return ordered.map(([section, questions]: [string, any]) => (
                      <div key={section} className="mb-8 font-sans">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1 font-sans">{section}</h3>
                        <p className="text-sm text-gray-600 mb-4 font-sans">Each question carries {(questions as Question[])[0]?.marks ?? 0} marks</p>
                        <div className="space-y-5 font-sans">
                          {(questions as Question[]).map((q: Question) => (
                            <div key={q.id} className="pl-0 font-sans">
                              <div className="text-gray-800 mb-1.5 leading-relaxed flex gap-2 items-start font-sans">
                                {(() => {
                                  const lines = (q.text || "").split("\n");
                                  const hasTable = lines.some((line: string) => (line.match(/\|/g) || []).length >= 3);
                                  if (!hasTable) {
                                    return (
                                      <>
                                        <span className="font-semibold text-slate-900 shrink-0 w-12 text-right font-sans">Q{q.number}.</span>
                                        <div className="min-w-0 flex-1 font-sans">
                                          <span className="whitespace-pre-wrap break-words block font-sans">{q.text}</span>
                                          {q.diagram && (
                                            <div className="mt-2 text-sm text-gray-500 italic bg-gray-100 rounded px-2 py-1.5 font-sans">📐 Diagram: {q.diagram}</div>
                                          )}
                                          {(q.options || []).length > 0 && (
                                            <ul className="list-none text-sm text-gray-700 mt-1 space-y-0.5 font-sans">
                                              {(q.options || []).map((opt, i) => (
                                                <li key={i} className="leading-relaxed font-sans">{String.fromCharCode(65 + i)}) {opt}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </>
                                    );
                                  }
                                  return (
                                    <>
                                      <span className="font-semibold text-slate-900 shrink-0 w-12 text-right font-sans">Q{q.number}.</span>
                                      <div className="min-w-0 flex-1 font-sans">
                                        {renderQuestionText(q.text)}
                                        {q.diagram && (
                                          <div className="mt-2 text-sm text-gray-500 italic bg-gray-100 rounded px-2 py-1.5 font-sans">📐 Diagram: {q.diagram}</div>
                                        )}
                                        {(q.options || []).length > 0 && (
                                          <ul className="list-none text-sm text-gray-700 mt-1 space-y-0.5 font-sans">
                                            {(q.options || []).map((opt, i) => (
                                              <li key={i} className="leading-relaxed font-sans">{String.fromCharCode(65 + i)}) {opt}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {addQuestionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900">Add Question</h2>
              <button
                onClick={() => setAddQuestionModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddQuestionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper</label>
                <select
                  value={addQuestionForm.paperId}
                  onChange={(e) =>
                    setAddQuestionForm({ ...addQuestionForm, paperId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select paper</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject} — Class {p.grade} — {p.year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                <textarea
                  value={addQuestionForm.text}
                  onChange={(e) =>
                    setAddQuestionForm({ ...addQuestionForm, text: e.target.value })
                  }
                  onFocus={(e) => {
                    setMathKeyboardVisible(true);
                    setMathActiveField({ questionIndex: -1, field: "text" });
                    mathActiveInputRef.current = e.target;
                    setMathSelection({
                      start: e.target.selectionStart ?? 0,
                      end: e.target.selectionEnd ?? 0,
                    });
                  }}
                  onSelect={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                  }}
                  onKeyUp={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={addQuestionForm.type}
                    onChange={(e) =>
                      setAddQuestionForm({
                        ...addQuestionForm,
                        type: e.target.value as "MCQ" | "Short" | "Long",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MCQ">MCQ</option>
                    <option value="Short">Short</option>
                    <option value="Long">Long</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={addQuestionForm.marks}
                    onChange={(e) =>
                      setAddQuestionForm({
                        ...addQuestionForm,
                        marks: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {addQuestionForm.type === "MCQ" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                  <div className="space-y-2">
                    {addQuestionForm.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-6 text-sm font-medium text-gray-600">
                          {String.fromCharCode(65 + idx)})
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const nextOptions = [...addQuestionForm.options];
                            nextOptions[idx] = e.target.value;
                            setAddQuestionForm({
                              ...addQuestionForm,
                              options: nextOptions,
                            });
                          }}
                          onFocus={(e) => {
                            setMathKeyboardVisible(true);
                            setMathActiveField({
                              questionIndex: -1,
                              field: "option",
                              optionIndex: idx,
                            });
                            mathActiveInputRef.current = e.target;
                            setMathSelection({
                              start: e.target.selectionStart ?? 0,
                              end: e.target.selectionEnd ?? 0,
                            });
                          }}
                          onSelect={(e) => {
                            const t = e.target as HTMLInputElement;
                            setMathSelection({
                              start: t.selectionStart ?? 0,
                              end: t.selectionEnd ?? 0,
                            });
                          }}
                          onKeyUp={(e) => {
                            const t = e.target as HTMLInputElement;
                            setMathSelection({
                              start: t.selectionStart ?? 0,
                              end: t.selectionEnd ?? 0,
                            });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correct Answer
                </label>
                <input
                  type="text"
                  value={addQuestionForm.correctAnswer}
                  onChange={(e) =>
                    setAddQuestionForm({
                      ...addQuestionForm,
                      correctAnswer: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    addQuestionForm.type === "MCQ"
                      ? "e.g., A or full correct option text"
                      : "Short answer text"
                  }
                />
              </div>
              {/* Math symbol keyboard for Add Question modal */}
              <MathKeyboard
                visible={mathKeyboardVisible}
                onInsert={handleMathSymbolInsert}
                onClose={() => setMathKeyboardVisible(false)}
              />
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddQuestionModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit & Preview Modal */}
      {editPreviewMode && paperMetadata && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Edit & Preview Paper</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Subject: {paperMetadata.subject} | Grade: {paperMetadata.grade} | Year: {paperMetadata.year}
                </p>
                <p className="text-sm text-gray-600">
                  Total Questions: {editableQuestions.length} | Total Marks: {editableQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)}
                </p>
              </div>
              <button
                onClick={() => setEditPreviewMode(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Edit Header Section */}
              <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Header</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                    <input
                      type="text"
                      value={headerFields.schoolName}
                      onChange={(e) => setHeaderFields({ ...headerFields, schoolName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={headerFields.location}
                      onChange={(e) => setHeaderFields({ ...headerFields, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title</label>
                    <input
                      type="text"
                      value={headerFields.examTitle}
                      onChange={(e) => setHeaderFields({ ...headerFields, examTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={headerFields.subject}
                      onChange={(e) => setHeaderFields({ ...headerFields, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <input
                      type="text"
                      value={headerFields.class}
                      onChange={(e) => setHeaderFields({ ...headerFields, class: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
                    <input
                      type="number"
                      value={headerFields.maxMarks}
                      onChange={(e) => setHeaderFields({ ...headerFields, maxMarks: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="text"
                      value={headerFields.time}
                      onChange={(e) => setHeaderFields({ ...headerFields, time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date (Optional)</label>
                    <input
                      type="text"
                      value={headerFields.date}
                      onChange={(e) => setHeaderFields({ ...headerFields, date: e.target.value })}
                      placeholder="e.g., 15-02-2026"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              {(() => {
                const sections: Record<string, { question: Question; index: number }[]> = {};
                const sectionOrder: string[] = [];
                editableQuestions.forEach((q, index) => {
                  const sectionName = editableSections[q.section] || q.section;
                  if (!sections[sectionName]) {
                    sections[sectionName] = [];
                    sectionOrder.push(sectionName);
                  }
                  sections[sectionName].push({ question: q, index });
                });
                return sectionOrder.map((sectionName) => {
                  const items = sections[sectionName];
                  const originalSection = items[0]?.question.section || sectionName;
                  const isObjectiveType = /PART-B|SECTION-A|OBJECTIVE|MCQ/i.test(sectionName);
                  return (
                    <div key={sectionName} className="mb-8">
                      {/* Section divider label */}
                      <div className="mb-3 py-2 px-3 bg-gray-100 border-l-4 border-gray-400 rounded-r text-sm font-semibold text-gray-700">
                        {isObjectiveType ? "[OBJECTIVE TYPE]" : `[${sectionName}]`}
                      </div>
                      {/* Section name - editable */}
                      <div className="mb-4 pb-2 border-b border-gray-300">
                        <input
                          type="text"
                          value={sectionName}
                          onChange={(e) => updateSectionName(originalSection, e.target.value)}
                          className="text-lg font-bold bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded w-full"
                          placeholder="Section Name"
                        />
                      </div>
                      
                      {items.map(({ question, index }) => {
                        const marksNum = Number(question.marks);
                        const marksInvalid = marksNum < 1 || isNaN(marksNum) || String(question.marks ?? "").trim() === "";
                        const optionSlots = question.type === "MCQ"
                          ? [0, 1, 2, 3].map((i) => (question.options || [])[i] ?? "")
                          : (question.options || []);
                        return (
                        <div key={`${question.id}-${index}`} className="mb-6 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                          <div className="flex items-start gap-2 mb-3">
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => moveQuestionUp(index)}
                                disabled={index === 0}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed rounded text-sm"
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestionDown(index)}
                                disabled={index === editableQuestions.length - 1}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed rounded text-sm"
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-semibold text-lg">Q{question.number}.</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={question.marks}
                                  onChange={(e) => {
                                    const raw = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                    updateQuestionMarks(index, isNaN(raw) ? 0 : raw);
                                  }}
                                  className={`w-16 px-2 py-1 border rounded text-sm ${marksInvalid ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                                />
                                <span className="text-sm text-gray-600">marks</span>
                                <button
                                  type="button"
                                  onClick={() => deleteQuestion(index)}
                                  className="ml-auto px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                >
                                  × Delete
                                </button>
                              </div>

                              {/* Preview with table rendering */}
                              <div className="mb-2 text-sm text-gray-800">
                                {renderQuestionText(question.text)}
                                {question.diagram && (
                                  <div className="mt-2 text-sm text-gray-500 italic bg-gray-100 rounded px-2 py-1.5">📐 Diagram: {question.diagram}</div>
                                )}
                              </div>

                              <textarea
                                value={question.text}
                                onChange={(e) => updateQuestionText(index, e.target.value)}
                                onFocus={(e) => {
                                  setMathKeyboardVisible(true);
                                  setMathActiveField({ questionIndex: index, field: "text" });
                                  mathActiveInputRef.current = e.target;
                                  setMathSelection({ start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 });
                                }}
                                onSelect={(e) => {
                                  const t = e.target as HTMLTextAreaElement;
                                  setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                                }}
                                onKeyUp={(e) => {
                                  const t = e.target as HTMLTextAreaElement;
                                  setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                                }}
                                className="w-full p-2 border border-gray-300 rounded mb-3 min-h-[60px] resize-y"
                                placeholder="Question text..."
                              />
                              
                              {(question.type === "MCQ" || (question.options && question.options.length > 0)) && (
                                <div className="ml-4 space-y-2">
                                  {(question.type === "MCQ" ? optionSlots : (question.options || [])).map((opt, optIdx) => {
                                    const label = String.fromCharCode(65 + optIdx);
                                    const cleanedOpt = opt.replace(/^[A-Da-d]\)\s*/, "");
                                    return (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-600 w-6">{String.fromCharCode(65 + optIdx)})</span>
                                      <input
                                        type="text"
                                        value={question.type === "MCQ" ? optionSlots[optIdx] : cleanedOpt}
                                        onChange={(e) => updateOption(index, optIdx, e.target.value)}
                                        onFocus={(e) => {
                                          setMathKeyboardVisible(true);
                                          setMathActiveField({ questionIndex: index, field: "option", optionIndex: optIdx });
                                          mathActiveInputRef.current = e.target;
                                          setMathSelection({ start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 });
                                        }}
                                        onSelect={(e) => {
                                          const t = e.target as HTMLInputElement;
                                          setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                                        }}
                                        onKeyUp={(e) => {
                                          const t = e.target as HTMLInputElement;
                                          setMathSelection({ start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 });
                                        }}
                                        className="flex-1 p-2 border border-gray-300 rounded text-sm"
                                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                      />
                                    </div>
                                  );})}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* Math symbol keyboard - fixed at bottom of modal content, above footer */}
            <MathKeyboard
              visible={mathKeyboardVisible}
              onInsert={handleMathSymbolInsert}
              onClose={() => setMathKeyboardVisible(false)}
            />
            
            {pdfGenLogs.length > 0 && (
              <div className="px-6 py-3 border-t bg-slate-900 text-green-400 font-mono text-xs overflow-auto max-h-32">
                <pre className="whitespace-pre-wrap">{pdfGenLogs.join("\n")}</pre>
              </div>
            )}
            
            {/* Footer with action buttons */}
            <div className="p-6 border-t flex justify-end gap-4 shrink-0">
              <button
                onClick={() => setEditPreviewMode(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Back to Selection
              </button>
              <button
                onClick={openAddQuestionModal}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
              >
                Add Question
              </button>
              <button
                onClick={handleDownloadPDFFromPreview}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
