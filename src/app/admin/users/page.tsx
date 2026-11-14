"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/browser";
import { useRole } from "@/components/admin/AdminGate";
import { btn, ConfirmButton, input, Panel } from "@/components/admin/ui";
import type { Role } from "@/lib/staff";

type User = { id: string; login: string; role: Role; lastSignIn: string | null; me: boolean };

const ROLE_HELP: Record<Role, string> = {
  admin: "Full access: events, design, forms, emails, registrations and users.",
  moderator: "Can view registrations and receipts, confirm or reject them, add notes and export. Can't edit events or delete anything.",
};

export default function UsersPage() {
  const role = useRole();
  const [users, setUsers] = useState<User[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ login: "", password: "", role: "moderator" as Role });
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const call = useCallback(async (method: string, body?: object) => {
    const res = await authFetch("/api/staff", { method, body: body && JSON.stringify(body) });
    const out = await res.json().catch(() => ({ error: "Something went wrong" }));
    return res.ok ? { ok: true as const, out } : { ok: false as const, error: out.error as string };
  }, []);

  const load = useCallback(() => call("GET").then((r) => (r.ok ? setUsers(r.out.users) : setMsg({ ok: false, text: r.error }))), [call]);
  useEffect(() => { if (role === "admin") load(); }, [role, load]);

  if (role !== "admin") return <p className="p-10 text-center text-sm text-slate-500">Only admins can manage users.</p>;

  async function run(method: string, body: object, success: string) {
    setBusy(true);
    setMsg(null);
    const r = await call(method, body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: success } : { ok: false, text: r.error });
    if (r.ok) await load();
    return r.ok;
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold">Users</h1>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <Panel title="Add a user">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (await run("POST", form, `${form.login} can now sign in as ${form.role === "admin" ? "an admin" : "a moderator"}.`)) setForm({ login: "", password: "", role: "moderator" });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Username (or email)</span>
              <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required autoCapitalize="none" spellCheck={false} autoComplete="off" placeholder="e.g. juan.delacruz" className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Password (8+ characters)</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" className={input} />
            </label>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium text-slate-700">Role</legend>
            {(["moderator", "admin"] as Role[]).map((r) => (
              <label key={r} className="flex items-start gap-2">
                <input type="radio" name="role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} className="mt-1 h-4 w-4 accent-blue-600" />
                <span><b>{r === "admin" ? "Admin" : "Moderator"}</b> <span className="text-slate-500">— {ROLE_HELP[r]}</span></span>
              </label>
            ))}
          </fieldset>
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Saving…" : "Create user"}</button>
          <p className="text-xs text-slate-500">Share the username and password with them privately. They sign in at /admin.</p>
        </form>
      </Panel>

      <Panel title="People with access">
        {!users ? <p className="text-sm text-slate-500">Loading…</p> : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{u.login} {u.me && <span className="text-xs font-normal text-slate-500">(you)</span>}</p>
                    <p className="text-xs text-slate-500">{u.lastSignIn ? `Last signed in ${new Date(u.lastSignIn).toLocaleString()}` : "Hasn't signed in yet"}</p>
                  </div>
                  <select value={u.role} disabled={u.me || busy} aria-label={`Role for ${u.login}`}
                    onChange={(e) => run("PATCH", { id: u.id, role: e.target.value }, `${u.login} is now ${e.target.value === "admin" ? "an admin" : "a moderator"}.`)}
                    className={`${input} max-w-36`}>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                  <button type="button" className={btn} onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPassword(""); }}>Reset password</button>
                  {!u.me && <ConfirmButton label="Remove" question={`Remove ${u.login}? They won't be able to sign in anymore.`} confirmLabel="Yes, remove" onConfirm={() => run("DELETE", { id: u.id }, `${u.login} was removed.`)} />}
                </div>
                {resetFor === u.id && (
                  <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run("PATCH", { id: u.id, password: newPassword }, `Password changed for ${u.login}.`)) setResetFor(null);
                  }}>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="New password (8+ characters)" aria-label={`New password for ${u.login}`} className={`${input} max-w-72`} />
                    <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Save password</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
