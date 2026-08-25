import type { BusinessEffectContract, EffectObservation, Transaction } from "@flowcommit/core";

export interface ExecutionContext {
  transaction: Transaction;
  contract: BusinessEffectContract;
  signal?: AbortSignal;
  credentials?: Record<string, string>;
}

export interface PreparedExecution {
  executor: string;
  proposal: Record<string, unknown>;
  proposalHash: string;
  expiresAt?: string;
}

export interface ExecutionResult {
  status: "EXECUTED" | "UNKNOWN_EFFECT" | "FAILED";
  externalReference?: string;
  output?: Record<string, unknown>;
  retrySafe: boolean;
  error?: { code: string; message: string };
}

export interface ExecutorAdapter {
  readonly name: string;
  readonly kind: "API" | "CONNECTOR" | "STRUCTURED_BROWSER" | "RPA" | "AI_ASSISTED" | "VISION_AGENT" | "HUMAN";
  discoverCapabilities(): Promise<string[]>;
  validate(context: ExecutionContext): Promise<void>;
  prepare(context: ExecutionContext): Promise<PreparedExecution>;
  execute(context: ExecutionContext, prepared: PreparedExecution): Promise<ExecutionResult>;
  cancel?(context: ExecutionContext, externalReference?: string): Promise<void>;
  status?(context: ExecutionContext, externalReference: string): Promise<ExecutionResult>;
  compensate?(context: ExecutionContext, result: ExecutionResult): Promise<ExecutionResult>;
  health(): Promise<{ healthy: boolean; detail?: string }>;
}

export interface VerifierContext {
  transaction: Transaction;
  contract: BusinessEffectContract;
  effectId: string;
  executionResult?: ExecutionResult;
  credentials?: Record<string, string>;
  signal?: AbortSignal;
}

export interface VerifierAdapter {
  readonly name: string;
  verify(context: VerifierContext): Promise<EffectObservation>;
  health(): Promise<{ healthy: boolean; detail?: string }>;
}

export interface PolicyProvider {
  evaluate(input: Record<string, unknown>): Promise<{
    allow: boolean;
    reason?: string;
    requiredApprovals?: Array<{ role: string; count: number }>;
    allowedExecutors?: string[];
    requiredVerifiers?: string[];
  }>;
}
