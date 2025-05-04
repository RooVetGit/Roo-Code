import { ClineMessage } from "@roo/shared/ExtensionMessage"
import React from "react" // Added missing React import for RefObject

// --- findPreviousCheckpointIndex function (existing, correct) ---
export function findPreviousCheckpointIndex(
	messages: (ClineMessage | ClineMessage[])[],
	currentCheckpointTs: number,
): number {
	// ... (implementation as previously read) ...
	console.log("Finding previous checkpoint for ts:", currentCheckpointTs)
	const currentIndex = messages.findIndex(
		(item) => !Array.isArray(item) && item.say === "checkpoint_saved" && item.ts === currentCheckpointTs,
	)
	console.log("Current checkpoint index:", currentIndex)
	if (currentIndex <= 0) {
		console.log("No previous checkpoint found (current is first or not found)")
		return -1
	}
	for (let i = currentIndex - 1; i >= 0; i--) {
		const item = messages[i]
		if (!Array.isArray(item) && item.say === "checkpoint_saved") {
			console.log("Found previous checkpoint at index:", i)
			return i
		}
	}
	console.log("No previous checkpoint found after searching")
	return -1
}

// --- findLastCheckpointIndex function (existing, correct) ---
export function findLastCheckpointIndex(messages: (ClineMessage | ClineMessage[])[]): number {
	// ... (implementation as previously read) ...
	console.log("Finding last checkpoint in message list")
	for (let i = messages.length - 1; i >= 0; i--) {
		const item = messages[i]
		if (!Array.isArray(item) && item.say === "checkpoint_saved") {
			console.log("Found last checkpoint at index:", i)
			return i
		}
	}
	console.log("No checkpoint found in message list")
	return -1
}

// --- jumpToLastCheckpoint function (existing, correct) ---
export function jumpToLastCheckpoint(
	virtuosoRef: React.RefObject<any>,
	messages: (ClineMessage | ClineMessage[])[],
	onScrollComplete?: () => void,
): boolean {
	// ... (implementation as previously read) ...
	console.log("Jump to last checkpoint requested")
	const lastCheckpointIndex = findLastCheckpointIndex(messages)
	if (lastCheckpointIndex !== -1) {
		jumpToCheckpoint(virtuosoRef, lastCheckpointIndex, onScrollComplete)
		return true
	}
	console.log("No checkpoint found to jump to")
	return false
}

// --- jumpToCheckpoint function (existing, correct) ---
export function jumpToCheckpoint(
	virtuosoRef: React.RefObject<any>,
	index: number,
	onScrollComplete?: () => void,
): void {
	// ... (implementation as previously read) ...
	console.log("Jump to checkpoint called with index:", index)
	if (index !== -1 && virtuosoRef.current) {
		console.log("Virtuoso ref exists, attempting to scroll to index:", index)
		virtuosoRef.current.scrollToIndex({
			index: index,
			align: "start",
			behavior: "smooth",
		})
		console.log("Scroll to index command sent to Virtuoso")
		if (onScrollComplete) {
			setTimeout(onScrollComplete, 500) // Allow time for smooth scroll
		}
	} else {
		console.log("Cannot jump: index is -1 or virtuosoRef is null", {
			index,
			virtuosoRefExists: !!virtuosoRef.current,
		})
	}
}

// --- jumpToPreviousCheckpoint function (existing, correct, optional for this feature) ---
export function jumpToPreviousCheckpoint(
	virtuosoRef: React.RefObject<any>,
	messages: (ClineMessage | ClineMessage[])[],
	currentCheckpointTs?: number,
	onScrollComplete?: () => void,
): boolean {
	// ... (implementation as previously read) ...
	console.log("Jump to previous checkpoint requested")
	let targetIndex: number
	if (currentCheckpointTs) {
		console.log("Current checkpoint timestamp:", currentCheckpointTs)
		targetIndex = findPreviousCheckpointIndex(messages, currentCheckpointTs)
	} else {
		console.log("No current checkpoint, finding last checkpoint")
		targetIndex = findLastCheckpointIndex(messages)
	}
	if (targetIndex !== -1) {
		jumpToCheckpoint(virtuosoRef, targetIndex, onScrollComplete)
		return true
	}
	console.log("No previous checkpoint found to jump to")
	return false
}
