/**
 * @fileoverview Automated workflow detection utilities for preserving chat focus during AI operations.
 *
 * This module provides utilities to detect when the AI is actively processing tasks, which is used
 * to determine whether file operations should preserve chat focus to prevent interruption of user
 * input or accidental exposure of sensitive information like API keys.
 *
 * Created as part of the fix for GitHub issue #4574: "chatbox loses focus during automated workflow"
 *
 * @author Roo Code Team
 * @since v3.19.7
 */

import type { Task } from "../core/task/Task"
import type { ClineProvider } from "../core/webview/ClineProvider"
import { ClineProvider as ClineProviderClass } from "../core/webview/ClineProvider"

/**
 * Detects if we are currently in an automated workflow where the AI is actively processing.
 *
 * This utility function addresses GitHub issue #4574 - preventing chatbox focus loss during
 * automated file editing workflows. When the AI is actively working (streaming, processing,
 * or auto-approving), opening files should preserve chat focus to prevent accidental
 * interruption of user input or API key exposure.
 *
 * An automated workflow is detected when:
 * - AI is actively streaming responses (`isStreaming === true`)
 * - AI is waiting for the first chunk of a response (`isWaitingForFirstChunk === true`)
 * - Auto-approval is enabled and the task hasn't completed reading/processing
 *   (`autoApprovalEnabled && didCompleteReadingStream === false`)
 * - Auto-approval is enabled and the assistant message is locked for processing
 *   (`autoApprovalEnabled && presentAssistantMessageLocked === true`)
 *
 * @example
 * ```typescript
 * // Basic usage with explicit task and settings
 * const shouldPreserveFocus = isInAutomatedWorkflow(currentTask, autoApprovalEnabled);
 * openFile(filePath, { preserveFocus: shouldPreserveFocus });
 *
 * // Used in webview message handlers
 * if (isInAutomatedWorkflow(task, autoApproval)) {
 *   // Preserve focus during automated operations
 *   openFile(path, { preserveFocus: true });
 * }
 * ```
 *
 * @param currentTask - The current active task, if any. Can be null/undefined when no task is active.
 * @param autoApprovalEnabled - Whether auto-approval mode is currently enabled in the UI settings.
 * @returns true if we're in an automated workflow and should preserve focus to prevent interruption
 * @since v3.19.7 - Added as part of focus preservation fix for issue #4574
 */
export function isInAutomatedWorkflow(currentTask: Task | null | undefined, autoApprovalEnabled: boolean): boolean {
	return !!(
		currentTask &&
		(currentTask.isStreaming ||
			currentTask.isWaitingForFirstChunk ||
			(autoApprovalEnabled && currentTask.didCompleteReadingStream === false) ||
			(autoApprovalEnabled && currentTask.presentAssistantMessageLocked === true))
	)
}

/**
 * Convenience function for detecting automated workflows using a ClineProvider instance.
 *
 * This function extracts the current task and auto-approval state directly from the
 * provider's context, making it easier to use in components that have access to a
 * ClineProvider instance.
 *
 * @example
 * ```typescript
 * // In webview message handlers where provider is available
 * const shouldPreserveFocus = isInAutomatedWorkflowFromProvider(provider);
 * openFile(message.text!, {
 *   ...(message.values as OpenFileOptions),
 *   preserveFocus: shouldPreserveFocus,
 * });
 * ```
 *
 * @param provider - The ClineProvider instance to get current task and settings from
 * @returns true if we're in an automated workflow and should preserve focus
 * @since v3.19.7 - Added as part of focus preservation fix for issue #4574
 */
export function isInAutomatedWorkflowFromProvider(provider: ClineProvider): boolean {
	const currentTask = provider.getCurrentCline()
	const autoApprovalEnabled = provider.contextProxy.getValue("autoApprovalEnabled") as boolean
	return isInAutomatedWorkflow(currentTask, autoApprovalEnabled)
}

/**
 * Convenience function for detecting automated workflows from the currently visible provider.
 *
 * This function is particularly useful for components like file mention handlers that
 * don't have direct access to a ClineProvider instance but need to determine if they're
 * in an automated workflow context. It uses the static `getVisibleInstance()` method
 * to access the currently active provider.
 *
 * @example
 * ```typescript
 * // In mention handlers or other components without provider access
 * export async function openMention(mention?: string): Promise<void> {
 *   if (mention?.startsWith('/')) {
 *     const shouldPreserveFocus = isInAutomatedWorkflowFromVisibleProvider();
 *     openFile(absPath, { preserveFocus: shouldPreserveFocus });
 *   }
 * }
 * ```
 *
 * @returns true if we're in an automated workflow and should preserve focus,
 *          false if no visible provider exists or not in automated workflow
 * @since v3.19.7 - Added as part of focus preservation fix for issue #4574
 */
export function isInAutomatedWorkflowFromVisibleProvider(): boolean {
	const visibleProvider = ClineProviderClass.getVisibleInstance()
	if (!visibleProvider) {
		return false
	}
	return isInAutomatedWorkflowFromProvider(visibleProvider)
}
