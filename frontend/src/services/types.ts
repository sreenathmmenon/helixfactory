export type Risk = "none" | "low" | "medium" | "high" | "critical" | "blocked_insufficient_evidence";

export interface Repository {
  id: string;
  url: string;
  ingestionStatus: "pending" | "in_progress" | "partial" | "complete" | "failed";
  supportedLanguages: string[];
  nodeCount?: number;
  edgeCount?: number;
  failureReason?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  owner?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  connectionCount: number;
  isEntryPoint: boolean;
  risk: Risk;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: "exact" | "inferred" | "partial";
  evidencePath?: string;
  evidenceLine?: number;
}

export type GraphCenter = { type: "query" | "node" | "proposed_change"; value: string };

export interface GraphView {
  center: GraphCenter;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  riskSummary: Record<string, number>;
}

export interface NodeSummary {
  nodeId: string;
  summary: string;
}

export interface NodeSource {
  nodeId: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  snippet: string;
  unavailableReason?: string;
}

export interface NodeRelationshipGroup {
  relationship: string;
  direction: "incoming" | "outgoing";
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeContext {
  node: GraphNode;
  relationshipGroups: NodeRelationshipGroup[];
  evidenceEdges: GraphEdge[];
}

export interface GraphPath {
  source: GraphNode;
  target: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  explanation: string;
  confidence: "exact" | "inferred" | "partial";
}

export interface PreMortemFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  consequence: string;
  filePath: string;
  line: number;
  dependencyChain: string[];
  ownerContext?: string;
  preventiveCheck: string;
}

export interface PreMortemResult {
  changeId: string;
  riskStatus: "low" | "medium" | "high" | "critical" | "blocked_insufficient_evidence";
  findings: PreMortemFinding[];
  evidenceGaps: string[];
  requiresHumanApproval: boolean;
  auditRecordId: string;
}

export type ChangeType = "add" | "modify" | "rename" | "delete" | "database" | "interface" | "infrastructure" | "dependency";

export interface SafetyReviewRequest {
  repositoryId: string;
  summary: string;
  targetRefs: string[];
  changeType: ChangeType;
  scenarioId?: string;
}

export interface SafetyReviewDecision {
  status: "allow" | "block";
  reason: string;
}

export interface SafetyReviewResult {
  id: string;
  repositoryId: string;
  changeId: string;
  scenarioId?: string;
  summary: string;
  changeType: ChangeType;
  targetRefs: string[];
  premortem: PreMortemResult;
  blastRadius: GraphView;
  decision: SafetyReviewDecision;
  evidenceRefs: string[];
  suggestedChecks: string[];
  confidence: "high" | "medium" | "low";
  evidenceCompleteness: "complete" | "partial" | "insufficient";
  approvalStatus: "not_required" | "required" | "approved" | "rejected" | "blocked";
  auditRecordId: string;
  createdAt: string;
}

export interface SafetyReviewDecisionResult {
  reviewId: string;
  approvalStatus: "approved" | "rejected";
  reviewer: string;
  reason: string;
  auditRecordId: string;
  decidedAt: string;
}

export interface ArchitectureAnswer {
  answer: string;
  citations: Array<{ sourceType: string; sourceRef: string; path?: string; line?: number }>;
  uncertainty: string[];
}

export interface EvidencePackage {
  records: AuditRecord[];
  completenessStatus: "unknown" | "incomplete" | "requires_attention" | "complete";
  missingActions: string[];
  chronologicalChain: string[];
}

export interface AuditRecord {
  id: string;
  actionType: string;
  actor: string;
  subjectRef: string;
  inputRefs: string[];
  outputRefs: string[];
  summary: string;
  result: "success" | "partial" | "blocked" | "failed";
  details: Record<string, string | number | boolean | string[]>;
  timestamp: string;
  gitCommit: string;
}

export interface AgentExecution {
  id: string;
  status: "queued" | "collecting_context" | "risk_checking" | "executing" | "reviewing" | "blocked" | "completed" | "failed";
  contextRefs: string[];
  testEvidence?: string;
  pullRequestRef?: string;
  failureReason?: string;
}

export interface SkillRefinement {
  id: string;
  agentExecutionId: string;
  patternSummary: string;
  evidenceRefs: string[];
  proposalText: string;
  status: "proposed" | "approved" | "rejected" | "merged";
  reviewer?: string;
}

export interface AIStatus {
  enabled: boolean;
  provider: string;
  model?: string | null;
  deepModel?: string | null;
  reason?: string | null;
  lastError?: string | null;
}
