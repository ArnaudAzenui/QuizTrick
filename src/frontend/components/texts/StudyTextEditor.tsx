"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError, errorMessage } from "@frontend/lib/api-client";
import { FormField } from "@frontend/components/FormField";
import { LIMITS, ROUTES } from "@shared/constants";
import type { StudyText } from "@shared/types";
import { validateStudyText } from "@shared/utils/text";
import { assessContentQuality } from "@shared/utils/content-quality";
import { STUDY_FILE_ACCEPT } from "@shared/utils/study-file";
import { titleFromFileName, validateTextFile } from "./text-file";
import { applyImport, IMPORT_MESSAGES, IMPORT_NOTE, isExtensionImportUrl, parseImportMessage } from "./extension-import";

/**
 * Paste or upload study text and save it (FR-2.1 - FR-2.7, WBS 1.4.2).
 *
 * The character count uses validateStudyText(), the same function the API
 * runs, so the number on screen is the number the server will check.
 * On success the student lands on the saved text, where they can generate a quiz.
 *
 * Opened by the Canvas extension (/texts/new?from=extension), the editor asks
 * the extension for the captured text and fills in the form with it (F-6). It
 * never saves by itself and never replaces text the student already typed.
 * The checks live in ./extension-import.ts.
 */
export function StudyTextEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fileNote, setFileNote] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [bodyError, setBodyError] = useState<string>();
  const [titleError, setTitleError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Latest form values for the message listener, which is set up once.
  const formRef = useRef({ title, body });
  useEffect(() => {
    formRef.current = { title, body };
  }, [title, body]);

  // Canvas extension handoff (F-6). Only when the extension opened this page.
  useEffect(() => {
    if (!isExtensionImportUrl(window.location.search)) return;
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      const incoming = parseImportMessage(event, { window, origin });
      if (!incoming) return;
      const next = applyImport(formRef.current, incoming);
      if (!next) return;
      // Update the ref right away so a second import message is dropped too.
      formRef.current = next;
      setTitle(next.title);
      setBody(next.body);
      setBodyError(undefined);
      setFileError(undefined);
      setFileNote(IMPORT_NOTE);
      window.postMessage({ type: IMPORT_MESSAGES.received }, origin);
    };
    window.addEventListener("message", onMessage);
    // The extension may have loaded first, so ask for the text as well.
    window.postMessage({ type: IMPORT_MESSAGES.request }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const check = validateStudyText(body);
  const quality = assessContentQuality(body);
  const tooLong = check.charCount > LIMITS.TEXT_MAX_CHARS;
  const remainingToMin = Math.max(0, LIMITS.TEXT_MIN_CHARS - check.charCount);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setFileError(undefined);
    setFileNote(undefined);
    if (!file) return;
    const result = validateTextFile(file);
    if (!result.ok) {
      setFileError(result.message);
      event.target.value = "";
      return;
    }
    setReading(true);
    try {
      let text: string;
      if (file.name.toLowerCase().endsWith(".txt")) {
        text = await file.text();
      } else {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/texts/extract", { method: "POST", body: form, credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "We couldn't read that document.");
        text = result.data.text;
      }
      setBody(text);
      setBodyError(undefined);
      if (!title.trim()) setTitle(titleFromFileName(file.name));
      setFileNote(`Loaded ${file.name}. Review it below before saving.`);
    } catch (err) {
      setFileError(errorMessage(err, "We couldn't read that file. Try again, or paste the text instead."));
    } finally {
      // Lets the same file be chosen again after an edit or a clear.
      input.value = "";
      setReading(false);
    }
  }

  function clear() {
    setTitle("");
    setBody("");
    setFileNote(undefined);
    setFileError(undefined);
    setBodyError(undefined);
    setTitleError(undefined);
    setFormError(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reading) return;
    setBodyError(undefined);
    setTitleError(undefined);
    setFormError(undefined);

    const result = validateStudyText(body);
    if (!result.ok) {
      setBodyError(result.message);
      return;
    }

    setBusy(true);
    try {
      const saved = await api.post<StudyText>("/api/texts", { title: title.trim() || undefined, body });
      router.push(ROUTES.text(saved.textId));
      router.refresh();
    } catch (err) {
      const fields = err instanceof ApiClientError ? err.fields : undefined;
      if (fields?.body) setBodyError(fields.body);
      if (fields?.title) setTitleError(fields.title);
      if (!fields?.body && !fields?.title) setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <FormField
        id="title"
        name="title"
        label="Title (optional)"
        placeholder="e.g. BIO-110 Chapter 4 notes"
        maxLength={LIMITS.TEXT_TITLE_MAX}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={busy || reading}
        error={titleError}
      />

      <div>
        <label htmlFor="file" className="block text-sm font-medium">
          Upload study material
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept={STUDY_FILE_ACCEPT}
          onChange={onFile}
          disabled={busy || reading}
          aria-describedby={fileError ? "file-error" : "file-hint"}
          className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg"
        />
        <p id="file-hint" className="mt-1 text-xs text-muted">
          Word (.docx), PDF, or PowerPoint (.pptx) up to 4 MB; plain text (.txt) up to 100 KB. Review the extracted text below. Scans and images need OCR first. Save up to 20,000 characters at a time.
        </p>
        {reading && <p role="status" className="mt-1 text-sm text-muted">Reading your document...</p>}
        {fileNote && (
          <p role="status" className="mt-1 text-sm text-muted">
            {fileNote}
          </p>
        )}
        {fileError && (
          <p id="file-error" role="alert" className="mt-1 text-sm text-danger">
            {fileError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium">
          Study text
        </label>
        <textarea
          id="body"
          name="body"
          rows={14}
          required
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setBodyError(undefined);
          }}
          disabled={busy || reading}
          placeholder="Paste your notes here…"
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={bodyError ? "body-error body-count" : "body-count"}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-primary"
        />
        <p id="body-count" aria-live="polite" className={`mt-1 text-xs ${tooLong ? "text-danger" : "text-muted"}`}>
          {check.charCount.toLocaleString()} / {LIMITS.TEXT_MAX_CHARS.toLocaleString()} characters
          {remainingToMin > 0 && ` · ${remainingToMin.toLocaleString()} more needed (minimum ${LIMITS.TEXT_MIN_CHARS})`}
          {tooLong && " · too long"}
        </p>
        {quality.message && <p role="status" className="mt-2 rounded-xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm">{quality.message}</p>}
        {bodyError && (
          <p id="body-error" role="alert" className="mt-1 text-sm text-danger">
            {bodyError}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || reading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save study text"}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={busy || reading || (!body && !title)}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
        >
          Clear
        </button>
        <Link href={ROUTES.texts} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
