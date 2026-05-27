import { GraphCanvas } from "../graph/GraphCanvas";
import type { PreMortemResult, Repository } from "../services/types";

export function BlastRadiusPage({ repository, preMortem }: { repository?: Repository; preMortem?: PreMortemResult }) {
  return (
    <GraphCanvas repository={repository} preMortem={preMortem} />
  );
}
