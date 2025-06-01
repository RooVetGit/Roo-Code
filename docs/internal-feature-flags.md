# Internal Feature Flags Guide

## Overview

Internal feature flags in Roo Code are designed for controlled rollout of architectural changes, refactors, and experimental features. These flags are primarily enabled in nightly builds and gradually rolled out to stable versions once proven.

## Philosophy

- **Not user-facing**: These flags primarily control internal behavior, however in specific cases they can also be used to test user-facing features
- **Nightly-first**: New features are tested in nightly builds before stable
- **Simple lifecycle**: Nightly → Stable → Removed (no alpha/beta stages)
- **Developer-focused**: Primarily for the development team, not end users

## Key Concepts

### Internal vs NightlyDefault

- **`internal`**: Controls visibility - whether the flag appears in the user settings UI
- **`nightlyDefault`**: Controls the default value specifically in nightly builds

These properties work independently:

1. **`internal: true, nightlyDefault: true`** - Hidden from users, auto-enabled in nightly (most common for refactors)
2. **`internal: false, nightlyDefault: true`** - Visible to users, on by default in nightly (good for user-facing features needing feedback)
3. **`internal: true, nightlyDefault: false`** - Hidden from users, off even in nightly (for very experimental features)
4. **`internal: false, nightlyDefault: false`** - Standard experimental feature, users can enable if they want

## Implementation

### 1. Define Internal Feature Flags

Add to `packages/types/src/experiment.ts`:

```typescript
export const experimentIds = [
	// Existing experiments
	"powerSteering",
	"concurrentFileReads",

	// Internal feature flags (prefix with underscore for clarity)
	"_improvedFileReader",
	"_asyncToolExecution",
	"_enhancedDiffStrategy",
	"_experimentalCaching",
] as const
```

### 2. Configure in Experiments System

In `src/shared/experiments.ts`:

```typescript
import type { AssertEqual, Equals, Keys, Values, ExperimentId } from "@roo-code/types"

export const EXPERIMENT_IDS = {
	// User-facing experiments
	POWER_STEERING: "powerSteering",
	CONCURRENT_FILE_READS: "concurrentFileReads",

	// Internal flags (use underscore prefix)
	_IMPROVED_FILE_READER: "_improvedFileReader",
	_ASYNC_TOOL_EXECUTION: "_asyncToolExecution",
	_ENHANCED_DIFF_STRATEGY: "_enhancedDiffStrategy",
	_EXPERIMENTAL_CACHING: "_experimentalCaching",
} as const satisfies Record<string, ExperimentId>

interface ExperimentConfig {
	enabled: boolean
	internal?: boolean // Mark as internal
	nightlyDefault?: boolean // Enable by default in nightly
	description?: string
}

export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
	// User-facing experiments
	POWER_STEERING: { enabled: false },
	CONCURRENT_FILE_READS: { enabled: false },

	// Internal flags
	_IMPROVED_FILE_READER: {
		enabled: false,
		internal: true,
		nightlyDefault: true,
		description: "Internal: Optimized file reading with streaming and caching",
	},
	_ASYNC_TOOL_EXECUTION: {
		enabled: false,
		internal: true,
		nightlyDefault: true,
		description: "Internal: Parallel tool execution for better performance",
	},
	// ... other internal flags
}
```

### 3. Nightly Build Configuration

Create a nightly defaults system:

```typescript
// src/shared/experiments.ts
export function getExperimentDefaults(isNightly: boolean = false): Record<ExperimentId, boolean> {
	const defaults: Record<ExperimentId, boolean> = {}

	Object.entries(experimentConfigsMap).forEach(([key, config]) => {
		const experimentId = EXPERIMENT_IDS[key as keyof typeof EXPERIMENT_IDS]

		if (isNightly && config.nightlyDefault) {
			defaults[experimentId] = true
		} else {
			defaults[experimentId] = config.enabled
		}
	})

	return defaults
}

// Check if running nightly build
export function isNightlyBuild(): boolean {
	// Check package name from extension context
	const extensionId = vscode.extensions.getExtension("RooVeterinaryInc.roo-cline")?.id
	return extensionId?.includes("nightly") ?? false
}

// Update experimentDefault to use nightly defaults when appropriate
export const experimentDefault = getExperimentDefaults(isNightlyBuild())
```

