import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wida — A little less paperwork",
  description: "Bring your documents together. Review extracted invoice details, keep your originals, and build a clear invoice library with Wida.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
