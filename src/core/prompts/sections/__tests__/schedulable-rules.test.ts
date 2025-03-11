/***********************************************
 * FILE: schedulable-rules.test.ts
 * CREATED: 2025-03-11 03:18:01
 *
 * CHANGELOG:
 * - 2025-03-11 03:18:01: (Schedulable Rules - Implementation) Initial implementation of unit tests for parseTimeInterval and SchedulableRulesManager
 * - 2025-03-11 03:53:05: (Schedulable Rules - Bug Fix) Fixed import path for utils/logging module in test mocks
 * - 2025-03-11 03:53:37: (Schedulable Rules - Bug Fix) Added explicit mock implementations for fs/promises readdir and readFile functions
 *
 * PURPOSE:
 * This file contains tests for the schedulable rules implementation.
 *
 * METHODS:
 * - None (test file)
 ***********************************************/

import { parseTimeInterval, SchedulableRule, SchedulableRulesManager } from "../schedulable-rules"
import * as fs from "fs/promises"
import * as path from "path"

// Mock dependencies
jest.mock("fs/promises", () => ({
	readdir: jest.fn(),
	readFile: jest.fn(),
}))
jest.mock("../../../../utils/logging", () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		error: jest.fn(),
	},
}))

describe("parseTimeInterval", () => {
	test("should correctly parse seconds", () => {
		const result = parseTimeInterval("5s")
		expect(result.interval).toBe(5 * 1000)
		expect(result.unit).toBe("s")
		expect(result.display).toBe("5 seconds")
	})

	test("should correctly parse minutes", () => {
		const result = parseTimeInterval("10m")
		expect(result.interval).toBe(10 * 60 * 1000)
		expect(result.unit).toBe("m")
		expect(result.display).toBe("10 minutes")
	})

	test("should correctly parse hours", () => {
		const result = parseTimeInterval("2h")
		expect(result.interval).toBe(2 * 60 * 60 * 1000)
		expect(result.unit).toBe("h")
		expect(result.display).toBe("2 hours")
	})

	test("should correctly parse days", () => {
		const result = parseTimeInterval("1d")
		expect(result.interval).toBe(24 * 60 * 60 * 1000)
		expect(result.unit).toBe("d")
		expect(result.display).toBe("1 day")
	})

	test("should handle singular units correctly", () => {
		const result = parseTimeInterval("1s")
		expect(result.display).toBe("1 second")
	})

	test("should throw an error for invalid formats", () => {
		expect(() => parseTimeInterval("5x")).toThrow()
		expect(() => parseTimeInterval("abc")).toThrow()
		expect(() => parseTimeInterval("5")).toThrow()
	})
})

