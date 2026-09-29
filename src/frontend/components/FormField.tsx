"use client";

import { useState, type InputHTMLAttributes } from "react";

export function FormField({ label, error, revealPassword = false, ...input }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; revealPassword?: boolean }) {
  const [visible, setVisible] = useState(false);
  const canReveal = revealPassword && input.type === "password";

  return <div>
    <label htmlFor={input.id} className="block text-sm font-medium">{label}</label>
    <div className="relative mt-1">
      <input {...input} type={canReveal && visible ? "text" : input.type}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${input.id}-error` : undefined}
        className={`w-full rounded-xl border border-border bg-surface px-3 py-2 focus:border-primary${canReveal ? " pr-12" : ""}`} />
      {canReveal && <button
        type="button"
        onClick={() => setVisible(current => !current)}
        aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-controls={input.id}
        title={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        disabled={input.disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted hover:text-fg disabled:opacity-50"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>}
    </div>
    {error && <p id={`${input.id}-error`} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
  </div>;
}