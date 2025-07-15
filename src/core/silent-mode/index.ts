/**
 * Silent Mode - Background file operations without UI interruption
 *
 * This module provides the complete Silent Mode implementation that allows
 * Roo to work in the background without opening files or switching tabs.
 */

export { SilentModeController } from "./SilentModeController"
export { SilentModeDetector } from "./SilentModeDetector"
export { ChangeTracker } from "./ChangeTracker"
export { BufferManager } from "./BufferManager"
export { SilentToolWrapper } from "./SilentToolWrapper"
export { NotificationService } from "./NotificationService"

export type {
	FileOperation,
	SilentResult,
	FileChange,
	ChangeSummary,
	DiffSummary,
	FileChangeSet,
	BufferedFileChange,
	BufferResult,
	FlushResult,
	FileBuffer,
	SilentModeSettings,
	ReviewResult,
} from "./types"
