import { ClineMessage } from "@roo-code/types"
import { ClineSayBrowserAction } from "@roo/ExtensionMessage"

/**
 * Represents a group of messages for virtualized rendering
 */
export interface MessageGroup {
	type: "single" | "browser-session"
	messages: ClineMessage[]
	startIndex: number
	endIndex: number
	estimatedHeight?: number
	collapsed?: boolean
	sessionId?: string
}

/**
 * Configuration for message grouping
 */
export interface GroupingConfig {
	maxGroupSize?: number
	collapseThreshold?: number
	visibleBuffer?: number
}

const DEFAULT_CONFIG: GroupingConfig = {
	maxGroupSize: 50,
	collapseThreshold: 10,
	visibleBuffer: 50,
}

/**
 * Creates optimized message groups for virtualization
 * Groups browser sessions and provides placeholders for off-screen content
 */
export function createOptimizedMessageGroups(
	messages: ClineMessage[],
	visibleRange?: { startIndex: number; endIndex: number },
	config: GroupingConfig = DEFAULT_CONFIG,
): MessageGroup[] {
	const groups: MessageGroup[] = []
	let currentBrowserSession: ClineMessage[] = []
	let sessionStartIndex = -1
	let isInBrowserSession = false
	let sessionId = ""

	const { visibleBuffer = 50 } = config

	messages.forEach((message, index) => {
		// Determine if we should process this message based on visible range
		const shouldProcess =
			!visibleRange ||
			(index >= Math.max(0, visibleRange.startIndex - visibleBuffer) &&
				index <= visibleRange.endIndex + visibleBuffer)

		// Handle browser session start
		if (message.ask === "browser_action_launch") {
			// End previous session if any
			if (currentBrowserSession.length > 0) {
				groups.push(
					createBrowserSessionGroup(
						currentBrowserSession,
						sessionStartIndex,
						index - 1,
						sessionId,
						shouldProcess,
					),
				)
			}

			// Start new session
			isInBrowserSession = true
			sessionStartIndex = index
			sessionId = `browser-session-${message.ts}`
			currentBrowserSession = [message]
		}
		// Continue browser session
		else if (isInBrowserSession && isBrowserSessionMessage(message)) {
			currentBrowserSession.push(message)

			// Check for session end
			if (message.say === "browser_action") {
				try {
					const action = JSON.parse(message.text || "{}") as ClineSayBrowserAction
					if (action.action === "close") {
						groups.push(
							createBrowserSessionGroup(
								currentBrowserSession,
								sessionStartIndex,
								index,
								sessionId,
								shouldProcess,
							),
						)
						currentBrowserSession = []
						isInBrowserSession = false
						sessionId = ""
					}
				} catch (_e) {
					// Invalid JSON, continue session
				}
			}
		}
		// Regular message or end of browser session
		else {
			// End browser session if active
			if (currentBrowserSession.length > 0) {
				groups.push(
					createBrowserSessionGroup(
						currentBrowserSession,
						sessionStartIndex,
						index - 1,
						sessionId,
						shouldProcess,
					),
				)
				currentBrowserSession = []
				isInBrowserSession = false
				sessionId = ""
			}

			// Add single message
			if (shouldProcess || isImportantMessage(message)) {
				groups.push({
					type: "single",
					messages: [message],
					startIndex: index,
					endIndex: index,
					estimatedHeight: estimateMessageHeight(message),
				})
			}
		}
	})

	// Handle remaining browser session
	if (currentBrowserSession.length > 0) {
		groups.push(
			createBrowserSessionGroup(currentBrowserSession, sessionStartIndex, messages.length - 1, sessionId, true),
		)
	}

	return groups
}

/**
 * Creates a browser session group with optimization
 */
function createBrowserSessionGroup(
	messages: ClineMessage[],
	startIndex: number,
	endIndex: number,
	sessionId: string,
	shouldRenderFull: boolean,
): MessageGroup {
	const group: MessageGroup = {
		type: "browser-session",
		messages: shouldRenderFull ? messages : messages.slice(0, 3), // Show preview when off-screen
		startIndex,
		endIndex,
		sessionId,
		collapsed: !shouldRenderFull && messages.length > 10,
		estimatedHeight: estimateBrowserSessionHeight(messages, !shouldRenderFull),
	}

	return group
}

/**
 * Check if a message is part of a browser session
 */
