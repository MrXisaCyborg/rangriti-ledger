import { useEffect, useState } from "react";

const PIN_KEY = "rangriti.pin";
const UNLOCK_KEY = "rangriti.unlocked";

export function getStoredPin() {
  if (typeof window === "undefined") return "0000";
  return localStorage.getItem(PIN_KEY) || "0000";
}
export function setStoredPin(pin: string) {
  localStorage.setItem(PIN_KEY, pin);
}

export function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === getStoredPin()) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass-strong rounded-3xl p-10 w-full max-w-sm text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Rangriti Creations</div>
        <h1 className="font-display text-3xl mb-1">Ledger</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter your 4-digit PIN</p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/\D/g, "").slice(0,4)); setError(false); }}
          className="glass-input w-full text-center text-3xl tracking-[1em] py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="••••"
        />
        {error && <p className="text-destructive text-sm mt-3">Incorrect PIN</p>}
        <button
          type="submit"
          className="mt-6 w-full py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
        >
          Unlock
        </button>
        <p className="text-xs text-muted-foreground mt-4">Default PIN is 0000 — change it inside.</p>
      </form>
    </div>
  );
}

export function lockSession() {
  sessionStorage.removeItem(UNLOCK_KEY);
  window.location.reload();
}
