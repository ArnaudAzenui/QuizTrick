# Canvas page fixtures

Pages `tests/unit/extension-extract.test.ts` runs `extractFromPage()` against. All three are real pages saved from our course (CSC-4900-001-F26) on canvas.uncp.edu, with everything personal removed.

| File | Canvas page | What it confirms |
|---|---|---|
| `page.html` | A wiki page ("Responsive Use of AI Tools") | `.show-content.user_content` and title `h1.page-title` |
| `assignment.html` | An assignment (the final group presentation) | `#assignment_show .description.user_content` and title `#assignment_show h1.title` |
| `syllabus.html` | The course syllabus | `#course_syllabus` exists. This course has no syllabus body, so the element is empty and the extractor moves on to `#content`. A save from a course with a written syllabus would confirm the text is read. |

`syllabus.html` also holds Canvas's hidden help text (`#course_syllabus_details`, `display: none`), which the tests use to check that hidden elements are skipped.

## What was removed

The student's name, email and Canvas user ID, every signed token and form security token, every `<script>`, `<style>`, `<link>`, `<iframe>` and image, every `data-` attribute (user, submission and file IDs), HTML comments, the global navigation and account menu, the assignment's submission and rubric forms, and the new-grades badge in the course menu. The course ID (`40856`) and the course menu links are left in; they identify the course, not a person.

## Adding or replacing a page

1. Open the page in Canvas and wait until its content shows.
2. Open DevTools (F12), go to **Elements**, right-click the `<html>` element and choose **Copy > Copy outerHTML**. Paste it into the file. Do not use "Save page as" or the page source: Canvas draws wiki page content with JavaScript, so those saves have an empty `#wiki_page_show`.
3. Remove everything personal, as listed above. Search the file for your name, your email, `current_user`, `eyJ` (tokens) and `/users/` before committing. The repo is public.
4. Run `npx vitest run tests/unit/extension-extract.test.ts`. If an expectation fails only because the real wording differs, update the expectation. If the body is empty or picks up navigation text, the selector is wrong: fix `extension/lib/extract.js`.
