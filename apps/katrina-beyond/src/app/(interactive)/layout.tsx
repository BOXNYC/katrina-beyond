import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Katrina & Beyond Interactives",
  description: "Interactive explorations of Hurricane Katrina and beyond",
};

export default function InteractiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
