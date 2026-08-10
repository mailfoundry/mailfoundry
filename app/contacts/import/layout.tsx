import type { Metadata } from "next";
export const metadata: Metadata = { title: "Import Contacts" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
