import React from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      {/* Label */}
      <div className="text-[12px] text-slate-700 mb-1 font-medium">
        {label}
        {hint && <span className="text-slate-400 ml-1">• {hint}</span>}
      </div>

      {/* Input / Children */}
      <div
        className={`rounded-xl border ${
          error ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white"
        } focus-within:ring-2 focus-within:ring-slate-200 transition`}
      >
        {children}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-1 text-[12px] text-rose-600 font-medium">
          {error}
        </div>
      )}
    </label>
  );
}
