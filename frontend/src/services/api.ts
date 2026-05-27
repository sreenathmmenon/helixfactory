import type { AgentExecution, AIStatus, ArchitectureAnswer, EvidencePackage, GraphCenter, GraphPath, GraphView, NodeContext, NodeSource, NodeSummary, PreMortemResult, Repository, SkillRefinement } from "./types";

const configuredApiBase = import.meta.env.VITE_API_BASE;
const API_BASES = configuredApiBase
  ? [configuredApiBase.replace(/\/$/, "")]
  : import.meta.env.DEV
    ? ["/api", "http://127.0.0.1:8000"]
    : ["/api"];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const errors: string[] = [];
  for (const base of API_BASES) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
        ...options
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        const message = await responseMessage(response, contentType);
        errors.push(`${url}: ${message}`);
        if (base === "/api" && import.meta.env.DEV && [404, 405].includes(response.status)) {
          continue;
        }
        throw new Error(message);
      }
      if (!contentType.includes("application/json")) {
        errors.push(`${url}: expected JSON but received ${contentType || "unknown content type"}`);
        if (base === "/api" && import.meta.env.DEV) {
          continue;
        }
        throw new Error("HelixFactory API returned an unexpected response format.");
      }
      return response.json() as Promise<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : "request failed";
      errors.push(`${url}: ${message}`);
      if (base !== API_BASES[API_BASES.length - 1]) {
        continue;
      }
    }
  }
  throw new Error(`HelixFactory API is not reachable. Tried ${errors.join("; ")}`);
}

async function responseMessage(response: Response, contentType: string): Promise<string> {
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      return payload?.error?.message ?? `${response.status} ${response.statusText}`;
    } catch {
      return `${response.status} ${response.statusText}`;
    }
  }
  return `${response.status} ${response.statusText}`;
}

export const api = {
  aiStatus: (): Promise<AIStatus> => request("/ai/status"),
  ingestRepository: (url: string): Promise<Repository> =>
    request("/repositories/ingest", { method: "POST", body: JSON.stringify({ url }) }),
  getRepository: (repositoryId: string): Promise<Repository> => request(`/repositories/${repositoryId}`),
  queryGraph: (repositoryId: string, center: GraphCenter, depth = 2, relationshipTypes: string[] = []): Promise<GraphView> =>
    request("/graph/query", {
      method: "POST",
      body: JSON.stringify({ repositoryId, center, depth, relationshipTypes })
    }),
  graphOverview: (repositoryId: string): Promise<GraphView> => request(`/graph/overview?repositoryId=${encodeURIComponent(repositoryId)}`),
  askGraph: (repositoryId: string, question: string): Promise<GraphView> =>
    request("/graph/ask", { method: "POST", body: JSON.stringify({ repositoryId, question }) }),
  nodeSummary: (repositoryId: string, nodeId: string): Promise<NodeSummary> =>
    request("/qa/node-summary", { method: "POST", body: JSON.stringify({ repositoryId, nodeId }) }),
  nodeContext: (repositoryId: string, nodeId: string): Promise<NodeContext> =>
    request("/qa/node-context", { method: "POST", body: JSON.stringify({ repositoryId, nodeId }) }),
  nodeSource: (repositoryId: string, nodeId: string): Promise<NodeSource> =>
    request("/qa/node-source", { method: "POST", body: JSON.stringify({ repositoryId, nodeId }) }),
  graphPath: (repositoryId: string, sourceNodeId: string, targetNodeId: string, relationshipTypes: string[] = [], maxDepth = 4): Promise<GraphPath> =>
    request("/graph/path", { method: "POST", body: JSON.stringify({ repositoryId, sourceNodeId, targetNodeId, relationshipTypes, maxDepth }) }),
  runPremortem: (repositoryId: string, summary: string, targetRefs: string[], changeType = "modify"): Promise<PreMortemResult> =>
    request("/changes/premortem", {
      method: "POST",
      body: JSON.stringify({ repositoryId, summary, targetRefs, changeType })
    }),
  blastRadius: (repositoryId: string, summary: string, targetRefs: string[], depth = 2, relationshipTypes: string[] = []): Promise<GraphView> =>
    request("/changes/blast-radius", {
      method: "POST",
      body: JSON.stringify({ repositoryId, summary, targetRefs, changeType: "modify", depth, relationshipTypes })
    }),
  askArchitecture: (repositoryId: string, question: string): Promise<ArchitectureAnswer> =>
    request("/qa/architecture", { method: "POST", body: JSON.stringify({ repositoryId, question }) }),
  evidencePackage: (repositoryId?: string): Promise<EvidencePackage> =>
    request("/audit/evidence-package", { method: "POST", body: JSON.stringify({ repositoryId }) }),
  submitExecution: (repositoryId: string, summary: string): Promise<AgentExecution> =>
    request("/executions", { method: "POST", body: JSON.stringify({ repositoryId, summary }) }),
  proposeSkillRefinement: (executionId: string, patternSummary: string, evidenceRefs: string[]): Promise<SkillRefinement> =>
    request("/skill-refinements", { method: "POST", body: JSON.stringify({ executionId, patternSummary, evidenceRefs }) }),
  approveSkillRefinement: (refinementId: string, reviewer: string): Promise<SkillRefinement> =>
    request(`/skill-refinements/${refinementId}/approve`, { method: "POST", body: JSON.stringify({ reviewer }) }),
  rejectSkillRefinement: (refinementId: string, reviewer: string): Promise<SkillRefinement> =>
    request(`/skill-refinements/${refinementId}/reject`, { method: "POST", body: JSON.stringify({ reviewer }) })
};
