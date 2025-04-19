import * as vscode from "vscode";
import * as path from "path";
import cloneDeep from "clone-deep";
import { Anthropic } from "@anthropic-ai/sdk"; // Assuming Roo uses this for API history structure

import { getContextWindowInfo } from "./context-window-utils";
import { PersistedContextHistory, ContextUpdate } from "./types";
import { readPersistedContextHistory, writePersistedContextHistory } from "../persistenceUtils"; // Use new persistence utils
import { formatResponse } from "../../prompts/responses"; // Use Roo's formatResponse
import { GlobalFileNames } from "../../../shared/globalFileNames"; // Use Roo's GlobalFileNames
import { fileExistsAtPath } from "../../../utils/fs"; // Use Roo's fileExistsAtPath
import { ClineMessage } from "../../../schemas"; // Use Roo's ClineMessage
import { ContextProxy } from "../../config/ContextProxy"; // Use Roo's ContextProxy
import { ModelInfo } from "../../../schemas"; // Use Roo's ModelInfo
import { logger } from "../../../utils/logging"; // Use Roo's logger

// --- Type Definitions (Aligned with PRD) ---

// Note: PersistedContextHistory and ContextUpdate are now imported from './types'

// --- Helper Type for Internal Processing ---
type FileReadOccurrence = {
	messageIndex: number;
	blockIndex: number;
	filePath: string;
	// For file mentions, store the full match to replace later
	fullMatch?: string;
};

// --- Processed Context Result Interface (Aligned with PRD) ---
export interface ProcessedContextResult {
	processedHistory: Anthropic.Messages.MessageParam[]; // History ready for API
	updatedModifications: PersistedContextHistory; // Modifications map including new changes
	tokensUsed: number; // Estimated tokens for processedHistory
	wasTruncated: boolean; // Flag indicating if chronological truncation occurred
}

// --- ContextManager Class ---

export class ContextManager {
	private contextHistoryUpdates: PersistedContextHistory;
	private contextProxy: ContextProxy;
	private taskId: string;
	private tokenizer: (text: string) => number; // Provided tokenizer function
	private truncationPercentage: number; // e.g., 0.5 or 0.75
	private reservedResponseTokens: number; // Tokens reserved for response generation
	private tokenBuffer: number; // Additional buffer

	private currentModelInfo: ModelInfo | null | undefined; // Updated via updateModelInfo

	constructor(
		contextProxy: ContextProxy,
		taskId: string,
		tokenizer: (text: string) => number,
		options: {
			truncationPercentage?: number;
			reservedResponseTokens?: number;
			tokenBuffer?: number;
			currentModelInfo?: ModelInfo | null; // Initial value, updated via updateModelInfo
		} = {}
	) {
		this.contextProxy = contextProxy;
		this.taskId = taskId;
		this.tokenizer = tokenizer;
		this.truncationPercentage = options.truncationPercentage ?? 0.5; // Default to 50%
		this.reservedResponseTokens = options.reservedResponseTokens ?? 1000; // Default buffer
		this.tokenBuffer = options.tokenBuffer ?? 500; // Default buffer
		this.currentModelInfo = options.currentModelInfo; // Store model info
		this.contextHistoryUpdates = {}; // Initialize as empty object
		logger.info(`ContextManager initialized for task ${taskId}`);
	}

	/**
	 * Loads contextHistoryUpdates from disk during initialization.
	 */
	async initializeContextHistory(): Promise<void> {
		this.contextHistoryUpdates = await readPersistedContextHistory(this.contextProxy, this.taskId);
		logger.info(`Initialized context history for task ${this.taskId}. Found ${Object.keys(this.contextHistoryUpdates).length} modified messages.`);
	}

	/**
	 * Saves the current context history updates to disk.
	 */
	private async saveContextHistory(): Promise<void> {
		await writePersistedContextHistory(this.contextProxy, this.taskId, this.contextHistoryUpdates);
		logger.debug(`Saved context history for task ${this.taskId}.`);
	}


	/**
	 * Updates the model information used by the ContextManager.
	 */
	updateModelInfo(newModelInfo: ModelInfo | null | undefined): void {
		if (JSON.stringify(this.currentModelInfo) !== JSON.stringify(newModelInfo)) {
			this.currentModelInfo = newModelInfo;
			logger.info(`ContextManager model info updated for task ${this.taskId}.`);
		}
	}

