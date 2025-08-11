# Session Export Schema

This document outlines the JSON schema for exporting and importing session data. The schema is designed to be extensible and versioned to support future enhancements.

## Versioning

The `version` field follows semantic versioning (`MAJOR.MINOR.PATCH`) to ensure backward compatibility.

- **MAJOR**: Incremented for breaking changes that make the schema incompatible with older versions.
- **MINOR**: Incremented for new features that are backward-compatible.
- **PATCH**: Incremented for backward-compatible bug fixes.

## Schema Definition

The root of the exported JSON is a `SerializedSession` object, which contains the task metadata and all associated messages.

```typescript
import { z } from "zod"
import type { HistoryItem, ClineMessage } from "@roo-code/types"

export const SerializedSessionSchema = z.object({
	version: z.string(),
	task: z.custom<HistoryItem>(),
	messages: z.array(z.custom<ClineMessage>()),
})

export type SerializedSession = z.infer<typeof SerializedSessionSchema>
```

### `SerializedSession`

| Field      | Type                  | Description                          |
| ---------- | --------------------- | ------------------------------------ |
| `version`  | `string`              | The schema version (e.g., "1.0.0").  |
| `task`     | `HistoryItem`         | The task metadata.                   |
| `messages` | `Array<ClineMessage>` | An array of messages in the session. |

---

This documentation will be updated as the schema evolves.
