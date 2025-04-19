/**
 * Represents a single modification applied to a message block.
 * Based on PRD Section 10.
 */
export type ContextUpdate = [
  timestamp: number, // When the modification was applied
  updateType: 'replace_content' | 'add_truncation_notice' | 'other', // Type of modification
  content: string | null, // New content (e.g., replacement note) or null if not applicable
  metadata?: any // Optional metadata (e.g., original file path for replaced content)
];

/**
 * Represents the structure stored in context_history.json.
 * Maps message index to block index to an array of updates.
 * Based on PRD Section 10.
 */
export interface PersistedContextHistory {
  [messageIndex: number]: { // Key: Index in the raw apiConversationHistory
    editType: 'assistant' | 'user'; // Type of message being edited
    blocks: {
      [blockIndex: number]: ContextUpdate[]; // Key: Index within the message's content blocks
    };
  };
}