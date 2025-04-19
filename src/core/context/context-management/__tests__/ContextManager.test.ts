// Removed duplicate import
import { Anthropic } from "@anthropic-ai/sdk";
import cloneDeep from "clone-deep";
import { ContextManager, ProcessedContextResult } from "../ContextManager";
import { PersistedContextHistory, ContextUpdate } from "../types";
import * as persistenceUtils from "../../persistenceUtils";
import * as contextWindowUtils from "../context-window-utils";
import * as responses from "../../../prompts/responses";
import { logger } from "../../../../utils/logging"; // Corrected path
import { ContextProxy } from "../../../config/ContextProxy";
import { ModelInfo } from "../../../../schemas";

// --- Mocks ---

// Set up mocks before importing the module under test
// Mock persistenceUtils - uses our dedicated mock file
jest.mock("../../persistenceUtils");
const mockedPersistenceUtils = persistenceUtils as jest.Mocked<typeof persistenceUtils>;

// Mock context-window-utils - use dedicated mock file
jest.mock("../context-window-utils");
const mockedContextWindowUtils = contextWindowUtils as jest.Mocked<typeof contextWindowUtils>;

// Mock responses
jest.mock("../../../prompts/responses");
const mockedResponses = responses as jest.Mocked<typeof responses>;

// Mock logger
jest.mock("../../../../utils/logging");
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Mock ContextProxy
const mockContextProxy: ContextProxy = {
	// Implement necessary mock methods if ContextManager interacts with it directly
	// For now, assume it's mainly used by persistenceUtils which are already mocked
} as any; // Cast as any for simplicity if no direct methods are called

// Mock Tokenizer
const mockTokenizer = jest.fn((text: string) => {
	// Simple mock: count words as tokens
	return text ? text.split(/\s+/).length : 0;
});

// --- Test Setup ---

const TEST_TASK_ID = "test-task-123";

// Sample Model Info matching the schema
const mockModelInfo: ModelInfo = {
	contextWindow: 200000,
	supportsPromptCache: true, // Required field
	inputPrice: 15,          // Correct field name
	outputPrice: 75,         // Correct field name
	supportsImages: true,
	maxTokens: 4096,         // Correct field name
	// id and name are not part of ModelInfo schema
};

// Helper function to create a basic message
const createMessage = (
	role: "user" | "assistant",
	content: string | Anthropic.Messages.ContentBlock[],
	_index: number // Use _index to avoid potential conflicts, not strictly needed by Anthropic type
): Anthropic.Messages.MessageParam => ({
	role,
	// Ensure citations are added correctly for both string and array inputs
	content: typeof content === "string"
		? [{ type: "text", text: content, citations: [] }]
		: content.map((block): Anthropic.Messages.ContentBlock => {
			// Type guard to ensure we only add citations to TextBlocks
			if (block.type === 'text') {
				// Ensure citations property exists, even if empty
				return { ...block, citations: block.citations ?? [] };
			}
			// Return other block types (ImageBlock, ToolUseBlock, ToolResultBlock) as is
			return block;
		}),
});

// --- Test Suites ---

