import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Home from "@/app/page";
import { initialData } from "@/lib/kanban";

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!url.includes("/api/users/user/board")) {
        throw new Error(`Unhandled URL in test mock: ${url}`);
      }

      if (!init || !init.method || init.method === "GET") {
        return new Response(JSON.stringify(initialData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response((init.body as string) ?? JSON.stringify(initialData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the sign-in form before authentication", async () => {
    render(<Home />);
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password."
    );
  });

  it("logs in with valid credentials and can log out", async () => {
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-authenticated")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-authenticated")).toBeNull();
  });
});
