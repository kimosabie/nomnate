"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-flame hover:bg-flame-dark text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
    >
      Print
    </button>
  );
}
