import type { InputHTMLAttributes } from "react";

export function FormField({ label, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return <div>
    <label htmlFor={input.id} className="block text-sm font-medium">{label}</label>
    <input {...input} aria-invalid={error ? true : undefined} aria-describedby={error ? `${input.id}-error` : undefined}
      className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 focus:border-primary" />
    {error && <p id={`${input.id}-error`} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
  </div>;
}