describe("SchedulableRulesManager", () => {
	let manager: SchedulableRulesManager
	const mockRules: SchedulableRule[] = [
		{
			filePath: "/path/to/.clinerules-5m",
			fileName: ".clinerules-5m",
			interval: 5 * 60 * 1000,
			timeUnit: "m",
			displayInterval: "5 minutes",
			content: "Some rule content",
			lastExecuted: 0,
		},
		{
			filePath: "/path/to/.clinerules-10s",
			fileName: ".clinerules-10s",
			interval: 10 * 1000,
			timeUnit: "s",
			displayInterval: "10 seconds",
			content: "Another rule content",
			lastExecuted: 0,
		},
	]

	beforeEach(() => {
		jest.resetAllMocks()
		manager = new SchedulableRulesManager()

		// Mock readdir to return rule files
		const mockFiles = [".clinerules-5m", ".clinerules-10s", "other-file.txt"]
		;(fs.readdir as jest.Mock).mockResolvedValue(mockFiles)

		// Mock readFile to return content
		;(fs.readFile as jest.Mock).mockImplementation((filePath) => {
			if (filePath.includes(".clinerules-5m")) {
				return Promise.resolve("Some rule content")
			} else if (filePath.includes(".clinerules-10s")) {
				return Promise.resolve("Another rule content")
			}
			return Promise.resolve("")
		})
	})

	test("should load schedulable rules from directory", async () => {
		const rules = await manager.loadSchedulableRules("/fake/cwd")

		expect(fs.readdir).toHaveBeenCalledWith("/fake/cwd")
		expect(rules).toHaveLength(2)
		expect(rules[0].fileName).toBe(".clinerules-5m")
		expect(rules[1].fileName).toBe(".clinerules-10s")
	})

	test("should check if a rule should be executed", () => {
		// Rule should execute if it has never been executed
		expect(manager.shouldExecuteRule(mockRules[0])).toBe(true)

		// Mark the rule as executed
		manager.markRuleAsExecuted(mockRules[0])

		// Rule should not execute immediately after being marked
		expect(manager.shouldExecuteRule(mockRules[0])).toBe(false)

		// Simulate time passing (manually setting lastExecutionTimes)
		const sixMinutesAgo = Date.now() - 6 * 60 * 1000
		Object.defineProperty(manager, "lastExecutionTimes", {
			value: new Map([[mockRules[0].fileName, sixMinutesAgo]]),
		})

		// Now the rule should execute again (5 minutes have passed)
		expect(manager.shouldExecuteRule(mockRules[0])).toBe(true)
	})

	test("should return executable rules", async () => {
		// Mock implementation to return our test rules
		jest.spyOn(manager, "loadSchedulableRules").mockResolvedValue(mockRules)

		// Initially, all rules should be executable
		let executableRules = await manager.getExecutableRules("/fake/cwd")
		expect(executableRules).toHaveLength(2)

		// Mark one rule as executed
		manager.markRuleAsExecuted(mockRules[0])

		// Mock shouldExecuteRule to return false for the first rule
		jest.spyOn(manager, "shouldExecuteRule").mockImplementation((rule) => {
			return rule.fileName !== mockRules[0].fileName
		})

		// Now only one rule should be executable
		executableRules = await manager.getExecutableRules("/fake/cwd")
		expect(executableRules).toHaveLength(1)
		expect(executableRules[0].fileName).toBe(mockRules[1].fileName)
	})

	test("should reset all rules", () => {
		// Mark rules as executed
		manager.markRuleAsExecuted(mockRules[0])
		manager.markRuleAsExecuted(mockRules[1])

		// Verify the lastExecutionTimes map has entries
		expect((manager as any).lastExecutionTimes.size).toBe(2)

		// Reset all rules
		manager.resetAllRules()

		// Verify the lastExecutionTimes map is cleared
		expect((manager as any).lastExecutionTimes.size).toBe(0)
	})

	test("should handle errors when loading rules", async () => {
		// Mock readdir to throw an error
		;(fs.readdir as jest.Mock).mockRejectedValue(new Error("Directory not found"))

		const rules = await manager.loadSchedulableRules("/fake/cwd")

		// Should return empty array on error
		expect(rules).toEqual([])
	})

	test("should get all rules with next execution time", async () => {
		// Mock implementation to return our test rules
		jest.spyOn(manager, "loadSchedulableRules").mockResolvedValue(mockRules)

		// Mark one rule as executed 3 minutes ago
		const threeMinutesAgo = Date.now() - 3 * 60 * 1000
		Object.defineProperty(manager, "lastExecutionTimes", {
			value: new Map([[mockRules[0].fileName, threeMinutesAgo]]),
		})

		const rulesWithStatus = await manager.getAllRules("/fake/cwd")

		expect(rulesWithStatus).toHaveLength(2)

		// First rule should have nextExecution time of approximately 2 minutes (5 - 3)
		const twoMinutesMs = 2 * 60 * 1000
		expect(rulesWithStatus[0].nextExecution).toBeGreaterThan(twoMinutesMs - 100)
		expect(rulesWithStatus[0].nextExecution).toBeLessThan(twoMinutesMs + 100)

		// Second rule should have nextExecution time of 0 (never executed)
		expect(rulesWithStatus[1].nextExecution).toBe(0)
	})
})
