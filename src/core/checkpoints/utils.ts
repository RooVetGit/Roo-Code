/**
 * Checkpoint-related utilities and type definitions
 */

/**
 * Represents a valid checkpoint with required properties
 */
export interface ValidCheckpoint {
	hash: string
}

/**
 * Type guard to check if an object is a valid checkpoint
 * @param checkpoint - The object to check
 * @returns True if the checkpoint is valid, false otherwise
 */
export function isValidCheckpoint(checkpoint: unknown): checkpoint is ValidCheckpoint {
	return (
		checkpoint !== null &&
		checkpoint !== undefined &&
		typeof checkpoint === "object" &&
		"hash" in checkpoint &&
		typeof (checkpoint as any).hash === "string" &&
		(checkpoint as any).hash.length > 0 // Ensure hash is not empty
	)
}

/**
 * Validates if a message has a valid checkpoint for restoration
 * @param message - The message object to check
 * @returns True if the message contains a valid checkpoint, false otherwise
 */
export function hasValidCheckpoint(message: unknown): message is { checkpoint: ValidCheckpoint } {
	if (!message || typeof message !== "object" || !("checkpoint" in message)) {
		return false
	}

	return isValidCheckpoint((message as any).checkpoint)
}

/**
 * Extracts a valid checkpoint from a message if it exists
 * @param message - The message object to extract from
 * @returns The valid checkpoint or undefined
 */
export function extractCheckpoint(message: unknown): ValidCheckpoint | undefined {
	if (hasValidCheckpoint(message)) {
		return message.checkpoint
	}
	return undefined
}
