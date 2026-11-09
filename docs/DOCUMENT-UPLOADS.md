# Study document uploads

The Add study text editor accepts .txt (100 KB), .docx, .pdf, and .pptx (4 MB). Older .doc and .ppt files must first be saved in a supported format.

Plain text stays in the browser until saved. Office and PDF files are posted to the authenticated /api/texts/extract endpoint and parsed in server memory using officeparser. Original documents are not stored. PowerPoint speaker notes are included when available. No AI service receives the original upload.

Extracted text is shown for review before saving. The 200–20,000 character study-text limits still apply; longer documents can be trimmed to the relevant section. Nothing is silently truncated. Formatting, diagrams, and images are not imported. OCR is not enabled, so scanned PDFs and image-only slides need text recognition first. Password-protected or damaged files show an actionable error and leave the existing editor text intact.

The endpoint bounds the streamed request and validates file extensions, sizes, and binary signatures. Office decompression and XML limits constrain expanded files; parsing has a 20-second abort signal. The route uses the Node runtime and officeparser is externalized for Next server builds. Deploy with Node 22.13 or newer, as required by the parser.

Tests use small real DOCX, PPTX, and PDF fixtures as well as invalid-file, upload-size, and authentication cases.

## Content quality

The editor warns about garbled extraction, repeated filler, and limited useful text for both pasted and uploaded material. It keeps the text editable. Clearly unusable content is blocked server-side before quiz generation spends quota. Borderline material can continue.

The generation prompt asks the AI to check coherence and sufficient factual content before writing questions. Unsuitable content returns a validation message without retries or saving a quiz. This check shares the existing AI call, timeout, and quota. It is a best-effort assessment, not a guarantee of factual accuracy. Technical notes, equations, vocabulary lists, and non-English material are explicitly allowed. No dictionaries or English-only word matching are used.
