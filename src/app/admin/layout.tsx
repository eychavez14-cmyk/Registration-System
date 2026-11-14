import { Suspense, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { Loading } from "@/components/Loading";

export const metadata = { title: "Registration Admin", robots: { index: false } };
// Admin pages render only after the client-side login check, so there is nothing to prerender for instant navigation.
export const instant = false;

// The admin UI is client-rendered, so it streams after the static shell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
