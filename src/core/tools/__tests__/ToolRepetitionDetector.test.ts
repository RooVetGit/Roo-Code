// npx jest src/core/tools/__tests__/ToolRepetitionDetector.test.ts

import type { ToolName } from "../../../schemas"
import type { ToolUse } from "../../../shared/tools"

import { ToolRepetitionDetector } from "../ToolRepetitionDetector"

jest.mock("../../../i18n", () => ({
	t: jest.fn((key, options) => {
		// For toolRepetitionLimitReached key, return a message with the tool name.
		if (key === "tools:toolRepetitionLimitReached" && options?.toolName) {
			return `Roo appears to be stuck in a loop, attempting the same action (${options.toolName}) repeatedly. This might indicate a problem with its current strategy.`
		}
		return key
	}),
}))

function createToolUse(name: string, displayName?: string, params: Record<string, string> = {}): ToolUse {
	return {
		type: "tool_use",
		name: (displayName || name) as ToolName,
		params,
		partial: false,
	}
}

describe("ToolRepetitionDetector", () => {
	// ===== Legacy Consecutive Repetition Tests (Commented Out) =====
	/*
	describe("initialization", () => {
		it("should default to a limit of 3 if no argument provided", () => {
			const detector = new ToolRepetitionDetector()
			// We'll verify this through behavior in subsequent tests

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("test", "test-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2)
			const result2 = detector.check(createToolUse("test", "test-tool"))
			expect(result2.allowExecution).toBe(true)

			// Third identical call (counter = 3) reaches the default limit
			const result3 = detector.check(createToolUse("test", "test-tool"))
			expect(result3.allowExecution).toBe(false)
		})

		it("should use the custom limit when provided", () => {
			const customLimit = 2
			const detector = new ToolRepetitionDetector(customLimit)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("test", "test-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2) reaches the custom limit
			const result2 = detector.check(createToolUse("test", "test-tool"))
			expect(result2.allowExecution).toBe(false)
		})
	})

	describe("no repetition", () => {
		it("should allow execution for different tool calls", () => {
			const detector = new ToolRepetitionDetector()

			const result1 = detector.check(createToolUse("first", "first-tool"))
			expect(result1.allowExecution).toBe(true)
			expect(result1.askUser).toBeUndefined()

			const result2 = detector.check(createToolUse("second", "second-tool"))
			expect(result2.allowExecution).toBe(true)
			expect(result2.askUser).toBeUndefined()

			const result3 = detector.check(createToolUse("third", "third-tool"))
			expect(result3.allowExecution).toBe(true)
			expect(result3.askUser).toBeUndefined()
		})

		it("should reset the counter when different tool calls are made", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call
			detector.check(createToolUse("same", "same-tool"))

			// Second identical call would reach limit of 2, but we'll make a different call
			detector.check(createToolUse("different", "different-tool"))

			// Back to the first tool - should be allowed since counter was reset
			const result = detector.check(createToolUse("same", "same-tool"))
			expect(result.allowExecution).toBe(true)
		})
	})

	describe("repetition below limit", () => {
		it("should allow execution when repetition is below limit and block when limit reached", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result1.allowExecution).toBe(true)

			// Second identical call (counter = 2)
			const result2 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result2.allowExecution).toBe(true)

			// Third identical call (counter = 3) reaches limit
			const result3 = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result3.allowExecution).toBe(false)
		})
	})

	describe("repetition reaches limit", () => {
		it("should block execution when repetition reaches the limit", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Second identical call (counter = 2)
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Third identical call (counter = 3) - should reach limit
			const result = detector.check(createToolUse("repeat", "repeat-tool"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
			expect(result.askUser?.messageKey).toBe("mistake_limit_reached")
			expect(result.askUser?.messageDetail).toContain("repeat-tool")
		})

		it("should reset internal state after limit is reached", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit
			detector.check(createToolUse("repeat", "repeat-tool"))
			const limitResult = detector.check(createToolUse("repeat", "repeat-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// Use a new tool call - should be allowed since state was reset
			const result = detector.check(createToolUse("new", "new-tool"))
			expect(result.allowExecution).toBe(true)
		})
	})

	describe("repetition after limit", () => {
		it("should allow execution of previously problematic tool after reset", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit with a specific tool
			detector.check(createToolUse("problem", "problem-tool"))
			const limitResult = detector.check(createToolUse("problem", "problem-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// The same tool that previously caused problems should now be allowed
			const result = detector.check(createToolUse("problem", "problem-tool"))
			expect(result.allowExecution).toBe(true)
		})

		it("should require reaching the limit again after reset", () => {
			const detector = new ToolRepetitionDetector(2)

			// Reach the limit
			detector.check(createToolUse("repeat", "repeat-tool"))
			const limitResult = detector.check(createToolUse("repeat", "repeat-tool")) // This reaches limit
			expect(limitResult.allowExecution).toBe(false)

			// First call after reset
			detector.check(createToolUse("repeat", "repeat-tool"))

			// Second identical call (counter = 2) should reach limit again
			const result = detector.check(createToolUse("repeat", "repeat-tool"))
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})
	})

	describe("tool name interpolation", () => {
		it("should include tool name in the error message", () => {
			const detector = new ToolRepetitionDetector(2)
			const toolName = "special-tool-name"

			// Reach the limit
			detector.check(createToolUse("test", toolName))
			const result = detector.check(createToolUse("test", toolName))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser?.messageDetail).toContain(toolName)
		})
	})

	describe("edge cases", () => {
		it("should handle empty tool call", () => {
			const detector = new ToolRepetitionDetector(2)

			// Create an empty tool call - a tool with no parameters
			// Use the empty tool directly in the check calls
			detector.check(createToolUse("empty-tool", "empty-tool"))
			const result = detector.check(createToolUse("empty-tool"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should handle different tool names with identical serialized JSON", () => {
			const detector = new ToolRepetitionDetector(2)

			// First, call with tool-name-1 twice to set up the counter
			const toolUse1 = createToolUse("tool-name-1", "tool-name-1", { param: "value" })
			detector.check(toolUse1)

			// Create a tool that will serialize to the same JSON as toolUse1
			// We need to mock the serializeToolUse method to return the same value
			const toolUse2 = createToolUse("tool-name-2", "tool-name-2", { param: "value" })

			// Override the private method to force identical serialization
			const originalSerialize = (detector as any).serializeToolUse
			;(detector as any).serializeToolUse = (tool: ToolUse) => {
				// Use string comparison for the name since it's technically an enum
				if (String(tool.name) === "tool-name-2") {
					return (detector as any).serializeToolUse(toolUse1) // Return the same JSON as toolUse1
				}
				return originalSerialize(tool)
			}

			// This should detect as a repetition now
			const result = detector.check(toolUse2)

			// Restore the original method
			;(detector as any).serializeToolUse = originalSerialize

			// Since we're directly manipulating the internal state for testing,
			// we still expect it to consider this a repetition
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should treat tools with same parameters in different order as identical", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call with parameters in one order
			const toolUse1 = createToolUse("same-tool", "same-tool", { a: "1", b: "2", c: "3" })
			detector.check(toolUse1)

			// Create tool with same parameters but in different order
			const toolUse2 = createToolUse("same-tool", "same-tool", { c: "3", a: "1", b: "2" })

			// This should still detect as a repetition due to canonical JSON with sorted keys
			const result = detector.check(toolUse2)

			// Since parameters are sorted alphabetically in the serialized JSON,
			// these should be considered identical
			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})
	})

	describe("explicit Nth call blocking behavior", () => {
		it("should block on the 1st call for limit 1", () => {
			const detector = new ToolRepetitionDetector(1)

			// First call (counter = 1) should be blocked
			const result = detector.check(createToolUse("tool", "tool-name"))

			expect(result.allowExecution).toBe(false)
			expect(result.askUser).toBeDefined()
		})

		it("should block on the 2nd call for limit 2", () => {
			const detector = new ToolRepetitionDetector(2)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("tool", "tool-name"))
			expect(result1.allowExecution).toBe(true)

			// Second call (counter = 2) should be blocked
			const result2 = detector.check(createToolUse("tool", "tool-name"))
			expect(result2.allowExecution).toBe(false)
			expect(result2.askUser).toBeDefined()
		})

		it("should block on the 3rd call for limit 3 (default)", () => {
			const detector = new ToolRepetitionDetector(3)

			// First call (counter = 1)
			const result1 = detector.check(createToolUse("tool", "tool-name"))
			expect(result1.allowExecution).toBe(true)

			// Second call (counter = 2)
			const result2 = detector.check(createToolUse("tool", "tool-name"))
			expect(result2.allowExecution).toBe(true)

			// Third call (counter = 3) should be blocked
			const result3 = detector.check(createToolUse("tool", "tool-name"))
			expect(result3.allowExecution).toBe(false)
			expect(result3.askUser).toBeDefined()
		})
	})
	*/

	// ===== New History-based Repetition Tests =====
	describe("History-based Repetition Detection", () => {
		const HISTORY_SIZE = 5; // Default in implementation
		const REPETITION_THRESHOLD = 3; // Default in implementation

		it("Test Case: No repetition within history window", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			let result;
			result = detector.check(createToolUse("toolA", "Tool A"));
			expect(result.allowExecution).toBe(true);
			result = detector.check(createToolUse("toolB", "Tool B"));
			expect(result.allowExecution).toBe(true);
			result = detector.check(createToolUse("toolC", "Tool C"));
			expect(result.allowExecution).toBe(true);
			result = detector.check(createToolUse("toolD", "Tool D"));
			expect(result.allowExecution).toBe(true);
			result = detector.check(createToolUse("toolE", "Tool E"));
			expect(result.allowExecution).toBe(true);
		});

		it("Test Case: Tool repeated up to the threshold within the history window (should trigger)", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolA", "Tool A"));
			detector.check(createToolUse("toolB", "Tool B"));
			detector.check(createToolUse("toolA", "Tool A"));
			detector.check(createToolUse("toolC", "Tool C"));
			// This is the 3rd "toolA" within the last 5 calls
			const result = detector.check(createToolUse("toolA", "Tool A"));
			expect(result.allowExecution).toBe(false);
			expect(result.askUser?.messageDetail).toContain("Tool A");
		});
		
		it("Test Case: Tool repeated exactly threshold times consecutively", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolA", "Tool A")); // 1st
			detector.check(createToolUse("toolA", "Tool A")); // 2nd
			const result = detector.check(createToolUse("toolA", "Tool A")); // 3rd - triggers
			expect(result.allowExecution).toBe(false);
			expect(result.askUser?.messageDetail).toContain("Tool A");
		});


		it("Test Case: Tool repeated less than the threshold", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolA", "Tool A"));
			detector.check(createToolUse("toolB", "Tool B"));
			detector.check(createToolUse("toolA", "Tool A")); // Only 2 occurrences of toolA
			detector.check(createToolUse("toolC", "Tool C"));
			const result = detector.check(createToolUse("toolD", "Tool D"));
			expect(result.allowExecution).toBe(true);
		});

		it("Test Case: History window full, but no single tool meets the repetition threshold", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD); // Threshold is 3
			detector.check(createToolUse("toolA", "Tool A")); // A:1
			detector.check(createToolUse("toolB", "Tool B")); // B:1
			detector.check(createToolUse("toolA", "Tool A")); // A:2
			detector.check(createToolUse("toolB", "Tool B")); // B:2
			detector.check(createToolUse("toolC", "Tool C")); // C:1 (History: A,B,A,B,C)
			// Next call, toolD. History becomes: B,A,B,C,D. No tool meets threshold of 3.
			const result = detector.check(createToolUse("toolD", "Tool D"));
			expect(result.allowExecution).toBe(true);
		});

		it("Test Case: After a repetition is flagged and history is cleared, subsequent distinct tool calls are allowed", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolA", "Tool A"));
			detector.check(createToolUse("toolA", "Tool A"));
			let result = detector.check(createToolUse("toolA", "Tool A")); // Flagged
			expect(result.allowExecution).toBe(false);

			// History should be cleared
			result = detector.check(createToolUse("toolB", "Tool B")); // Should be allowed
			expect(result.allowExecution).toBe(true);
			result = detector.check(createToolUse("toolC", "Tool C")); // Should be allowed
			expect(result.allowExecution).toBe(true);
		});
		
		it("Test Case: Varying history sizes and thresholds - smaller window", () => {
			const detector = new ToolRepetitionDetector(2); // Threshold 2, History size remains 5 (default internal)
			detector.check(createToolUse("toolX", "Tool X"));
			// This is the 2nd "toolX"
			const result = detector.check(createToolUse("toolX", "Tool X"));
			expect(result.allowExecution).toBe(false);
			expect(result.askUser?.messageDetail).toContain("Tool X");
		});

		it("Test Case: Varying history sizes and thresholds - larger threshold", () => {
			const detector = new ToolRepetitionDetector(4); // Threshold 4
			detector.check(createToolUse("toolY", "Tool Y"));
			detector.check(createToolUse("toolY", "Tool Y"));
			detector.check(createToolUse("toolY", "Tool Y"));
			let result = detector.check(createToolUse("toolZ", "Tool Z")); // Still allowed
			expect(result.allowExecution).toBe(true);
			// This is the 4th "toolY"
			result = detector.check(createToolUse("toolY", "Tool Y"));
			expect(result.allowExecution).toBe(false);
			expect(result.askUser?.messageDetail).toContain("Tool Y");
		});

		it("should correctly handle tool calls with different parameters", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolP", "Tool P", { p1: "v1" }));
			detector.check(createToolUse("toolP", "Tool P", { p1: "v2" }));
			detector.check(createToolUse("toolP", "Tool P", { p1: "v1" }));
			detector.check(createToolUse("toolP", "Tool P", { p1: "v3" }));
			// Only 2 occurrences of toolP with p1:v1
			const result = detector.check(createToolUse("toolP", "Tool P", { p1: "v1" })); 
			expect(result.allowExecution).toBe(false); // This should be the 3rd time {p1:"v1"} appears
		});

		it("should correctly handle tool calls with same parameters in different order", () => {
			const detector = new ToolRepetitionDetector(REPETITION_THRESHOLD);
			detector.check(createToolUse("toolS", "Tool S", { a: "1", b: "2" }));
			detector.check(createToolUse("toolOther", "Tool Other"));
			detector.check(createToolUse("toolS", "Tool S", { b: "2", a: "1" }));
			detector.check(createToolUse("toolDifferent", "Tool Different"));
			const result = detector.check(createToolUse("toolS", "Tool S", { a: "1", b: "2" }));
			expect(result.allowExecution).toBe(false); // Parameters are sorted, so these are identical
			expect(result.askUser?.messageDetail).toContain("Tool S");
		});
		
		it("should correctly fill and slide the history window", () => {
			const detector = new ToolRepetitionDetector(3); // Threshold 3, History 5
			// Fill history without triggering
			detector.check(createToolUse("tool1", "T1")); // H: [T1]
			detector.check(createToolUse("tool2", "T2")); // H: [T1, T2]
			detector.check(createToolUse("tool1", "T1")); // H: [T1, T2, T1]
			detector.check(createToolUse("tool2", "T2")); // H: [T1, T2, T1, T2]
			detector.check(createToolUse("tool3", "T3")); // H: [T1, T2, T1, T2, T3] (Full)
			
			// Next call, tool1. History slides. Old T1 is out.
			// H: [T2, T1, T2, T3, T1]. T1 count is 2.
			let result = detector.check(createToolUse("tool1", "T1"));
			expect(result.allowExecution).toBe(true);

			// Next call, tool2. History slides. Old T2 is out.
			// H: [T1, T2, T3, T1, T2]. T2 count is 2.
			result = detector.check(createToolUse("tool2", "T2"));
			expect(result.allowExecution).toBe(true);
			
			// Next call, tool1. History slides.
			// H: [T2, T3, T1, T2, T1]. T1 count is 2. (Mistake in manual trace, should be T1:2)
			// Let's re-trace for this specific call:
			// Current history before this call: [T1(latest), T2, T3, T1, T2(oldest)] (reversed for clarity of adding)
			// Adding T1: [T1, T1, T2, T3, T1] (after shift: [T1, T2, T3, T1, T1])
			// T1 count is 3.
			result = detector.check(createToolUse("tool1", "T1"));
			expect(result.allowExecution).toBe(false); // T1 now appears 3 times in the window [T2,T3,T1,T2,T1] -> [T3,T1,T2,T1,T1]
			expect(result.askUser?.messageDetail).toContain("T1");
		});
	});
});