### 4. Hide Internal Flags from UI

Modify the settings UI to hide internal flags:

```typescript
// webview-ui/src/components/settings/ExperimentalSettings.tsx
<Section>
  {Object.entries(experimentConfigsMap)
    .filter((config) => {
      // Filter out internal experiments (those starting with underscore)
      const experimentId = EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]
      return !experimentId.startsWith('_')
    })
    .map((config) => {
      // Render only user-facing experiments
      return (
        <ExperimentalFeature
          key={config[0]}
          experimentKey={config[0]}
          enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
          onChange={(enabled) =>
            setExperimentEnabled(EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS], enabled)
          }
        />
      )
    })}
</Section>
```

## CI/CD Integration

### 1. Nightly Build Workflow

Update `.github/workflows/nightly-publish.yml`:

```yaml
- name: Enable Internal Feature Flags
  run: |
      # Set environment variable for nightly build
      echo "ROO_CODE_NIGHTLY=true" >> $GITHUB_ENV

      # Log enabled experiments
      node scripts/log-experiments.js --nightly
```

### 2. Validation Script (Optional)

Create `scripts/validate-internal-flags.js`:

```javascript
#!/usr/bin/env node

const { EXPERIMENT_IDS, experimentConfigsMap } = require("../src/shared/experiments")

// Validate internal flags
const internalFlags = Object.entries(experimentConfigsMap)
	.filter(([_, config]) => config.internal)
	.map(([key, config]) => ({
		key,
		id: EXPERIMENT_IDS[key],
		...config,
	}))

console.log(`Found ${internalFlags.length} internal feature flags:`)
internalFlags.forEach(({ id, nightlyDefault }) => {
	console.log(`  - ${id}: nightlyDefault=${nightlyDefault}`)
})

// Ensure internal flags are prefixed
const invalidFlags = internalFlags.filter(({ id }) => !id.startsWith("_"))
if (invalidFlags.length > 0) {
	console.error("❌ Internal flags must start with underscore:")
	invalidFlags.forEach(({ id }) => console.error(`  - ${id}`))
	process.exit(1)
}

console.log("✅ All internal flags are properly configured")
```

### 3. Gradual Rollout Process

```typescript
// src/shared/experiments.ts
export interface InternalExperimentConfig extends ExperimentConfig {
	internal: boolean
	nightlyDefault: boolean
	stableRolloutDate?: string // When to enable in stable
	removalDate?: string // When to remove the flag
}
```

## Monitoring and Telemetry

### 1. Track Internal Flag Usage

Using the existing TelemetryService from `@roo-code/telemetry`:

```typescript
// src/core/tools/readFileTool.ts
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

export async function readFileWithExperiment(
	path: string,
	experiments: Record<ExperimentId, boolean>,
	taskId: string,
): Promise<string> {
	const useImprovedReader = experiments.isEnabled(experiments, EXPERIMENT_IDS._IMPROVED_FILE_READER)

	const start = Date.now()
	let error: Error | null = null

	try {
		const content = useImprovedReader ? await readFileImproved(path) : await readFileLegacy(path)

		// Track success metrics
		TelemetryService.instance.captureEvent(TelemetryEventName.INTERNAL_EXPERIMENT_SUCCESS, {
			taskId,
			experiment: "_improvedFileReader",
			duration: Date.now() - start,
			fileSize: content.length,
		})

		return content
	} catch (e) {
		error = e as Error

		// Track failure metrics
		TelemetryService.instance.captureEvent(TelemetryEventName.INTERNAL_EXPERIMENT_ERROR, {
			taskId,
			experiment: "_improvedFileReader",
			error: error.message,
		})

		// Fallback to legacy implementation
		return readFileLegacy(path)
	}
}
```

### 2. Performance Comparison in Task Execution

