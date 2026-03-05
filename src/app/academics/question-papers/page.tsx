"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QuestionPaper, Question } from "@/lib/questionPapers";
import jsPDF from "jspdf";
import MathKeyboard from "@/components/MathKeyboard";

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
  const [generatedPaper, setGeneratedPaper] = useState<any>(null);
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
  
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    subject: "",
    grade: "",
    year: "",
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
  
  // Get unique values for filters
  const subjects = Array.from(new Set(papers.map((p) => p.subject))).sort();
  const grades = Array.from(new Set(papers.map((p) => p.grade))).sort();
  const years = Array.from(new Set(papers.map((p) => p.year))).sort();
  
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
    if (!uploadForm.file || !uploadForm.subject || !uploadForm.grade || !uploadForm.year) {
      alert("Please fill all fields and select a PDF file");
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("subject", uploadForm.subject);
      formData.append("grade", uploadForm.grade);
      formData.append("year", uploadForm.year);
      
      // Simulate progress (actual progress would come from server)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      
      const response = await fetch("/api/question-papers", {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully uploaded! Extracted ${data.paper.questions.length} questions.`);
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
  
  // Generate paper
  const handleGeneratePaper = async () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question");
      return;
    }
    
    try {
      const response = await fetch("/api/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQuestions),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratedPaper(data.paper);
      } else {
        alert(`Generation failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Generation error: ${error.message}`);
    }
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
    
    let questionNumber = 1;
    let mcqNumber = 1;
    
    for (let i = 0; i < sectionsWithQuestions.length; i++) {
      const section = sectionsWithQuestions[i];
      const questions = questionsBySection[section];
      const upperSection = section.toUpperCase();
      const isMcqSection = upperSection.includes('PART-B') || upperSection.includes('SECTION-A') || upperSection.includes('OBJECTIVE');
      
      checkPageBreak(15);
      doc.setFontSize(12).setFont('helvetica', 'bold');
      doc.text(section, margin, y);
      y += 7;
      
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
      
      for (const q of questions) {
        checkPageBreak(20);
        const currentQuestionNumber = isMcqSection ? mcqNumber : questionNumber;
        doc.setFontSize(11).setFont('helvetica', 'normal');
        const questionNumberText = `Q${currentQuestionNumber}.`;
        const marksText = `[${q.marks} marks]`;
        doc.text(questionNumberText, margin, y);
        if (isMcqSection) {
          mcqNumber++;
        } else {
          questionNumber++;
        }
        const marksWidth = doc.getTextWidth(marksText);
        doc.text(marksText, pageWidth - margin - marksWidth, y);
        y += 6;
        
        checkPageBreak(15);
        const cleanedQuestionText = cleanText(q.text);
        const questionLines = doc.splitTextToSize(cleanedQuestionText, contentWidth);
        doc.text(questionLines, margin, y);
        y += questionLines.length * 6;
        
        if (q.options && q.options.length > 0) {
          checkPageBreak(Math.ceil(q.options.length / 2) * 6);
          const optWidth = contentWidth / 2 - 5;
          const leftX = margin;
          const rightX = margin + contentWidth / 2 + 5;
          
          for (let optIdx = 0; optIdx < q.options.length; optIdx += 2) {
            const leftOpt = cleanText(q.options[optIdx]);
            const leftLines = doc.splitTextToSize(leftOpt, optWidth);
            doc.text(leftLines, leftX, y);
            const leftHeight = leftLines.length * 6;
            let rightHeight = 0;
            if (optIdx + 1 < q.options.length) {
              const rightOpt = cleanText(q.options[optIdx + 1]);
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
  
  const updateQuestionText = (index: number, text: string) => {
    const newQuestions = editableQuestions.map((q, i) =>
      i === index ? { ...q, text } : q
    );
    setEditableQuestions(newQuestions);
  };
  
  const updateQuestionMarks = (index: number, marks: number) => {
    const v = Math.round(Number(marks));
    const value = (v >= 1 && v <= 10) ? v : (v === 0 || isNaN(v) ? 0 : Math.min(10, Math.max(1, v)));
    const newQuestions = editableQuestions.map((q, i) =>
      i === index ? { ...q, marks: value } : q
    );
    setEditableQuestions(newQuestions);
  };
  
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = editableQuestions.map((q, i) => {
      if (i !== questionIndex) return q;
      const options = [...(q.options || [])];
      while (options.length <= optionIndex) options.push("");
      options[optionIndex] = value;
      return { ...q, options };
    });
    setEditableQuestions(newQuestions);
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
  }, [mathActiveField, mathSelection, editableQuestions]);
  
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
  const filteredQuestions = allQuestions.filter((q) => {
    // Filter by active section tab
    if (activeSectionTab !== "All" && q.section !== activeSectionTab) return false;
    // Filter by type
    if (filters.type && q.type !== filters.type) return false;
    return true;
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
                Subject
              </label>
              <input
                type="text"
                value={uploadForm.subject}
                onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Mathematics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade
              </label>
              <input
                type="text"
                value={uploadForm.grade}
                onChange={(e) => setUploadForm({ ...uploadForm, grade: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <input
                type="text"
                value={uploadForm.year}
                onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2026"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF File
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
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">Filters</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <select
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade
              </label>
              <select
                value={filters.grade}
                onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
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
                  {filteredQuestions.map((question) => (
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
                        {question.number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-2xl align-top">
                        <div className="whitespace-pre-wrap break-words">{question.text}</div>
                        {question.options && question.options.length > 0 && (
                          <div className="text-sm text-gray-600 mt-1.5">
                            {question.options.map((opt, idx) => {
                              const label = String.fromCharCode(65 + idx);
                              return (
                                <span key={idx}>
                                  {label}) {opt}{idx < question.options.length - 1 ? " " : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}
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
        
        {/* Generated Paper Preview */}
        {generatedPaper && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Generated Question Paper
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Print
                </button>
                <button
                  onClick={() => setGeneratedPaper(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="mb-4 text-sm text-gray-600">
                <p>Total Questions: {generatedPaper.totalQuestions}</p>
                <p>Total Marks: {generatedPaper.totalMarks}</p>
              </div>
              
              {Object.entries(generatedPaper.bySection).map(([section, questions]: [string, any]) => (
                <div key={section} className="mb-6">
                  <h3 className="text-xl font-semibold mb-3 text-slate-900">{section}</h3>
                  <div className="space-y-4">
                    {questions.map((q: Question) => (
                      <div key={q.id} className="border-l-4 border-blue-500 pl-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold">Q{q.number}.</span>
                          <span className="text-sm text-gray-500">({q.marks} marks)</span>
                        </div>
                        <p className="text-gray-700 mb-2">{q.text}</p>
                        {q.options.length > 0 && (
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                            {q.options.map((opt, i) => (
                              <li key={i}>{opt}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
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
                                  {(question.type === "MCQ" ? optionSlots : (question.options || [])).map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-600 w-6">{String.fromCharCode(65 + optIdx)})</span>
                                      <input
                                        type="text"
                                        value={question.type === "MCQ" ? optionSlots[optIdx] : opt}
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
                                  ))}
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
            
            {/* Footer with action buttons */}
            <div className="p-6 border-t flex justify-end gap-4 shrink-0">
              <button
                onClick={() => setEditPreviewMode(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Back to Selection
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
