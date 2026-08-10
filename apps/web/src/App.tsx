import { useState } from "react";

type HealthState = "idle" | "checking" | "ready" | "unavailable";

export function App() {
  const [health, setHealth] = useState<HealthState>("idle");

  async function checkSystem() {
    setHealth("checking");

    try {
      const response = await fetch("/api/health/ready");
      setHealth(response.ok ? "ready" : "unavailable");
    } catch {
      setHealth("unavailable");
    }
  }

  return (
    <main>
      <section className="shell">
        <p className="eyebrow">Milestone 0</p>
        <h1>Dungeon Master OS</h1>
        <p>A local-first campaign workspace is taking shape.</p>
        <button
          type="button"
          onClick={() => void checkSystem()}
          disabled={health === "checking"}
        >
          {health === "checking" ? "Checking…" : "Check full stack"}
        </button>
        <p role="status" aria-live="polite">
          {health === "idle" &&
            "Ready to test the API and PostgreSQL connection."}
          {health === "checking" && "Contacting the API…"}
          {health === "ready" && "Frontend, API, and PostgreSQL are connected."}
          {health === "unavailable" && "The API or PostgreSQL is unavailable."}
        </p>
      </section>
    </main>
  );
}
