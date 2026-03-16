import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BoardDashboard } from "@/components/BoardDashboard";
import type { BoardMeta } from "@/lib/kanban";

const boards: BoardMeta[] = [
  { id: 1, name: "Sprint 1", updated_at: "2024-01-01T00:00:00" },
  { id: 2, name: "Backlog", updated_at: "2024-01-02T00:00:00" },
];

describe("BoardDashboard", () => {
  it("renders a list of boards", () => {
    render(
      <BoardDashboard
        username="alice"
        boards={boards}
        onOpenBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("shows username in header", () => {
    render(
      <BoardDashboard
        username="alice"
        boards={[]}
        onOpenBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("calls onOpenBoard when a board is clicked", async () => {
    const onOpen = vi.fn();
    render(
      <BoardDashboard
        username="alice"
        boards={boards}
        onOpenBoard={onOpen}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    await userEvent.click(screen.getByText("Sprint 1"));
    expect(onOpen).toHaveBeenCalledWith(boards[0]);
  });

  it("shows empty state when no boards", () => {
    render(
      <BoardDashboard
        username="alice"
        boards={[]}
        onOpenBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
  });

  it("shows create form when new board button clicked", async () => {
    render(
      <BoardDashboard
        username="alice"
        boards={[]}
        onOpenBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    expect(screen.getByLabelText(/board name/i)).toBeInTheDocument();
  });

  it("calls onCreateBoard with the entered name", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <BoardDashboard
        username="alice"
        boards={[]}
        onOpenBoard={vi.fn()}
        onCreateBoard={onCreate}
        onDeleteBoard={vi.fn()}
        onLogout={vi.fn()}
        isCreating={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByLabelText(/board name/i), "My Project");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledWith("My Project");
  });

  it("calls onLogout when sign out is clicked", async () => {
    const onLogout = vi.fn();
    render(
      <BoardDashboard
        username="alice"
        boards={[]}
        onOpenBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
        onLogout={onLogout}
        isCreating={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