	/**
	 * Calculates the token count for a given history using the provided tokenizer.
	 * TODO: This is a basic implementation; needs refinement based on actual API message structure and tokenizer behavior.
	 */
	private calculateTokens(history: Anthropic.Messages.MessageParam[]): number {
		let totalTokens = 0;
		for (const message of history) {
			if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "text") {
						totalTokens += this.tokenizer(block.text);
					} else if (block.type === "image") {
						// Using a fixed estimate for image tokens. Refine if model-specific costs are known.
						totalTokens += 1500; // Estimated token count for images
					} else if (block.type === "tool_use") {
					                   // Estimate tool use tokens based on input, name, and basic overhead.
					                   totalTokens += this.tokenizer(block.input ? JSON.stringify(block.input) : '');
					                   totalTokens += this.tokenizer(block.name);
					                   totalTokens += 20; // Overhead for tool structure
					               } else if (block.type === "tool_result") {
					                    // Estimate tool result tokens based on content and basic overhead.
					                   totalTokens += this.tokenizer(block.content ? (typeof block.content === 'string' ? block.content : JSON.stringify(block.content)) : '');
					                   totalTokens += 20; // Overhead for tool structure
					               }
				}
			} else if (typeof message.content === "string") {
				// Handle legacy string content if necessary
				totalTokens += this.tokenizer(message.content);
			}
		}
		return totalTokens;
	}

	/**
	 * Applies modifications from the history updates to the raw conversation history.
	 */
	private applyContextHistoryUpdates(
		rawHistory: Anthropic.Messages.MessageParam[]
	): Anthropic.Messages.MessageParam[] {
		// Deep clone to avoid modifying the original history directly
		const updatedHistory = cloneDeep(rawHistory);

		for (const messageIndexStr in this.contextHistoryUpdates) {
			const messageIndex = parseInt(messageIndexStr, 10);
			if (isNaN(messageIndex) || messageIndex < 0 || messageIndex >= updatedHistory.length) {
				logger.warn(`Invalid message index ${messageIndexStr} found in context history updates.`);
				continue;
			}

			const messageUpdates = this.contextHistoryUpdates[messageIndex];
			const message = updatedHistory[messageIndex];

			if (!message || !Array.isArray(message.content)) {
				logger.warn(`Message at index ${messageIndex} is invalid or has unexpected content format.`);
				continue;
			}

			// Ensure message role matches if needed (though PRD model doesn't strictly enforce this check during application)
			// if (message.role !== messageUpdates.editType) {
			//     logger.warn(`Role mismatch for message index ${messageIndex}. Expected ${messageUpdates.editType}, got ${message.role}`);
			//     // Decide whether to skip or proceed with caution
			// }

			for (const blockIndexStr in messageUpdates.blocks) {
				const blockIndex = parseInt(blockIndexStr, 10);
				if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= message.content.length) {
					logger.warn(`Invalid block index ${blockIndexStr} for message ${messageIndex}.`);
					continue;
				}

				const blockUpdates = messageUpdates.blocks[blockIndex];
				if (!blockUpdates || blockUpdates.length === 0) {
					continue; // No updates for this block
				}

				// Apply the *latest* update for this block
				const latestUpdate = blockUpdates[blockUpdates.length - 1];
				const [timestamp, updateType, newContent, metadata] = latestUpdate;

				const block = message.content[blockIndex];

				if (updateType === 'replace_content') {
					if (block?.type === 'text' && typeof newContent === 'string') {
						block.text = newContent;
					} else {
						logger.warn(`Cannot apply 'replace_content' to block type ${block?.type} at message ${messageIndex}, block ${blockIndex}.`);
					}
				} else if (updateType === 'add_truncation_notice') {
					// Prepend notice to the existing text content
					if (block?.type === 'text') {
						const notice = formatResponse.contextTruncationNotice();
						// Avoid adding duplicate notices
						if (!block.text.startsWith(notice)) {
							block.text = `${notice}\n${block.text}`;
						}
					} else {
						logger.warn(`Cannot add truncation notice to non-text block at message ${messageIndex}, block ${blockIndex}.`);
					}
				} else if (updateType === 'other') {
					// Handle other potential update types if defined in the future
					logger.info(`Encountered 'other' update type at message ${messageIndex}, block ${blockIndex}.`);
				}
			}
		}

		return updatedHistory;
	}


	/**
	 * Identifies duplicate file reads (tool results or mentions) in the history.
	 * Returns a map where keys are file paths and values are arrays of occurrences.
	 */
	private findDuplicateFileReads(
		history: Anthropic.Messages.MessageParam[]
	): Map<string, FileReadOccurrence[]> {
		const fileReads = new Map<string, FileReadOccurrence[]>();

		for (let messageIndex = 0; messageIndex < history.length; messageIndex++) {
			const message = history[messageIndex];

			// Only check user messages for file content
			if (message.role !== "user" || !Array.isArray(message.content)) {
				continue;
			}

			for (let blockIndex = 0; blockIndex < message.content.length; blockIndex++) {
				const block = message.content[blockIndex];

				// Case 1: Check for read_file tool result pattern (simplified)
				// Assumes tool result format might be "[read_file for 'path/file'] Result:" in block 0
				// and file content in block 1. This needs verification against actual Roo tool output.
				if (blockIndex === 0 && block.type === "text") {
					const toolMatch = block.text.match(/^\[read_file for '([^']+)'\] Result:$/);
					if (toolMatch && message.content.length > blockIndex + 1) {
						const nextBlock = message.content[blockIndex + 1];
						if (nextBlock?.type === 'text') { // Check if next block is text content
							const filePath = toolMatch[1];
							const occurrences = fileReads.get(filePath) || [];
							occurrences.push({ messageIndex, blockIndex: blockIndex + 1, filePath }); // Point to the content block
							fileReads.set(filePath, occurrences);
							// Skip the next block since we've processed it as content
                            // blockIndex++; // No, let the outer loop handle incrementing
						}
					}
                    // TODO: Add similar checks for write_to_file, replace_in_file if they include final content
				}

				// Case 2: Check for <file_content path="...">...</file_content> mentions
				if (block.type === "text") {
					const mentionPattern = /<file_content path="([^"]*)">([\s\S]*?)<\/file_content>/g;
					let match;
					while ((match = mentionPattern.exec(block.text)) !== null) {
						const filePath = match[1];
						const fullMatch = match[0]; // The entire <file_content>...</file_content> tag
						const occurrences = fileReads.get(filePath) || [];
						// For mentions, the occurrence points to the block containing the mention
						occurrences.push({ messageIndex, blockIndex, filePath, fullMatch });
						fileReads.set(filePath, occurrences);
					}
				}
			}
		}
		return fileReads;
	}

	/**
	 * Applies duplicate file read optimizations to the history updates map.
	 */
	private applyOptimizations(
		rawHistory: Anthropic.Messages.MessageParam[],
		currentModifications: PersistedContextHistory
	): PersistedContextHistory {
		const updatedModifications = cloneDeep(currentModifications); // Work on a copy
		const fileReads = this.findDuplicateFileReads(rawHistory);
		const timestamp = Date.now();

		for (const [filePath, occurrences] of fileReads.entries()) {
			if (occurrences.length <= 1) {
				continue; // Not a duplicate
			}

			// Keep the last occurrence, modify the others
			for (let i = 0; i < occurrences.length - 1; i++) {
				const occurrence = occurrences[i];
				const { messageIndex, blockIndex, fullMatch } = occurrence;

				// Ensure message index exists in modifications
				if (!updatedModifications[messageIndex]) {
					// Need to know the role of the original message
					const originalMessage = rawHistory[messageIndex];
					if (!originalMessage || (originalMessage.role !== 'user' && originalMessage.role !== 'assistant')) {
						logger.warn(`Cannot determine role for message index ${messageIndex} during optimization.`);
						continue; // Skip if role is unknown
					}
					updatedModifications[messageIndex] = {
						editType: originalMessage.role, // Store the role
						blocks: {},
					};
				}

				// Ensure block index exists
				if (!updatedModifications[messageIndex].blocks[blockIndex]) {
					updatedModifications[messageIndex].blocks[blockIndex] = [];
				}

				const replacementNotice = formatResponse.duplicateFileReadNotice();
				let newContent: string | null = replacementNotice;
				let updateType: ContextUpdate[1] = 'replace_content';
				let metadata: any = { originalPath: filePath };

				// Handle file mention replacement differently
				if (fullMatch) {
					// Find the latest text for this block, either original or from previous updates
					const existingUpdates = updatedModifications[messageIndex].blocks[blockIndex];
					let currentText = "";
					if (existingUpdates && existingUpdates.length > 0) {
						const latestExistingUpdate = existingUpdates[existingUpdates.length - 1];
						if (latestExistingUpdate[1] === 'replace_content' && typeof latestExistingUpdate[2] === 'string') {
							currentText = latestExistingUpdate[2];
						}
					}
					if (!currentText) {
						const originalBlock = rawHistory[messageIndex]?.content?.[blockIndex];
						// Type guard to ensure originalBlock is a TextBlockParam
						if (originalBlock && typeof originalBlock !== 'string' && originalBlock.type === 'text') {
							currentText = originalBlock.text;
						}
					}

					if (currentText) {
						// Replace only the specific mention within the block's text
						const mentionReplacement = `<file_content path="${filePath}">${replacementNotice}</file_content>`;
						newContent = currentText.replace(fullMatch, mentionReplacement);
						metadata.replacedMention = true; // Add metadata indicating it was a mention
					} else {
						logger.warn(`Could not find text to replace mention in message ${messageIndex}, block ${blockIndex}`);
						newContent = replacementNotice; // Fallback
					}
				}

				// Add the new update
				const update: ContextUpdate = [timestamp, updateType, newContent, metadata];
				updatedModifications[messageIndex].blocks[blockIndex].push(update);
			}
		}

		return updatedModifications;
	}

    /**
	 * Applies chronological truncation if needed.
	 */
	private applyTruncation(
	       historyToTruncate: Anthropic.Messages.MessageParam[],
	       currentModifications: PersistedContextHistory,
	       maxTokens: number,
	       previousRequestTokenCount: number // Add parameter for previous request's token count
	   ): { truncatedHistory: Anthropic.Messages.MessageParam[]; updatedModifications: PersistedContextHistory; wasTruncated: boolean } {

        let truncatedHistory = historyToTruncate; // Start with the potentially optimized history
        let updatedModifications = currentModifications;
        let wasTruncated = false;
        const timestamp = Date.now();

        // FR7: Base truncation decision on the previous request's token count
        if (previousRequestTokenCount > maxTokens) {
            logger.info(`Previous request token count (${previousRequestTokenCount}) exceeds limit (${maxTokens}). Applying truncation.`);
            wasTruncated = true;

            // Calculate current tokens *after* deciding to truncate, to potentially adjust removal amount if needed
            let currentTokens = this.calculateTokens(truncatedHistory);
            // Optionally, refine the number of messages to remove based on currentTokens vs maxTokens difference,
            // but the primary trigger is previousRequestTokenCount. Keeping percentage-based removal for now.

            // --- Calculate Truncation Range ---
            // We always keep the first user-assistant pairing (indices 0, 1).
            const startIndexToConsider = 2;
            const numMessages = truncatedHistory.length;
            const numMessagesToConsider = numMessages - startIndexToConsider;

            if (numMessagesToConsider > 0) {
                // Calculate how many messages to remove (must be an even number to keep pairs)
                let messagesToRemove = Math.ceil(numMessagesToConsider * this.truncationPercentage);
                if (messagesToRemove % 2 !== 0) {
                    messagesToRemove++; // Ensure even number
                }
                messagesToRemove = Math.min(messagesToRemove, numMessagesToConsider); // Don't remove more than available

                const endIndexToRemove = startIndexToConsider + messagesToRemove - 1; // Inclusive index

                // --- Create New History Array (excluding truncated messages) ---
                const preservedFirstPair = truncatedHistory.slice(0, startIndexToConsider);
                const remainingMessages = truncatedHistory.slice(endIndexToRemove + 1);
                truncatedHistory = [...preservedFirstPair, ...remainingMessages];

                // --- Add Truncation Notice ---
                // Add notice to the first block of the *first assistant message* (index 1)
                const firstAssistantMessageIndex = 1;
                if (truncatedHistory.length > firstAssistantMessageIndex) {
                     if (!updatedModifications[firstAssistantMessageIndex]) {
                        const originalMessage = historyToTruncate[firstAssistantMessageIndex]; // Get role from original
                         if (!originalMessage || originalMessage.role !== 'assistant') {
                             logger.warn(`Cannot add truncation notice: Message at index ${firstAssistantMessageIndex} is not an assistant message.`);
                         } else {
                            updatedModifications[firstAssistantMessageIndex] = { editType: 'assistant', blocks: {} };
                         }
                    }

                    // Ensure block 0 exists for the notice
                    if (updatedModifications[firstAssistantMessageIndex]) { // Check if modification object exists
                        if (!updatedModifications[firstAssistantMessageIndex].blocks[0]) {
                            updatedModifications[firstAssistantMessageIndex].blocks[0] = [];
                        }
                        // Check if the latest update isn't already a truncation notice
                        const blockUpdates = updatedModifications[firstAssistantMessageIndex].blocks[0];
                        const latestUpdate = blockUpdates[blockUpdates.length -1];
                        if (!latestUpdate || latestUpdate[1] !== 'add_truncation_notice') {
                            const noticeUpdate: ContextUpdate = [timestamp, 'add_truncation_notice', null];
                            updatedModifications[firstAssistantMessageIndex].blocks[0].push(noticeUpdate);
                        }
                    }
                } else {
                     logger.warn("Cannot add truncation notice: History is too short after truncation.");
                }

                 // --- Adjust Modification Indices ---
                 // Indices in `updatedModifications` after `endIndexToRemove` need shifting down.
                 const newModifications: PersistedContextHistory = {};
                 for (const indexStr in updatedModifications) {
                     const originalIndex = parseInt(indexStr, 10);
                     if (originalIndex < startIndexToConsider) {
                         // Keep modifications for the first pair as is
                         newModifications[originalIndex] = updatedModifications[originalIndex];
                     } else if (originalIndex > endIndexToRemove) {
                         // Shift index down
                         const newIndex = originalIndex - messagesToRemove;
                         newModifications[newIndex] = updatedModifications[originalIndex];
                     }
                     // Modifications for messages within the removed range are discarded
                 }
                 updatedModifications = newModifications;


            } else {
                 logger.warn("Truncation needed, but not enough messages to remove after preserving the first pair.");
            }
        }


        return { truncatedHistory, updatedModifications, wasTruncated };
    }


	/**
	 * Main method called by Cline.ts to process history before an API call.
	 * Applies optimizations and truncation based on token limits.
	 */
	async processHistoryForApi(
		rawApiConversationHistory: Anthropic.Messages.MessageParam[],
		clineMessages: ClineMessage[], // Needed for previous token calculation
	       previousRequestTokenCount: number // Add parameter for previous request's token count
	): Promise<ProcessedContextResult> {

		// 1. Apply Optimizations (Duplicate File Reads)
		// Apply to a temporary copy of modifications to avoid altering the main state yet
		let optimizedModifications = this.applyOptimizations(rawApiConversationHistory, this.contextHistoryUpdates);
        let historyAfterOptimizations = this.applyContextHistoryUpdates(rawApiConversationHistory); // Apply *all* current updates first
        historyAfterOptimizations = this.applyModificationsToHistory(historyAfterOptimizations, optimizedModifications); // Apply the new optimizations


		// 2. Determine Token Limit (ModelInfo is updated via updateModelInfo before this method is called)
		const { contextWindow, maxAllowedSize: calculatedMaxAllowedSize } = getContextWindowInfo(this.currentModelInfo);
		      // Adjust max size further by subtracting reserved response tokens and buffer
		      const maxTokensForContext = calculatedMaxAllowedSize - this.reservedResponseTokens - this.tokenBuffer;

        if (maxTokensForContext <= 0) {
            logger.error(`Calculated maxTokensForContext is invalid (${maxTokensForContext}). Check model info and buffer settings.`);
            // Return raw history or handle error appropriately
             return {
                processedHistory: rawApiConversationHistory,
                updatedModifications: this.contextHistoryUpdates, // No changes applied
                tokensUsed: this.calculateTokens(rawApiConversationHistory),
                wasTruncated: false,
            };
        }

		// 3. Apply Truncation if Necessary
        const {
            truncatedHistory: finalHistory,
            updatedModifications: finalModifications,
            wasTruncated
        } = this.applyTruncation(historyAfterOptimizations, optimizedModifications, maxTokensForContext, previousRequestTokenCount); // Pass previous count


		// 4. Calculate Final Token Count
		const finalTokensUsed = this.calculateTokens(finalHistory);

        // 5. Persist final modifications if they changed
        // Simple comparison; consider deep comparison if necessary
        if (JSON.stringify(this.contextHistoryUpdates) !== JSON.stringify(finalModifications)) {
            this.contextHistoryUpdates = finalModifications; // Update the instance state
            await this.saveContextHistory();
        }


		// 6. Return Result
		return {
			processedHistory: finalHistory,
			updatedModifications: this.contextHistoryUpdates, // Return the current state
			tokensUsed: finalTokensUsed,
			wasTruncated: wasTruncated,
		};
	}

    /**
     * Helper to apply a set of modifications to a history array.
     * This is needed because applyContextHistoryUpdates reads from the instance's state,
     * but we need to apply intermediate modifications during processing.
     */
    private applyModificationsToHistory(
        history: Anthropic.Messages.MessageParam[],
        modifications: PersistedContextHistory
    ): Anthropic.Messages.MessageParam[] {
         // Deep clone to avoid modifying the input history directly
		const updatedHistory = cloneDeep(history);

		for (const messageIndexStr in modifications) {
			const messageIndex = parseInt(messageIndexStr, 10);
			if (isNaN(messageIndex) || messageIndex < 0 || messageIndex >= updatedHistory.length) {
				continue; // Skip invalid index
			}

			const messageUpdates = modifications[messageIndex];
			const message = updatedHistory[messageIndex];

			if (!message || !Array.isArray(message.content)) {
				continue; // Skip invalid message format
			}

			for (const blockIndexStr in messageUpdates.blocks) {
				const blockIndex = parseInt(blockIndexStr, 10);
				if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= message.content.length) {
					continue; // Skip invalid block index
				}

				const blockUpdates = messageUpdates.blocks[blockIndex];
				if (!blockUpdates || blockUpdates.length === 0) {
					continue; // No updates for this block
				}

				// Apply the *latest* update for this block
				const latestUpdate = blockUpdates[blockUpdates.length - 1];
				const [_timestamp, updateType, newContent, _metadata] = latestUpdate;
				const block = message.content[blockIndex];

				if (updateType === 'replace_content') {
					if (block?.type === 'text' && typeof newContent === 'string') {
						block.text = newContent;
					}
				} else if (updateType === 'add_truncation_notice') {
					if (block?.type === 'text') {
						const notice = formatResponse.contextTruncationNotice();
						if (!block.text.startsWith(notice)) {
							block.text = `${notice}\n${block.text}`;
						}
					}
				}
			}
		}
		return updatedHistory;
    }


	/**
	 * Removes context history updates that occurred after the specified timestamp.
	 * This is used for checkpoint restoration.
	 */
	async truncateHistoryUpdatesAtTimestamp(timestamp: number): Promise<void> {
		const originalModificationsString = JSON.stringify(this.contextHistoryUpdates);
        const newModifications: PersistedContextHistory = {};

		for (const messageIndexStr in this.contextHistoryUpdates) {
            const messageIndex = parseInt(messageIndexStr, 10);
			const messageData = this.contextHistoryUpdates[messageIndex];
            const newBlocks: { [blockIndex: number]: ContextUpdate[] } = {};
            let blockAdded = false;

			for (const blockIndexStr in messageData.blocks) {
                const blockIndex = parseInt(blockIndexStr, 10);
				const updates = messageData.blocks[blockIndex];
				const validUpdates = updates.filter(update => update[0] <= timestamp);

				if (validUpdates.length > 0) {
					newBlocks[blockIndex] = validUpdates;
                    blockAdded = true;
				}
			}
            // Only add message entry if it still has valid blocks
            if (blockAdded) {
                 newModifications[messageIndex] = {
                    editType: messageData.editType,
                    blocks: newBlocks
                 };
            }
		}

        // Update state and save only if changes occurred
        if (JSON.stringify(newModifications) !== originalModificationsString) {
            this.contextHistoryUpdates = newModifications;
            await this.saveContextHistory();
             logger.info(`Truncated context history updates at timestamp ${timestamp} for task ${this.taskId}.`);
        }
	}
}
