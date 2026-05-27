export type InteractionNode = {
  id: string;
  className?: string;
  [key: string]: unknown;
};

export type InteractionEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  [key: string]: unknown;
};

export function illuminated(nodes: InteractionNode[], edges: InteractionEdge[], hoveredId?: string): { nodes: InteractionNode[]; edges: InteractionEdge[] } {
  if (!hoveredId) {
    return { nodes, edges };
  }
  const related = new Set([hoveredId]);
  for (const edge of edges) {
    if (edge.source === hoveredId || edge.target === hoveredId) {
      related.add(edge.source);
      related.add(edge.target);
    }
  }
  return {
    nodes: nodes.map((node) => ({ ...node, className: related.has(node.id) ? "opacity-100" : "opacity-30" })),
    edges: edges.map((edge) => ({ ...edge, animated: edge.source === hoveredId || edge.target === hoveredId }))
  };
}
