import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewTerpCat",
  description: "Search the University of Maryland Libraries catalog",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
