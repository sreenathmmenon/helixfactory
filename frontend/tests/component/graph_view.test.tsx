import { describe, expect, it } from "vitest";
import { illuminated } from "../../src/graph/interactions";

describe("graph interactions", () => {
  it("illuminates hovered relationships while preserving stable nodes", () => {
    const nodes = [{ id: "a", position: { x: 0, y: 0 }, data: {} }, { id: "b", position: { x: 1, y: 1 }, data: {} }];
    const edges = [{ id: "e1", source: "a", target: "b" }];
    const result = illuminated(nodes, edges, "a");
    expect(result.edges[0].animated).toBe(true);
    expect(result.nodes.find((node) => node.id === "b")?.className).toBe("opacity-100");
  });
});
