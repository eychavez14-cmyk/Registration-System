"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { displayLogin, type Role } from "@/lib/staff";

const RoleContext = createContext<Role>("moderator");
// The signed-in staff member's role, for showing/hiding admin-only UI.
export const useRole = () => useContext(RoleContext);

// Client-side gate for UX only; the real protection is row-level security (is_admin / is_staff) in the database.
function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<"loading" | "denied" | { role: Role; login: string }>("loading");

  useEffect(() => {
    const db = browserDb();
    db.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace("/admin/login");
      const { data: row } = await db.from("admins").select("*").maybeSingle();
      setState(row ? { role: row.role ?? "admin", login: displayLogin(data.user.email ?? "") } : "denied");
    });
  }, [router]);

  async function signOut() {
    await browserDb().auth.signOut();
    router.replace("/admin/login");
  }

  if (state === "loading") return <p className="p-10 text-center text-sm text-slate-500">Loading…</p>;
  if (state === "denied")
    return (
      <div className="p-10 text-center text-sm">
        <p>This account doesn&apos;t have access to the admin area.</p>
        <button onClick={signOut} className="mt-3 underline">Sign out</button>
      </div>
    );
  const navLink = (href: string, label: string) => (
    <Link href={href} className={`text-sm ${path === href ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-900"}`}>{label}</Link>
  );
  return (
    <RoleContext.Provider value={state.role}>
      <div className="min-h-full flex flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
          <Link href="/admin" className="font-extrabold tracking-tight">Registration Admin</Link>
          {navLink("/admin", "Events")}
          {state.role === "admin" && navLink("/admin/users", "Users")}
          <span className="ml-auto text-xs text-slate-500">
            {state.login} · <span className={`rounded-full px-2 py-0.5 font-semibold ${state.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}`}>{state.role === "admin" ? "Admin" : "Moderator"}</span>
          </span>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
        </header>
        {children}
      </div>
    </RoleContext.Provider>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  return usePathname() === "/admin/login" ? children : <Guard>{children}</Guard>;
}