```typescript
// src/core/task/Task.ts
import { TelemetryService } from "@roo-code/telemetry"

private async executeToolWithMetrics(
  toolName: ToolName,
  toolParams: any
): Promise<ToolResult> {
  const useAsyncExecution = experiments.isEnabled(
    this.options.experiments,
    EXPERIMENT_IDS._ASYNC_TOOL_EXECUTION
  )

  const start = Date.now()

  try {
    const result = useAsyncExecution
      ? await this.executeToolAsync(toolName, toolParams)
      : await this.executeToolSync(toolName, toolParams)

    // Track tool execution metrics
    TelemetryService.instance.captureToolUsage(this.taskId, toolName)

    // Additional metrics for experimental features
    if (useAsyncExecution) {
      TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
        taskId: this.taskId,
        experiment: "_asyncToolExecution",
        tool: toolName,
        duration: Date.now() - start,
        success: true
      })
    }

    return result
  } catch (error) {
    // Track failures
    if (useAsyncExecution) {
      TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
        taskId: this.taskId,
        experiment: "_asyncToolExecution",
        tool: toolName,
        duration: Date.now() - start,
        success: false,
        error: error.message
      })
    }
    throw error
  }
}
```

## Lifecycle Management

### 1. Introduction (Nightly Only)

```typescript
// Initial state
{
  id: "_improvedFileReader",
  internal: true,
  enabled: false,
  nightlyDefault: true,
  stableRolloutDate: "2025-02-01"
}
```

### 2. Stable Rollout

```typescript
// After testing in nightly
{
  id: "_improvedFileReader",
  internal: true,
  enabled: true, // Now enabled by default
  nightlyDefault: true,
  removalDate: "2025-03-01" // Plan for removal
}
```

### 3. Flag Removal

After the feature is stable:

1. Remove the flag checks from code
2. Remove the experiment definition
3. Update CHANGELOG.md

## Best Practices

1. **Prefix with underscore**: All internal flags should start with `_`
2. **No UI exposure**: Internal flags should not appear in settings
3. **Measure impact**: Always add telemetry to compare old vs new
4. **Set timelines**: Define rollout and removal dates
5. **Document changes**: Keep a log of what each flag controls
6. **Clean up promptly**: Remove flags once features are stable
7. **Use existing telemetry**: Leverage `TelemetryService` from `@roo-code/telemetry`

## Testing Strategy

### 1. Unit Tests

```typescript
// src/core/tools/__tests__/readFileTool.test.ts
import { TelemetryService } from "@roo-code/telemetry"

describe("File Reader with internal flags", () => {
	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}
	})

	it("should use legacy reader when flag is disabled", async () => {
		const experiments = { _improvedFileReader: false }
		const spy = jest.spyOn(FileReader.prototype as any, "readFileLegacy")

		await readFile("test.txt", experiments)

		expect(spy).toHaveBeenCalled()
	})

	it("should use improved reader when flag is enabled", async () => {
		const experiments = { _improvedFileReader: true }
		const spy = jest.spyOn(FileReader.prototype as any, "readFileImproved")

		await readFile("test.txt", experiments)

		expect(spy).toHaveBeenCalled()
	})
})
```

### 2. Nightly-Specific Tests

```typescript
// e2e/nightly/internal-features.test.ts
describe("Nightly Internal Features", () => {
	beforeAll(() => {
		process.env.ROO_CODE_NIGHTLY = "true"
	})

	test("internal flags are enabled by default", () => {
		const defaults = getExperimentDefaults(true)
		expect(defaults._improvedFileReader).toBe(true)
		expect(defaults._asyncToolExecution).toBe(true)
	})
})
```

## Migration Checklist

When moving an internal feature from nightly to stable:

- [ ] Feature has been in nightly for at least 2 weeks
- [ ] No critical bugs reported
- [ ] Performance metrics are acceptable (check telemetry)
- [ ] Error rates are within tolerance
- [ ] Update `enabled: true` in experiment config
- [ ] Set `removalDate` for flag cleanup
- [ ] Update CHANGELOG.md
- [ ] Notify team of rollout

## Usage Examples

### Example 1: Refactoring File Reading with Concurrent Reads

```typescript
// src/core/tools/readFileTool.ts
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import type { ExperimentId } from "@roo-code/types"

export async function readFiles(
	paths: string[],
	experiments: Record<ExperimentId, boolean>,
): Promise<Map<string, string>> {
	const useConcurrentReads = experiments.isEnabled(experiments, EXPERIMENT_IDS.CONCURRENT_FILE_READS)

	if (useConcurrentReads) {
		// Read files in parallel
		const results = await Promise.all(
			paths.map(async (path) => ({
				path,
				content: await readFileContent(path),
			})),
		)
		return new Map(results.map((r) => [r.path, r.content]))
	} else {
		// Read files sequentially
		const results = new Map<string, string>()
		for (const path of paths) {
			results.set(path, await readFileContent(path))
		}
		return results
	}
}
```

