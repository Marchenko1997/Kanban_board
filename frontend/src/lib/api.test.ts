import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoard, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads board data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchBoard("user");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/users/user/board",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.columns).toHaveLength(initialData.columns.length);
  });

  it("saves board data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await saveBoard("user", initialData);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/users/user/board",
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.cards["card-1"].title).toBe(initialData.cards["card-1"].title);
  });
});

