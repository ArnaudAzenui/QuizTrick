import type { Metadata } from "next";
import { ThemeToggle } from "@frontend/components/ThemeToggle";
import "@frontend/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "QuizTrick", template: "%s · QuizTrick" },
  description: "Turn your study notes into practice quizzes, track scores, manage study tasks and time your sessions.",
};

/** Shared layout and theme control for every page. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var theme="light";try{var saved=localStorage.getItem("quiztrick-theme");theme=saved==="light"||saved==="dark"?saved:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch{}document.documentElement.dataset.theme=theme;})();` }} />
      </head>
      <body>
        <div className="pb-20">{children}</div>
        <ThemeToggle />
      </body>
    </html>
  );
}
