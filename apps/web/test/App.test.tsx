import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders heading properly", () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "ok", uptime: 10, timestamp: new Date().toISOString() }),
      })
    );

    render(<App />);
    expect(screen.getByRole("heading", { name: /expense tracker/i })).toBeInTheDocument();
  });
});