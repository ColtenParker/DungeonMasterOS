import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("checks readiness through the relative API path", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Check full stack" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/health/ready");
    expect(
      await screen.findByText("Frontend, API, and PostgreSQL are connected."),
    ).toBeVisible();
  });

  it("shows a safe unavailable state when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network failure"),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Check full stack" }));

    expect(
      await screen.findByText("The API or PostgreSQL is unavailable."),
    ).toBeVisible();
  });
});