function isBrowserSessionMessage(message: ClineMessage): boolean {
	if (message.type === "ask") {
		return ["browser_action_launch"].includes(message.ask || "")
	}

	if (message.type === "say") {
		return ["api_req_started", "text", "browser_action", "browser_action_result"].includes(message.say || "")
	}

	return false
}

/**
 * Check if a message is important and should always be rendered
 */
function isImportantMessage(message: ClineMessage): boolean {
	// Always render error messages
	if (message.say === "error" || message.ask === "api_req_failed") {
		return true
	}

	// Always render active tool requests
	if (message.ask === "tool" && !message.partial) {
		return true
	}

	// Always render completion results
	if (message.ask === "completion_result" || message.say === "completion_result") {
		return true
	}

	return false
}

/**
 * Estimate the height of a single message
 */
function estimateMessageHeight(message: ClineMessage): number {
	const BASE_HEIGHT = 60 // Base height for message chrome
	const CHAR_HEIGHT_FACTOR = 0.15 // Approximate height per character
	const IMAGE_HEIGHT = 200 // Height per image
	const CODE_BLOCK_EXTRA = 40 // Extra height for code blocks

	let height = BASE_HEIGHT

	// Add text height
	if (message.text) {
		const textLength = message.text.length
		height += textLength * CHAR_HEIGHT_FACTOR

		// Check for code blocks
		const codeBlockCount = (message.text.match(/```/g) || []).length / 2
		height += codeBlockCount * CODE_BLOCK_EXTRA
	}

	// Add image heights
	if (message.images && message.images.length > 0) {
		height += message.images.length * IMAGE_HEIGHT
	}

	// Add extra height for certain message types
	if (message.ask === "tool" || message.say === "api_req_started") {
		height += 40 // Tool messages have extra UI
	}

	return Math.round(height)
}

/**
 * Estimate the height of a browser session
 */
function estimateBrowserSessionHeight(messages: ClineMessage[], collapsed: boolean): number {
	if (collapsed) {
		return 120 // Collapsed session shows summary
	}

	// Sum individual message heights
	return messages.reduce((total, msg) => total + estimateMessageHeight(msg), 0) + 40 // Extra for session chrome
}

/**
 * Get visible message indices from groups
 */
export function getVisibleMessageIndices(
	groups: MessageGroup[],
	visibleGroupRange: { startIndex: number; endIndex: number },
): { startIndex: number; endIndex: number } {
	if (groups.length === 0) {
		return { startIndex: 0, endIndex: 0 }
	}

	const startGroup = groups[Math.max(0, visibleGroupRange.startIndex)]
	const endGroup = groups[Math.min(groups.length - 1, visibleGroupRange.endIndex)]

	return {
		startIndex: startGroup?.startIndex || 0,
		endIndex: endGroup?.endIndex || 0,
	}
}

/**
 * Calculate total estimated height of message groups
 */
export function calculateTotalHeight(groups: MessageGroup[]): number {
	return groups.reduce((total, group) => total + (group.estimatedHeight || 100), 0)
}

/**
 * Find group containing a specific message timestamp
 */
export function findGroupByMessageTs(groups: MessageGroup[], messageTs: number): MessageGroup | undefined {
	return groups.find((group) => group.messages.some((msg) => msg.ts === messageTs))
}

/**
 * Optimize groups by merging small adjacent single-message groups
 */
export function optimizeGroups(groups: MessageGroup[], maxMergeSize: number = 5): MessageGroup[] {
	const optimized: MessageGroup[] = []
	let currentMerge: MessageGroup | null = null

	for (const group of groups) {
		if (
			group.type === "single" &&
			currentMerge &&
			currentMerge.messages.length < maxMergeSize &&
			group.startIndex === currentMerge.endIndex + 1
		) {
			// Merge into current group
			currentMerge.messages.push(...group.messages)
			currentMerge.endIndex = group.endIndex
			currentMerge.estimatedHeight = (currentMerge.estimatedHeight || 0) + (group.estimatedHeight || 0)
		} else {
			// Save current merge if any
			if (currentMerge) {
				optimized.push(currentMerge)
			}

			// Start new merge or add non-mergeable group
			if (group.type === "single") {
				currentMerge = { ...group }
			} else {
				optimized.push(group)
				currentMerge = null
			}
		}
	}

	// Don't forget the last merge
	if (currentMerge) {
		optimized.push(currentMerge)
	}

	return optimized
}
