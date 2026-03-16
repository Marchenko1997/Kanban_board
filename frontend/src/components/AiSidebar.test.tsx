import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AiSidebar } from "@/components/AiSidebar";

describe("AiSidebar", () => {
  it("renders empty-state text", () => {
    render(
      <AiSidebar
        messages={[]}
        isLoading={false}
        errorMessage=""
        onSend={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Ask the assistant to update your board/i)
    ).toBeInTheDocument();
  });

  it("submits user message", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <AiSidebar
        messages={[]}
        isLoading={false}
        errorMessage=""
        onSend={onSend}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/Ask the AI/i),
      "Create a card for API tests"
    );
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(onSend).toHaveBeenCalledWith("Create a card for API tests");
  });
});

