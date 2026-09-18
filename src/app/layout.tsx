import type { Metadata } from "next";
import "@frontend/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "QuizTrick", template: "%s · QuizTrick" },
  description: "Turn your study notes into practice quizzes, track scores, manage study tasks and time your sessions.",
};

/**
 * Root layout. TODO(frontend, WBS 1.6.2): add ThemeProvider + a pre-paint
 * ThemeScript so the saved theme applies without a flash (FR-8.2, FR-8.3).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
