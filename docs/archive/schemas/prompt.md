# Prompt Schemas

> **Canonical source:** `packages/shared/src/types/prompt.ts` (planned)
> **Last verified:** Pre-implementation (schema designed, not yet coded)

Types for structured prompts, context bundles, and LLM composition output.

## StructuredPrompt

The primary output of the prompt composition pipeline. Represents a fully-formed prompt that the user can copy into their LLM coding tool.

```typescript
interface StructuredPrompt {
  /** Unique prompt ID */
  id: string
  /** Original user intent, e.g. "Add Stripe payments with a checkout button" */
  userIntent: string
  /** Service being integrated, e.g. "stripe" */
  service: string
  /** Detected framework, e.g. "nextjs" */
  framework: string
  /** Full prompt content (rendered from sections) */
  content: string
  /** Structured sections that compose the prompt */
  sections: readonly PromptSection[]
  /** Summary of deterministic analysis results */
  analysisSummary: AnalysisSummary
  /** When this prompt was generated */
  createdAt: string
}
```

## PromptSection

Individual sections that compose a structured prompt. Each section has a specific role in guiding the user's LLM coding tool.

```typescript
interface PromptSection {
  /** Section type determines rendering and ordering */
  type: PromptSectionType
  /** Human-readable section title */
  title: string
  /** Section content (markdown-formatted) */
  content: string
}

type PromptSectionType =
  | "context"         // Project context: framework, existing deps, file structure
  | "instructions"    // Step-by-step integration instructions
  | "files"           // Relevant file contents for the LLM to reference
  | "dependencies"    // Packages to install and configuration
  | "configuration"   // Environment variables, config file changes
```

## AnalysisSummary

Summary of the deterministic analysis pipeline results, included in prompts for transparency.

```typescript
interface AnalysisSummary {
  /** Detected framework info */
  framework: {
    name: string
    version: string
  }
  /** Dependencies relevant to the integration */
  relevantDependencies: readonly string[]
  /** Template ID used (if any) */
  templateId: string | null
  /** Existing integrations detected in the project */
  existingIntegrations: readonly string[]
}
```

## ContextBundle

Collection of project files included in the prompt for the user's LLM coding tool to reference.

```typescript
interface ContextBundle {
  /** Files included in the bundle */
  files: readonly ReferencedFile[]
  /** Total size of all file contents in characters */
  totalSize: number
  /** Whether any files were truncated to fit size limits */
  truncated: boolean
}

interface ReferencedFile {
  /** Relative path from project root */
  path: string
  /** File content (may be truncated) */
  content: string
  /** Why this file is relevant to the integration */
  reason: string
  /** Whether this file's content was truncated */
  truncated: boolean
}
```

## Zod Validation

All LLM output is validated using Zod schemas. LLM output is **never** treated as deterministic.

```typescript
import { z } from 'zod'

const PromptSectionSchema = z.object({
  type: z.enum(["context", "instructions", "files", "dependencies", "configuration"]),
  title: z.string().min(1),
  content: z.string().min(1),
})

const StructuredPromptSchema = z.object({
  id: z.string().uuid(),
  userIntent: z.string().min(1),
  service: z.string().min(1),
  framework: z.string().min(1),
  content: z.string().min(1),
  sections: z.array(PromptSectionSchema).min(1),
  analysisSummary: z.object({
    framework: z.object({
      name: z.string(),
      version: z.string(),
    }),
    relevantDependencies: z.array(z.string()),
    templateId: z.string().nullable(),
    existingIntegrations: z.array(z.string()),
  }),
  createdAt: z.string().datetime(),
})
```

### Validation Flow

1. **Parse:** Call `StructuredPromptSchema.safeParse(llmOutput)`
2. **Retry on failure:** If validation fails, send the Zod error messages back to the LLM with correction instructions and retry (max 2 retries)
3. **Fallback:** After 3 total failures, fall back to a template-only prompt (no LLM composition, just deterministic template content)

The fallback ensures users always get a usable prompt, even if the LLM produces invalid output.

---

## Related Links

- [Messages Schema](./messages.md) — `PromptReadyMessage` carries a `StructuredPrompt`
- [Integration Schema](./integration.md) — `IntegrationResult` references `StructuredPrompt` and `ContextBundle`
- [Agent Spec](../spec/agent.md) — Prompt composition pipeline
- [Prompt Pipeline Spec](../spec/prompt-pipeline.md) — Full pipeline specification
- [ADR-004](../adr/004-prompt-generation-over-autonomous-agent.md) — Why prompt generation over autonomous execution
