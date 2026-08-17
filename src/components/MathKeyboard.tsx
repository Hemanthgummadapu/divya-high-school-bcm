"use client";

import { useState } from "react";

const TABS = [
  {
    id: "greek",
    label: "Greek & Trig",
    symbols: [
      ["θ", "φ", "α", "β", "γ", "δ", "λ", "μ", "π", "Σ", "Ω", "∞"],
      ["sin", "cos", "tan", "cosec", "sec", "cot"],
      ["sin⁻¹", "cos⁻¹", "tan⁻¹"],
      ["sin²θ", "cos²θ", "tan²θ"],
    ],
  },
  {
    id: "powers",
    label: "Powers & Roots",
    symbols: [
      ["x²", "x³", "xⁿ", "x⁻¹", "x½"],
      ["√", "∛", "∜", "²√", "³√"],
      ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"],
      ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"],
    ],
  },
  {
    id: "operators",
    label: "Operators",
    symbols: [
      ["×", "÷", "±", "≠", "≈", "≡", "∝"],
      ["≤", "≥", "<", ">", "≪", "≫"],
      ["∈", "∉", "⊂", "⊃", "∪", "∩", "∅"],
      ["∴", "∵", "⇒", "⇔", "→", "←"],
    ],
  },
  {
    id: "fractions",
    label: "Fractions & Calculus",
    symbols: [
      ["½", "⅓", "¼", "¾", "⅔", "⅛", "⅜", "⅝", "⅞"],
      ["∫", "∬", "∂", "∇", "∆", "∑", "∏", "∞"],
      ["lim", "log", "log₁₀", "logₐ", "ln"],
      ["°", "'", "\"", "⊥", "∥", "∠"],
    ],
  },
  {
    id: "geometry",
    label: "Geometry & Sets",
    symbols: [
      ["△", "□", "○", "⊙", "∡", "⌒"],
      ["∠ABC", "||", "⊥"],
      ["∈", "∉", "⊆", "⊇", "∪", "∩", "∅"],
      ["n(A)", "n(AUB)", "n(A∩B)", "A'", "U"],
    ],
  },
];

const SYMBOL_FONT =
  '"Segoe UI Symbol", "Apple Color Emoji", "Noto Sans Symbols", sans-serif';

export interface MathKeyboardProps {
  visible: boolean;
  onInsert: (symbol: string) => void;
  onClose: () => void;
}

export default function MathKeyboard({ visible, onInsert, onClose }: MathKeyboardProps) {
  const [activeTab, setActiveTab] = useState(0);
  const tab = TABS[activeTab];

  if (!visible) return null;

  return (
    <div className="relative isolate flex shrink-0 flex-col rounded-lg border border-gray-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-row gap-1 overflow-x-auto min-w-0">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                i === activeTab
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 ml-2 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          aria-label="Close keyboard"
        >
          ×
        </button>
      </div>
      <div
        className="flex flex-wrap gap-1 overflow-y-auto overflow-x-auto max-h-[148px]"
        style={{ fontFamily: SYMBOL_FONT }}
      >
        {tab.symbols.flat().map((sym, i) => (
          <button
            key={`${sym}-${i}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsert(sym);
            }}
            className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors shrink-0"
            style={{ fontFamily: SYMBOL_FONT }}
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
