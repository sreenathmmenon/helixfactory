import { GraphCanvas } from "../graph/GraphCanvas";
import type { PreMortemResult, Repository } from "../services/types";

export function BlastRadiusPage({ repository, preMortem, intent = "twin" }: { repository?: Repository; preMortem?: PreMortemResult; intent?: "twin" | "impact" }) {
  return (
    <GraphCanvas repository={repository} preMortem={preMortem} intent={intent} />
  );
}