### Example 2: Enhanced Diff Strategy

```typescript
// src/core/diff/strategies/multi-search-replace.ts
import { experiments, EXPERIMENT_IDS } from "../../../shared/experiments"
import { DiffStrategy } from "../../../shared/tools"

export class MultiSearchReplaceDiffStrategy {
	constructor(private experiments: Record<ExperimentId, boolean>) {}

	async applyDiff(content: string, diff: string): Promise<string> {
		const useEnhancedStrategy = experiments.isEnabled(this.experiments, EXPERIMENT_IDS._ENHANCED_DIFF_STRATEGY)

		if (useEnhancedStrategy) {
			// New implementation with better conflict resolution
			return this.applyEnhancedDiff(content, diff)
		} else {
			// Current stable implementation
			return this.applyStandardDiff(content, diff)
		}
	}
}
```

## Complete Implementation Example

### Step 1: Update Type Definitions

```typescript
// packages/types/src/experiment.ts
import { z } from "zod"

export const experimentIds = [
	"powerSteering",
	"concurrentFileReads",
	// Add new internal flag
	"_enhancedDiffStrategy",
] as const

export const experimentsSchema = z.object({
	powerSteering: z.boolean(),
	concurrentFileReads: z.boolean(),
	// Add schema for new flag
	_enhancedDiffStrategy: z.boolean(),
})
```

### Step 2: Update Experiments Configuration

```typescript
// src/shared/experiments.ts
import type { AssertEqual, Equals, Keys, Values, ExperimentId } from "@roo-code/types"

export const EXPERIMENT_IDS = {
	POWER_STEERING: "powerSteering",
	CONCURRENT_FILE_READS: "concurrentFileReads",
	// Add new internal flag constant
	_ENHANCED_DIFF_STRATEGY: "_enhancedDiffStrategy",
} as const satisfies Record<string, ExperimentId>

export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
	POWER_STEERING: { enabled: false },
	CONCURRENT_FILE_READS: { enabled: false },
	// Add configuration for internal flag
	_ENHANCED_DIFF_STRATEGY: {
		enabled: false,
		internal: true,
		nightlyDefault: true,
		description: "Internal: Improved diff application with better conflict resolution",
	},
}
```

### Step 3: Update UI to Filter Internal Flags

```typescript
// webview-ui/src/components/settings/ExperimentalSettings.tsx
import { experimentConfigsMap, EXPERIMENT_IDS } from "../../../src/shared/experiments"

<Section>
  {Object.entries(experimentConfigsMap)
    .filter(([key, config]) => {
      // Filter out internal experiments
      const experimentId = EXPERIMENT_IDS[key as keyof typeof EXPERIMENT_IDS]
      return !experimentId.startsWith('_')
    })
    .map(([key, config]) => {
      const experimentId = EXPERIMENT_IDS[key as keyof typeof EXPERIMENT_IDS]
      return (
        <ExperimentalFeature
          key={key}
          experimentKey={key}
          enabled={experiments[experimentId] ?? false}
          onChange={(enabled) => setExperimentEnabled(experimentId, enabled)}
        />
      )
    })}
</Section>
```

### Step 4: Use the Internal Flag in Code

```typescript
// src/core/tools/applyDiffTool.ts
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import { TelemetryService } from "@roo-code/telemetry"
import type { ExperimentId } from "@roo-code/types"

export async function applyDiff(
	cline: Task,
	filePath: string,
	diffContent: string,
	experiments: Record<ExperimentId, boolean>,
): Promise<void> {
	const useEnhancedStrategy = experiments.isEnabled(experiments, EXPERIMENT_IDS._ENHANCED_DIFF_STRATEGY)

	const start = Date.now()

	try {
		if (useEnhancedStrategy) {
			// New implementation with better conflict resolution
			await applyEnhancedDiff(filePath, diffContent)
		} else {
			// Current stable implementation
			await applyStandardDiff(filePath, diffContent)
		}

		// Track success
		if (useEnhancedStrategy) {
			TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
				taskId: cline.taskId,
				experiment: "_enhancedDiffStrategy",
				duration: Date.now() - start,
				success: true,
			})
		}
	} catch (error) {
		// Track failure and capture diff application error
		TelemetryService.instance.captureDiffApplicationError(cline.taskId, 1)

		if (useEnhancedStrategy) {
			TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
				taskId: cline.taskId,
				experiment: "_enhancedDiffStrategy",
				duration: Date.now() - start,
				success: false,
				error: error.message,
			})
		}

		throw error
	}
}
```

