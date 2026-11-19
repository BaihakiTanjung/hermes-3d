"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      if (response.ok) {
        window.location.assign("/");
        return;
      }
      setError(response.status === 429 ? "Terlalu banyak percobaan. Tunggu sebentar." : "Username atau password salah. Periksa lalu coba lagi.");
    } catch {
      setError("Tidak dapat terhubung. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-scene" aria-label="Hermes3D sign in">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />
      <div className="login-shell">
        <div className="login-brand"><span className="login-mark">H</span><span>HERMES<span className="login-brand-light">3D</span></span></div>
        <div className="login-copy"><div className="login-eyebrow"><span /> PRIVATE OPERATOR SPACE</div><h1>Your studio,<br /><em>in focus.</em></h1><p>Connect to your workspace with your username and password.</p></div>
        <div className="login-card">
          <div className="login-card-top"><div className="login-lock"><LockKeyhole size={18} /></div><span className="login-secure"><i /> SECURE SESSION</span></div>
          <h2>Welcome back</h2><p className="login-hint">Enter your username and password to continue.</p>
          <form onSubmit={submit}>
            <label htmlFor="studio-username">USERNAME</label>
            <input id="studio-username" name="username" type="text" autoComplete="username" required autoFocus placeholder="admin" />
            <label htmlFor="studio-password">PASSWORD</label>
            <div className="login-input-wrap"><input id="studio-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? "VERIFYING…" : <>Enter studio <ArrowRight size={17} /></>}</button>
          </form>
          <div className="login-card-foot"><span>🔒</span> Credentials stay in Kubernetes.</div>
        </div>
        <footer className="login-footer"><span>HERMES3D · PRIVATE WORKSPACE</span><span>ACCESS BY INVITATION</span></footer>
      </div>
      <div className="login-visual" aria-hidden="true"><div className="login-ring ring-a" /><div className="login-ring ring-b" /><div className="login-ring ring-c" /><div className="login-core"><div className="login-core-inner">H</div></div><span className="login-label label-top">AGENT NETWORK <b>● ONLINE</b></span><span className="login-label label-bottom">PRIVATE BY DESIGN <b>EST. HERMES</b></span><span className="login-node node-a" /><span className="login-node node-b" /><span className="login-node node-c" /></div>
    </section>
  );
}
