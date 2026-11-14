"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { inputClass } from "@/components/RegistrationForm";
import { toLoginEmail } from "@/lib/staff";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const db = browserDb();
    const { error } = await db.auth.signInWithPassword({ email: toLoginEmail(String(form.get("email"))), password: String(form.get("password")) });
    if (error) {
      setError("Wrong username/email or password");
      setBusy(false);
      return;
    }
    router.replace("/admin");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ ["--primary" as string]: "#2563eb" }}>
        <h1 className="text-xl font-extrabold">Admin login</h1>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Username or email</span>
          <input name="email" type="text" autoCapitalize="none" spellCheck={false} required autoComplete="username" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 font-bold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
