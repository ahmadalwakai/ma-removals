"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { colors } from "@/lib/tokens";

function DriverLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // If admin redirected because of wrong role
  const roleError = searchParams.get("error") === "role";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Contact admin if you need access.");
        setLoading(false);
        return;
      }

      // Fetch session to verify role
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json() as { user?: { role?: string } };

      if (session?.user?.role !== "DRIVER") {
        setError("This login is for drivers only. Please use the admin portal if you are an admin.");
        setLoading(false);
        return;
      }

      router.push("/driver/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "white",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.midnight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#1E293B",
        borderRadius: 20,
        padding: "40px 32px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, ${colors.emerald}, #2563EB)`,
            borderRadius: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
            fontSize: 26,
          }}>
            🚛
          </div>
          <h1 style={{
            color: "white",
            fontSize: 22,
            fontWeight: 800,
            margin: 0,
            fontFamily: "var(--font-heading)",
          }}>
            MA Removals
          </h1>
          <p style={{ color: colors.emerald, fontSize: 13, margin: "6px 0 0", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Driver Portal
          </p>
        </div>

        {/* Role error banner */}
        {roleError && !error && (
          <div style={{
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: "12px 14px",
            color: "#fcd34d",
            fontSize: 13,
            marginBottom: 20,
          }}>
            Access restricted. Please log in with your driver account.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "12px 14px",
              color: "#fca5a5",
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="driver@example.com"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500 }}>
                Password
              </label>
              <a href="/auth/forgot-password" style={{ color: colors.emerald, fontSize: 12, textDecoration: "none" }}>
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading ? "#2563EB" : colors.emerald,
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.75 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign in to Driver Portal"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 24 }}>
          Contact admin if you need access · MA Removals &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function DriverLoginPage() {
  return (
    <Suspense>
      <DriverLoginForm />
    </Suspense>
  );
}