### Step 5: Add Telemetry Integration

```typescript
// packages/types/src/telemetry.ts
export enum TelemetryEventName {
  // ... existing events
  EXPERIMENT_METRIC = "experiment_metric",
  INTERNAL_EXPERIMENT_SUCCESS = "internal_experiment_success",
  INTERNAL_EXPERIMENT_ERROR = "internal_experiment_error",
}

// src/core/task/Task.ts
import { TelemetryService } from "@roo-code/telemetry"

private async executeToolWithExperiment(
  toolName: ToolName,
  toolParams: any
): Promise<void> {
  const useAsyncExecution = experiments.isEnabled(
    this.options.experiments,
    EXPERIMENT_IDS._ASYNC_TOOL_EXECUTION
  )

  if (useAsyncExecution) {
    const start = Date.now()
    try {
      await this.executeToolAsync(toolName, toolParams)

      // Track async execution success
      TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
        taskId: this.taskId,
        experiment: "_asyncToolExecution",
        tool: toolName,
        duration: Date.now() - start,
        success: true
      })
    } catch (error) {
      // Track async execution failure
      TelemetryService.instance.captureEvent(TelemetryEventName.EXPERIMENT_METRIC, {
        taskId: this.taskId,
        experiment: "_asyncToolExecution",
        tool: toolName,
        duration: Date.now() - start,
        success: false,
        error: error.message
      })
      throw error
    }
  } else {
    await this.executeToolSync(toolName, toolParams)
  }
}
```

### Step 6: Testing

```typescript
// src/core/tools/__tests__/applyDiffTool.test.ts
import { TelemetryService } from "@roo-code/telemetry"
import { applyDiff } from "../applyDiffTool"

describe("Apply Diff with internal flags", () => {
	let mockCline: any

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		mockCline = {
			taskId: "test-task-123",
			say: jest.fn(),
			ask: jest.fn(),
		}
	})

	it("uses standard diff when flag is disabled", async () => {
		const experiments = { _enhancedDiffStrategy: false }
		const spy = jest.spyOn(global as any, "applyStandardDiff")

		await applyDiff(mockCline, "test.ts", "diff content", experiments)

		expect(spy).toHaveBeenCalled()
	})

	it("uses enhanced diff when flag is enabled", async () => {
		const experiments = { _enhancedDiffStrategy: true }
		const spy = jest.spyOn(global as any, "applyEnhancedDiff")

		await applyDiff(mockCline, "test.ts", "diff content", experiments)

		expect(spy).toHaveBeenCalled()
	})

	it("tracks telemetry for enhanced diff", async () => {
		const experiments = { _enhancedDiffStrategy: true }
		const telemetrySpy = jest.spyOn(TelemetryService.instance, "captureEvent")

		await applyDiff(mockCline, "test.ts", "diff content", experiments)

		expect(telemetrySpy).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				taskId: "test-task-123",
				experiment: "_enhancedDiffStrategy",
				success: true,
			}),
		)
	})
})
```

### Manual Testing in Development

```typescript
// For testing, temporarily enable the flag in development
// src/extension.ts
if (process.env.NODE_ENV === "development") {
	// Override specific internal flags for testing
	experimentDefault._enhancedDiffStrategy = true
}
```

## Rollout Timeline

1. **Week 1-2**: Deploy to nightly builds only
2. **Week 3-4**: Monitor telemetry, fix any issues
3. **Week 5**: Enable by default in stable (change `enabled: true`)
4. **Week 8**: Remove flag and make permanent

## Cleanup Process

When removing a flag after stable rollout:

- [ ] Remove from `experimentIds` in types
- [ ] Remove from `EXPERIMENT_IDS` constant
- [ ] Remove from `experimentConfigsMap`
- [ ] Remove conditional logic in code
- [ ] Update tests to remove flag checks
- [ ] Add entry to CHANGELOG.md documenting the change
