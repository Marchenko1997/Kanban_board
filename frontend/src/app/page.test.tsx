import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Home from "@/app/page";
import { initialData, type BoardMeta } from "@/lib/kanban";

const FAKE_TOKEN = "header.payload.signature";

const mockBoards: BoardMeta[] = [
  { id: 1, name: "My Board", updated_at: "2024-01-01T00:00:00" },
];

function setupFetchMock({
  loginFails = false,
}: { loginFails?: boolean } = {}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;

    if (url.includes("/api/auth/login")) {
      if (loginFails) {
        return new Response(
          JSON.stringify({ detail: "Invalid username or password." }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ token: FAKE_TOKEN, username: "user" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/auth/register")) {
      return new Response(
        JSON.stringify({ token: FAKE_TOKEN, username: "newuser" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.endsWith("/api/boards") && !url.match(/\/api\/boards\/\d+/)) {
      return new Response(JSON.stringify(mockBoards), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.match(/\/api\/boards\/\d+$/)) {
      return new Response(
        JSON.stringify({ id: 1, name: "My Board", board: initialData, updated_at: "2024-01-01T00:00:00" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unhandled URL in test mock: ${url}`);
  });
}

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the sign-in form before authentication", async () => {
    render(<Home />);
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    setupFetchMock({ loginFails: true });
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password."
    );
  });

  it("logs in with valid credentials and can log out", async () => {
    setupFetchMock();
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/^password$/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // After login, dashboard shows
    expect(await screen.findByRole("heading", { name: /my boards/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-auth-v2")).not.toBeNull();

    // Log out
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("pm-auth-v2")).toBeNull();
  });

  it("shows register form when switching to create account", async () => {
    render(<Home />);
    const switchBtn = await screen.findByRole("button", { name: /create one/i });
    await userEvent.click(switchBtn);
    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("registers a new user successfully", async () => {
    setupFetchMock();
    render(<Home />);

    await userEvent.click(await screen.findByRole("button", { name: /create one/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "newuser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "newpass1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: /my boards/i })).toBeInTheDocument();
  });

  it("shows error when passwords do not match on register", async () => {
    render(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: /create one/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "newuser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "pass1234");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "different");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
  });
});