describe("ContextManager", () => {
	let contextManager: ContextManager;
	let mockInitialHistory: PersistedContextHistory;

	   // --- Helper Functions (moved to outer scope) ---
	   const createLongHistory = (pairs: number): Anthropic.Messages.MessageParam[] => {
	       const history: Anthropic.Messages.MessageParam[] = [];
	       for (let i = 0; i < pairs; i++) {
	           history.push(createMessage("user", `User message ${i}`, i * 2));
	           history.push(createMessage("assistant", `Assistant response ${i}`, i * 2 + 1));
	       }
	       return history;
	   };

	   const setupTruncationTest = (windowSize: number, reserved: number, buffer: number, percentage: number = 0.5) => {
	       mockedContextWindowUtils.getContextWindowInfo.mockReturnValue({
	           contextWindow: windowSize,
	           maxAllowedSize: windowSize,
	       });
	       contextManager = new ContextManager(
	           mockContextProxy, TEST_TASK_ID, mockTokenizer,
	           {
	               currentModelInfo: mockModelInfo, // Model info itself doesn't matter as much as the mocked window size
	               reservedResponseTokens: reserved,
	               tokenBuffer: buffer,
	               truncationPercentage: percentage,
	           }
	       );
	   };
	   // --- End Helper Functions ---


	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();

		// Reset mock history
		mockInitialHistory = {};
		mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(mockInitialHistory);
		mockedPersistenceUtils.writePersistedContextHistory.mockResolvedValue(undefined);

		// Default mock for getContextWindowInfo
		mockedContextWindowUtils.getContextWindowInfo.mockReturnValue({
			contextWindow: mockModelInfo.contextWindow,
			maxAllowedSize: mockModelInfo.contextWindow, // Assume no initial reduction for simplicity
		});

		// Create a new instance for each test
		contextManager = new ContextManager(
			mockContextProxy,
			TEST_TASK_ID,
			mockTokenizer,
			{
				currentModelInfo: mockModelInfo,
				// Use defaults for truncationPercentage, reservedResponseTokens, tokenBuffer initially
			}
		);
	});

	// --- Initialization Tests ---
	describe("Initialization", () => {
		it("should initialize with default options", () => {
			expect((contextManager as any).truncationPercentage).toBe(0.5);
			expect((contextManager as any).reservedResponseTokens).toBe(1000);
			expect((contextManager as any).tokenBuffer).toBe(500);
			expect((contextManager as any).currentModelInfo).toEqual(mockModelInfo);
			expect((contextManager as any).contextHistoryUpdates).toEqual({});
			expect(mockedLogger.info).toHaveBeenCalledWith(`ContextManager initialized for task ${TEST_TASK_ID}`);
		});

		it("should initialize with custom options", () => {
			const customOptions = {
				truncationPercentage: 0.7,
				reservedResponseTokens: 500,
				tokenBuffer: 200,
				currentModelInfo: { ...mockModelInfo, id: "custom-model" },
			};
			const customManager = new ContextManager(
				mockContextProxy,
				TEST_TASK_ID,
				mockTokenizer,
				customOptions
			);
			expect((customManager as any).truncationPercentage).toBe(0.7);
			expect((customManager as any).reservedResponseTokens).toBe(500);
			expect((customManager as any).tokenBuffer).toBe(200);
			expect((customManager as any).currentModelInfo).toEqual(customOptions.currentModelInfo);
		});

		it("should load persisted history during initializeContextHistory", async () => {
			const persistedHistory: PersistedContextHistory = {
				1: {
					editType: "assistant",
					blocks: {
						0: [[Date.now(), "replace_content", "Updated assistant message", {}]],
					},
				},
			};
			mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(persistedHistory);

			await contextManager.initializeContextHistory();

			expect(mockedPersistenceUtils.readPersistedContextHistory).toHaveBeenCalledWith(mockContextProxy, TEST_TASK_ID);
			expect((contextManager as any).contextHistoryUpdates).toEqual(persistedHistory);
			expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Initialized context history for task ${TEST_TASK_ID}`));
		});

		it("should handle empty persisted history during initialization", async () => {
			mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue({});
			await contextManager.initializeContextHistory();
			expect((contextManager as any).contextHistoryUpdates).toEqual({});
			expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 0 modified messages.`));
		});
	});

	// --- Model Info Update ---
	describe("updateModelInfo", () => {
		it("should update the internal model info if changed", () => {
			// Change a valid property according to the schema
			const newModelInfo: ModelInfo = { ...mockModelInfo, contextWindow: 100000 };
			contextManager.updateModelInfo(newModelInfo);
			expect((contextManager as any).currentModelInfo).toEqual(newModelInfo);
			expect(mockedLogger.info).toHaveBeenCalledWith(`ContextManager model info updated for task ${TEST_TASK_ID}.`);
		});

		it("should not update or log if model info is the same", () => {
			const sameModelInfo = { ...mockModelInfo }; // Create a new object with same values
			contextManager.updateModelInfo(sameModelInfo);
			expect((contextManager as any).currentModelInfo).toEqual(mockModelInfo); // Should still be the original object reference or equivalent
			expect(mockedLogger.info).not.toHaveBeenCalledWith(`ContextManager model info updated for task ${TEST_TASK_ID}.`);
		});

		it("should handle null or undefined model info", () => {
			contextManager.updateModelInfo(null);
			expect((contextManager as any).currentModelInfo).toBeNull();
			expect(mockedLogger.info).toHaveBeenCalledWith(`ContextManager model info updated for task ${TEST_TASK_ID}.`);

			mockedLogger.info.mockClear(); // Clear mock for next check

			contextManager.updateModelInfo(undefined);
			expect((contextManager as any).currentModelInfo).toBeUndefined();
			expect(mockedLogger.info).toHaveBeenCalledWith(`ContextManager model info updated for task ${TEST_TASK_ID}.`);
		});
	});

	// --- Token Calculation (Tested via processHistoryForApi) ---
	// We test the private calculateTokens method indirectly by verifying the
	// tokensUsed property in the result of processHistoryForApi.

	// --- Duplicate File Read Optimization Tests ---
	describe("Duplicate File Read Optimization", () => {
		// Test cases will be added here, likely within processHistoryForApi tests
		// to see the end-to-end effect.
		it("should identify and mark duplicate <file_content> mentions for replacement", async () => {
			const filePath = "src/test.ts";
			const fileContent = "console.log('hello');";
			const mention = `<file_content path="${filePath}">${fileContent}</file_content>`;
			const history: Anthropic.Messages.MessageParam[] = [
				createMessage("user", `First mention: ${mention}`, 0),
				createMessage("assistant", "Okay, I see the first mention.", 1),
				createMessage("user", `Second mention: ${mention}`, 2),
				createMessage("assistant", "Okay, I see the second mention.", 3),
				createMessage("user", `Third mention: ${mention}`, 4), // This one should be kept
			];

			const result = await contextManager.processHistoryForApi(history, [], 0); // No previous tokens

			// Expect the first two mentions (index 0, block 0 and index 2, block 0) to be modified
			expect(result.updatedModifications[0]?.blocks[0]).toEqual(expect.arrayContaining([
				expect.objectContaining({ 1: 'replace_content', 2: expect.stringContaining(mockedResponses.formatResponse.duplicateFileReadNotice()) })
			]));
			expect(result.updatedModifications[2]?.blocks[0]).toEqual(expect.arrayContaining([
				expect.objectContaining({ 1: 'replace_content', 2: expect.stringContaining(mockedResponses.formatResponse.duplicateFileReadNotice()) })
			]));

			// Expect the last mention (index 4, block 0) NOT to be modified for duplication
			expect(result.updatedModifications[4]).toBeUndefined();

			// Verify the processed history reflects the changes (first two replaced)
			const firstMessageBlock = result.processedHistory[0].content?.[0] as Anthropic.Messages.TextBlock;
			const thirdMessageBlock = result.processedHistory[2].content?.[0] as Anthropic.Messages.TextBlock;
			const fifthMessageBlock = result.processedHistory[4].content?.[0] as Anthropic.Messages.TextBlock;

			expect(firstMessageBlock.text).toContain(mockedResponses.formatResponse.duplicateFileReadNotice());
			expect(firstMessageBlock.text).not.toContain(fileContent); // Original content removed
			expect(thirdMessageBlock.text).toContain(mockedResponses.formatResponse.duplicateFileReadNotice());
			expect(thirdMessageBlock.text).not.toContain(fileContent); // Original content removed
			expect(fifthMessageBlock.text).toContain(mention); // Original mention kept

			// Check persistence was called because modifications were made
			expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
		});

		it("should identify and mark duplicate read_file tool results for replacement", async () => {
			// This test depends heavily on the assumed format of read_file results. Adjust if needed.
			const filePath = "src/another.ts";
			const fileContent = "export const x = 1;";
			const toolResultHeader = `[read_file for '${filePath}'] Result:`;
			// Add citations: [] to the text blocks in the array
			const history: Anthropic.Messages.MessageParam[] = [
				createMessage("user", [{ type: "text", text: toolResultHeader, citations: [] }, { type: "text", text: fileContent, citations: [] }], 0), // First read
				createMessage("assistant", "Got it.", 1),
				createMessage("user", [{ type: "text", text: toolResultHeader, citations: [] }, { type: "text", text: fileContent, citations: [] }], 2), // Second read (keep)
			];

			const result = await contextManager.processHistoryForApi(history, [], 0);

			// Expect the first read (index 0, block 1 - the content block) to be modified
			expect(result.updatedModifications[0]?.blocks[1]).toEqual(expect.arrayContaining([
				expect.objectContaining({ 1: 'replace_content', 2: mockedResponses.formatResponse.duplicateFileReadNotice() })
			]));

			// Expect the second read (index 2) NOT to be modified for duplication
			expect(result.updatedModifications[2]).toBeUndefined();

			// Verify the processed history reflects the changes
			const firstMessageContentBlock = result.processedHistory[0].content?.[1] as Anthropic.Messages.TextBlock;
			const thirdMessageContentBlock = result.processedHistory[2].content?.[1] as Anthropic.Messages.TextBlock;

			expect(firstMessageContentBlock.text).toBe(mockedResponses.formatResponse.duplicateFileReadNotice());
			expect(thirdMessageContentBlock.text).toBe(fileContent); // Original content kept

			expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
		});

		it("should not mark single file reads as duplicates", async () => {
			const filePath = "src/unique.ts";
			const fileContent = "unique content";
			const mention = `<file_content path="${filePath}">${fileContent}</file_content>`;
			const history: Anthropic.Messages.MessageParam[] = [
				createMessage("user", `Only mention: ${mention}`, 0),
				createMessage("assistant", "Acknowledged.", 1),
			];

			const result = await contextManager.processHistoryForApi(history, [], 0);

			// No modifications expected for duplication
			expect(result.updatedModifications).toEqual({});
			// History should remain unchanged by optimization
			expect(result.processedHistory).toEqual(history);
			// Persistence should NOT be called if no modifications were made
			expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
		});

        it("should handle mixed duplicate types correctly (mention and tool)", async () => {
            const filePath = "src/mixed.ts";
            const fileContent = "mixed content";
            const mention = `<file_content path="${filePath}">${fileContent}</file_content>`;
            const toolResultHeader = `[read_file for '${filePath}'] Result:`;
            // Add citations: [] to the text blocks in the array
            const history: Anthropic.Messages.MessageParam[] = [
            	createMessage("user", `Mention first: ${mention}`, 0), // Optimize this
            	createMessage("assistant", "Okay.", 1),
            	createMessage("user", [{ type: "text", text: toolResultHeader, citations: [] }, { type: "text", text: fileContent, citations: [] }], 2), // Keep this
            ];
         
            const result = await contextManager.processHistoryForApi(history, [], 0);

            // Expect the mention (index 0, block 0) to be modified
            expect(result.updatedModifications[0]?.blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 1: 'replace_content', 2: expect.stringContaining(mockedResponses.formatResponse.duplicateFileReadNotice()) })
            ]));
            // Expect the tool result (index 2) NOT to be modified
            expect(result.updatedModifications[2]).toBeUndefined();

            // Verify processed history
            const firstMessageBlock = result.processedHistory[0].content?.[0] as Anthropic.Messages.TextBlock;
            const thirdMessageContentBlock = result.processedHistory[2].content?.[1] as Anthropic.Messages.TextBlock; // Content is block 1

            expect(firstMessageBlock.text).toContain(mockedResponses.formatResponse.duplicateFileReadNotice());
            expect(thirdMessageContentBlock.text).toBe(fileContent); // Original content kept

            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
        });
	});

	// --- Persistence Tests ---
	describe("Persistence", () => {
		it("should save context history when modifications are made during processing", async () => {
			const filePath = "src/save_test.ts";
			const fileContent = "content";
			const mention = `<file_content path="${filePath}">${fileContent}</file_content>`;
			const history: Anthropic.Messages.MessageParam[] = [
				createMessage("user", mention, 0),
				createMessage("assistant", "...", 1),
				createMessage("user", mention, 2), // Duplicate
			];

			await contextManager.processHistoryForApi(history, [], 0);

			// Optimization creates a modification, triggering save
			expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalledTimes(1);
			expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalledWith(
				mockContextProxy,
				TEST_TASK_ID,
				expect.objectContaining({ // Check that the modification exists
					0: expect.objectContaining({
						blocks: expect.objectContaining({
							0: expect.arrayContaining([
								expect.objectContaining({ 1: 'replace_content' })
							])
						})
					})
				})
			);
		});

		it("should NOT save context history if no modifications are made", async () => {
			const history: Anthropic.Messages.MessageParam[] = [
				createMessage("user", "Simple message", 0),
				createMessage("assistant", "Simple response", 1),
			];

			await contextManager.processHistoryForApi(history, [], 0);

			// No optimizations or truncation needed, so no save
			expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
		});

        it("should save context history when truncation occurs", async () => {
            // Setup scenario requiring truncation
            const largeContent = "word ".repeat(500); // Approx 500 tokens
            const history: Anthropic.Messages.MessageParam[] = [
                createMessage("user", "first pair user", 0),
                createMessage("assistant", "first pair assistant", 1),
                createMessage("user", largeContent, 2), // This pair will likely be truncated
                createMessage("assistant", largeContent, 3),
                createMessage("user", "last pair user", 4),
                createMessage("assistant", "last pair assistant", 5),
            ];
            // Simulate previous request exceeding limit to trigger truncation
            const previousTokens = mockModelInfo.contextWindow + 1000;
            // Adjust context window info mock to make truncation likely
            mockedContextWindowUtils.getContextWindowInfo.mockReturnValue({
                contextWindow: 1200, // Small window
                maxAllowedSize: 1200,
            });
             // Re-create manager with smaller buffers to ensure truncation
            contextManager = new ContextManager(
                mockContextProxy, TEST_TASK_ID, mockTokenizer,
                { currentModelInfo: mockModelInfo, reservedResponseTokens: 100, tokenBuffer: 50 }
            );


            await contextManager.processHistoryForApi(history, [], previousTokens);

            // Truncation adds a notice, modifying history, triggering save
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalledTimes(1);
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalledWith(
                mockContextProxy,
                TEST_TASK_ID,
                expect.objectContaining({ // Check that the truncation notice modification exists
                    1: expect.objectContaining({ // Notice added to first assistant message
                        blocks: expect.objectContaining({
                            0: expect.arrayContaining([
                                expect.objectContaining({ 1: 'add_truncation_notice' })
                            ])
                        })
                    })
                })
            );
        });
	});

	// --- Truncation Logic Tests ---
	describe("Truncation Logic", () => {
	       // Helper functions moved outside this describe block

		it("should truncate history when previous request tokens exceed limit", async () => {
			const history = createLongHistory(5); // 10 messages total
			const windowSize = 20; // Small window
			const reserved = 5;
			const buffer = 2;
			const maxContextTokens = windowSize - reserved - buffer; // 13 tokens
			setupTruncationTest(windowSize, reserved, buffer);

			// Simulate previous request exceeding the limit
			const previousTokens = windowSize + 1;

			const result = await contextManager.processHistoryForApi(history, [], previousTokens);

			expect(result.wasTruncated).toBe(true);
			// Default 50% truncation of messages *after* the first pair (8 messages). 50% of 8 is 4.
			// Remove messages at index 2, 3, 4, 5.
			// Expected length: 10 - 4 = 6
			expect(result.processedHistory.length).toBe(6);
			// Check that the first pair (index 0, 1) and the last pair (original index 8, 9 -> new index 4, 5) are kept
			expect((result.processedHistory[0].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("User message 0");
			expect((result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Assistant response 0");
			expect((result.processedHistory[4].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("User message 4"); // Original index 8
			expect((result.processedHistory[5].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Assistant response 4"); // Original index 9
			// Check truncation notice was added
			expect(result.updatedModifications[1]?.blocks[0]).toEqual(expect.arrayContaining([
				expect.objectContaining({ 1: 'add_truncation_notice' })
			]));
			expect((result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock).text).toContain(mockedResponses.formatResponse.contextTruncationNotice());
			expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled(); // Modifications occurred
		});

		it("should NOT truncate history if previous request tokens are within limit", async () => {
			const history = createLongHistory(5); // 10 messages, likely exceeds small window below
			const windowSize = 20;
			const reserved = 5;
			const buffer = 2;
			setupTruncationTest(windowSize, reserved, buffer);

			// Simulate previous request being within the limit, even if current might exceed
			const previousTokens = windowSize - reserved - buffer; // Exactly at the limit

			const result = await contextManager.processHistoryForApi(history, [], previousTokens);

			expect(result.wasTruncated).toBe(false);
			expect(result.processedHistory.length).toBe(history.length); // No truncation
			expect(result.updatedModifications).toEqual({}); // No truncation notice
			expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled(); // No modifications
		});

        it("should apply optimizations *before* deciding to truncate (potentially avoiding truncation)", async () => {
            const filePath = "src/optimize_then_truncate.ts";
            const fileContent = "word ".repeat(100); // ~100 tokens
            const mention = `<file_content path="${filePath}">${fileContent}</file_content>`; // ~100 tokens
            const replacementNotice = mockedResponses.formatResponse.duplicateFileReadNotice(); // ~3 tokens
            const history: Anthropic.Messages.MessageParam[] = [
                createMessage("user", "First pair", 0), // 2 tokens
                createMessage("assistant", "Okay", 1), // 1 token
                createMessage("user", `Duplicate 1: ${mention}`, 2), // ~102 tokens -> optimized to ~5 tokens
                createMessage("assistant", "Got it", 3), // 2 tokens
                createMessage("user", `Duplicate 2: ${mention}`, 4), // ~102 tokens (kept)
            ]; // Total original tokens ~ 2 + 1 + 102 + 2 + 102 = 210 tokens
              // Total optimized tokens ~ 2 + 1 + 5 + 2 + 102 = 112 tokens

            const windowSize = 150; // Window allows optimized, but not original
            const reserved = 10;
            const buffer = 5;
            const maxContextTokens = windowSize - reserved - buffer; // 135 tokens
            setupTruncationTest(windowSize, reserved, buffer);

            // Simulate previous request exceeding limit to *trigger* truncation check
            const previousTokens = windowSize + 1;

            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            // Even though previousTokens > limit, optimization should happen first.
            // The optimized history (112 tokens) fits within maxContextTokens (135).
            // Therefore, chronological truncation should NOT occur.
            expect(result.wasTruncated).toBe(false);
            expect(result.processedHistory.length).toBe(history.length); // Length unchanged

            // Check that optimization *did* happen
            expect(result.updatedModifications[2]?.blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 1: 'replace_content', 2: expect.stringContaining(replacementNotice) })
            ]));
            expect((result.processedHistory[2].content?.[0] as Anthropic.Messages.TextBlock).text).toContain(replacementNotice);
            expect((result.processedHistory[4].content?.[0] as Anthropic.Messages.TextBlock).text).toContain(mention); // Last one kept

            // Check that NO truncation notice was added
            expect(result.updatedModifications[1]).toBeUndefined();
            expect((result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock).text).not.toContain(mockedResponses.formatResponse.contextTruncationNotice());

            // Persistence called due to optimization modification
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
        });

		it("should handle truncation percentage correctly (e.g., 75%)", async () => {
			const history = createLongHistory(6); // 12 messages total
			const windowSize = 20;
			const reserved = 5;
			const buffer = 2;
			setupTruncationTest(windowSize, reserved, buffer, 0.75); // 75% truncation

			const previousTokens = windowSize + 1;
			const result = await contextManager.processHistoryForApi(history, [], previousTokens);

			expect(result.wasTruncated).toBe(true);
			// Truncate 75% of messages *after* first pair (10 messages). 75% of 10 is 7.5 -> ceil to 8.
			// Remove messages at index 2, 3, 4, 5, 6, 7, 8, 9.
			// Expected length: 12 - 8 = 4
			expect(result.processedHistory.length).toBe(4);
			// Check kept messages (first pair 0,1 and last pair original 10,11 -> new 2,3)
			expect((result.processedHistory[0].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("User message 0");
			expect((result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Assistant response 0");
			expect((result.processedHistory[2].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("User message 5"); // Original index 10
			expect((result.processedHistory[3].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Assistant response 5"); // Original index 11
		});

        it("should correctly adjust modification indices after truncation", async () => {
            const history = createLongHistory(5); // 10 messages
            const windowSize = 20;
            const reserved = 5;
            const buffer = 2;
            setupTruncationTest(windowSize, reserved, buffer);

            // Add a modification to a message that *won't* be truncated
            const modificationTimestamp = Date.now();
            const initialModifications: PersistedContextHistory = {
                9: { // Modify the last assistant message (original index 9)
                    editType: "assistant",
                    blocks: { 0: [[modificationTimestamp, "replace_content", "Modified last response", {}]] }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(initialModifications);
            await contextManager.initializeContextHistory(); // Load modification

            const previousTokens = windowSize + 1; // Trigger truncation
            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            expect(result.wasTruncated).toBe(true);
            expect(result.processedHistory.length).toBe(6); // 4 messages removed (indices 2, 3, 4, 5)

            // The modification originally at index 9 should now be at index 5 (9 - 4 removed = 5)
            expect(result.updatedModifications[5]).toBeDefined();
            expect(result.updatedModifications[5].blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 0: modificationTimestamp, 2: "Modified last response" })
            ]));
            expect(result.updatedModifications[9]).toBeUndefined(); // Original index should be gone

            // Verify the content in the processed history reflects the shifted modification
            expect((result.processedHistory[5].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Modified last response");

            // Also check the truncation notice modification is present at index 1
             expect(result.updatedModifications[1]?.blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 1: 'add_truncation_notice' })
            ]));
        });

        it("should handle truncation when history has only the first pair", async () => {
            const history = createLongHistory(1); // Only 2 messages
            const windowSize = 5; // Very small
            const reserved = 1;
            const buffer = 1;
            setupTruncationTest(windowSize, reserved, buffer);

            // Trigger truncation check
            const previousTokens = windowSize + 1;
            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            // Truncation is triggered, but there are no messages to remove after preserving the first pair.
            expect(result.wasTruncated).toBe(true); // Signal that truncation logic ran
            expect(result.processedHistory.length).toBe(2); // History remains unchanged
            expect(result.updatedModifications).toEqual({}); // No notice added as nothing was removed
            expect(mockedLogger.warn).toHaveBeenCalledWith("Truncation needed, but not enough messages to remove after preserving the first pair.");
            expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
        });

        it("should handle truncation when history has just over the first pair", async () => {
            const history = createLongHistory(2); // 4 messages
            const windowSize = 10;
            const reserved = 2;
            const buffer = 1;
            setupTruncationTest(windowSize, reserved, buffer, 0.5); // 50%

            const previousTokens = windowSize + 1;
            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            expect(result.wasTruncated).toBe(true);
            // Consider messages after first pair (indices 2, 3). Count = 2.
            // 50% of 2 is 1. Must remove even number -> remove 2.
            // Remove indices 2, 3.
            // Expected length: 4 - 2 = 2
            expect(result.processedHistory.length).toBe(2);
            expect((result.processedHistory[0].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("User message 0");
            expect((result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock).text).toBe("Assistant response 0");
            // Check notice added
            expect(result.updatedModifications[1]?.blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 1: 'add_truncation_notice' })
            ]));
        });
	});

	// --- Truncation Notice Tests ---
	describe("Truncation Notice", () => {
		// These are covered within the Truncation Logic tests above,
		// specifically checking for the 'add_truncation_notice' modification
		// and the presence of the notice text in the processed history.
		it("should add truncation notice to the first assistant message when truncation occurs", async () => {
            // Re-run a basic truncation scenario to isolate the check
            const history = createLongHistory(5);
            const windowSize = 20;
            const reserved = 5;
            const buffer = 2;
            setupTruncationTest(windowSize, reserved, buffer);
            const previousTokens = windowSize + 1;

            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            expect(result.wasTruncated).toBe(true);
            // Check modification map
            expect(result.updatedModifications[1]?.blocks[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ 1: 'add_truncation_notice' })
            ]));
            // Check processed history content
            const firstAssistantBlock = result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock;
            expect(firstAssistantBlock.text.startsWith(mockedResponses.formatResponse.contextTruncationNotice())).toBe(true);
        });

        it("should NOT add truncation notice if truncation does not occur", async () => {
            const history = createLongHistory(2); // Short history
            const windowSize = 100; // Large window
            const reserved = 5;
            const buffer = 2;
            setupTruncationTest(windowSize, reserved, buffer);
            const previousTokens = 10; // Well within limits

            const result = await contextManager.processHistoryForApi(history, [], previousTokens);

            expect(result.wasTruncated).toBe(false);
            expect(result.updatedModifications[1]).toBeUndefined(); // No modification for notice
            const firstAssistantBlock = result.processedHistory[1].content?.[0] as Anthropic.Messages.TextBlock;
            expect(firstAssistantBlock.text.startsWith(mockedResponses.formatResponse.contextTruncationNotice())).toBe(false);
        });
	});

	// --- Edge Case Tests ---
	describe("Edge Cases", () => {
		it("should handle empty history", async () => {
			const history: Anthropic.Messages.MessageParam[] = [];
			const result = await contextManager.processHistoryForApi(history, [], 0);

			expect(result.processedHistory).toEqual([]);
			expect(result.updatedModifications).toEqual({});
			expect(result.tokensUsed).toBe(0);
			expect(result.wasTruncated).toBe(false);
			expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
		});

		it("should handle history with only one message (user)", async () => {
			const history: Anthropic.Messages.MessageParam[] = [createMessage("user", "Hi", 0)];
			const result = await contextManager.processHistoryForApi(history, [], 0);

			expect(result.processedHistory).toEqual(history);
			expect(result.updatedModifications).toEqual({});
			expect(result.tokensUsed).toBe(mockTokenizer("Hi"));
			expect(result.wasTruncated).toBe(false);
		});

        it("should handle invalid maxTokensForContext calculation", async () => {
            // Force getContextWindowInfo to return values that result in non-positive maxTokensForContext
             mockedContextWindowUtils.getContextWindowInfo.mockReturnValue({
                contextWindow: 500,
                maxAllowedSize: 500,
            });
            // Use large buffers
            contextManager = new ContextManager(
                mockContextProxy, TEST_TASK_ID, mockTokenizer,
                { currentModelInfo: mockModelInfo, reservedResponseTokens: 400, tokenBuffer: 150 } // 500 - 400 - 150 = -50
            );

            const history = createLongHistory(1);
            const result = await contextManager.processHistoryForApi(history, [], 0);

            expect(mockedLogger.error).toHaveBeenCalledWith(expect.stringContaining("Calculated maxTokensForContext is invalid"));
            // Should return raw history without processing
            expect(result.processedHistory).toEqual(history);
            expect(result.updatedModifications).toEqual({}); // No modifications applied
            expect(result.wasTruncated).toBe(false);
            expect(result.tokensUsed).toBeGreaterThan(0); // Tokens calculated on raw history
            expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
        });

        it("should handle history updates with invalid indices gracefully", async () => {
            const history = createLongHistory(1); // 2 messages (indices 0, 1)
            const invalidModifications: PersistedContextHistory = {
                5: { // Invalid message index
                    editType: "user",
                    blocks: { 0: [[Date.now(), "replace_content", "invalid", {}]] }
                },
                0: { // Valid message index, invalid block index
                    editType: "user",
                    blocks: { 10: [[Date.now(), "replace_content", "invalid block", {}]] }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(invalidModifications);
            await contextManager.initializeContextHistory(); // Load invalid mods

            // processHistory should still run, applying valid mods if any (none here)
            const result = await contextManager.processHistoryForApi(history, [], 0);

            // Expect warnings for invalid indices during applyContextHistoryUpdates (called internally)
            expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid message index 5"));
            expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid block index 10 for message 0"));

            // History should be unchanged as no valid modifications were applied
            expect(result.processedHistory).toEqual(history);
            expect(result.updatedModifications).toEqual(invalidModifications); // Internal state holds invalid mods
            expect(result.wasTruncated).toBe(false);
        });
	});

    // --- truncateHistoryUpdatesAtTimestamp Tests ---
    describe("truncateHistoryUpdatesAtTimestamp", () => {
        it("should remove updates strictly after the given timestamp", async () => {
            const t1 = Date.now();
            const t2 = t1 + 100;
            const t3 = t2 + 100;
            const initialModifications: PersistedContextHistory = {
                0: {
                    editType: "user",
                    blocks: {
                        0: [
                            [t1, "replace_content", "Update 1", {}], // Keep
                            [t3, "replace_content", "Update 3", {}], // Remove
                        ]
                    }
                },
                1: {
                    editType: "assistant",
                    blocks: {
                        0: [ [t2, "replace_content", "Update 2", {}] ] // Keep
                    }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(initialModifications);
            await contextManager.initializeContextHistory();

            await contextManager.truncateHistoryUpdatesAtTimestamp(t2); // Truncate after t2

            const expectedModifications: PersistedContextHistory = {
                 0: {
                    editType: "user",
                    blocks: { 0: [ [t1, "replace_content", "Update 1", {}] ] } // Update 3 removed
                },
                1: {
                    editType: "assistant",
                    blocks: { 0: [ [t2, "replace_content", "Update 2", {}] ] } // Update 2 kept (<= t2)
                }
            };

            expect((contextManager as any).contextHistoryUpdates).toEqual(expectedModifications);
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalledWith(
                mockContextProxy, TEST_TASK_ID, expectedModifications
            );
            expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Truncated context history updates at timestamp ${t2}`));
        });

        it("should remove entire block entries if all updates are after the timestamp", async () => {
            const t1 = Date.now();
            const t2 = t1 + 100;
             const initialModifications: PersistedContextHistory = {
                0: {
                    editType: "user",
                    blocks: {
                        0: [ [t1, "replace_content", "Keep this", {}] ], // Keep block 0
                        1: [ [t2, "replace_content", "Remove this block", {}] ] // Remove block 1
                    }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(initialModifications);
            await contextManager.initializeContextHistory();

            await contextManager.truncateHistoryUpdatesAtTimestamp(t1); // Truncate after t1

            const expectedModifications: PersistedContextHistory = {
                 0: {
                    editType: "user",
                    blocks: { 0: [ [t1, "replace_content", "Keep this", {}] ] } // Block 1 removed
                }
            };
            expect((contextManager as any).contextHistoryUpdates).toEqual(expectedModifications);
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
        });

        it("should remove entire message entries if all blocks are removed", async () => {
            const t1 = Date.now();
            const t2 = t1 + 100;
             const initialModifications: PersistedContextHistory = {
                0: { // Remove this message entry
                    editType: "user",
                    blocks: { 0: [ [t2, "replace_content", "Remove this", {}] ] }
                },
                1: { // Keep this message entry
                    editType: "assistant",
                    blocks: { 0: [ [t1, "replace_content", "Keep this", {}] ] }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(initialModifications);
            await contextManager.initializeContextHistory();

            await contextManager.truncateHistoryUpdatesAtTimestamp(t1); // Truncate after t1

            const expectedModifications: PersistedContextHistory = {
                 1: { // Message 0 removed
                    editType: "assistant",
                    blocks: { 0: [ [t1, "replace_content", "Keep this", {}] ] }
                }
            };
            expect((contextManager as any).contextHistoryUpdates).toEqual(expectedModifications);
            expect(mockedPersistenceUtils.writePersistedContextHistory).toHaveBeenCalled();
        });

        it("should not save if no updates are removed", async () => {
             const t1 = Date.now();
             const initialModifications: PersistedContextHistory = {
                0: {
                    editType: "user",
                    blocks: { 0: [ [t1, "replace_content", "Update 1", {}] ] }
                }
            };
            mockedPersistenceUtils.readPersistedContextHistory.mockResolvedValue(cloneDeep(initialModifications)); // Use cloneDeep to ensure comparison works
            await contextManager.initializeContextHistory();

            await contextManager.truncateHistoryUpdatesAtTimestamp(t1 + 100); // Timestamp after all updates

            expect((contextManager as any).contextHistoryUpdates).toEqual(initialModifications);
            expect(mockedPersistenceUtils.writePersistedContextHistory).not.toHaveBeenCalled();
            expect(mockedLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Truncated context history updates`));
        });
    });

});