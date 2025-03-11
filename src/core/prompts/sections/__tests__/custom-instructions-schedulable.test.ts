/***********************************************
 * FILE: custom-instructions-schedulable.test.ts
 * CREATED: 2025-03-11 03:19:21
 *
 * CHANGELOG:
 * - 2025-03-11 03:19:21: (Schedulable Rules - Implementation) Initial implementation of tests for schedulable rules integration with custom instructions
 *
 * PURPOSE:
 * This file contains tests for schedulable rules integration with the custom instructions system.
 *
 * METHODS:
 * - None (test file)
 ***********************************************/

import { addCustomInstructions } from "../custom-instructions"
import { SchedulableRulesManager, SchedulableRule } from "../schedulable-rules"
import * as fs from "fs/promises"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("../schedulable-rules")

describe("addCustomInstructions with schedulable rules", () => {
	let mockSchedulableRulesManager: jest.Mocked<SchedulableRulesManager>
	const mockRules: SchedulableRule[] = [
		{
			filePath: "/path/to/.clinerules-5m",
			fileName: ".clinerules-5m",
			interval: 5 * 60 * 1000,
			timeUnit: "m",
			displayInterval: "5 minutes",
			content: "Some rule content for 5 minutes",
			lastExecuted: 0,
		},
		{
			filePath: "/path/to/.clinerules-10s",
			fileName: ".clinerules-10s",
			interval: 10 * 1000,
			timeUnit: "s",
			displayInterval: "10 seconds",
			content: "Some rule content for 10 seconds",
			lastExecuted: 0,
		},
	]

	beforeEach(() => {
		jest.resetAllMocks()

		// Mock SchedulableRulesManager
		mockSchedulableRulesManager = {
			resetAllRules: jest.fn(),
			loadSchedulableRules: jest.fn(),
			shouldExecuteRule: jest.fn(),
			markRuleAsExecuted: jest.fn(),
			getExecutableRules: jest.fn().mockResolvedValue(mockRules),
			getAllRules: jest.fn(),
		} as unknown as jest.Mocked<SchedulableRulesManager>

		// Mock fs
		;(fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
			if (filePath.endsWith(".clinerules")) {
				return Promise.resolve("Generic rules content")
			}
			if (filePath.endsWith(".clinerules-code")) {
				return Promise.resolve("Mode specific rules content")
			}
			return Promise.resolve("")
		})
	})

	test("should include schedulable rules in custom instructions", async () => {
		const result = await addCustomInstructions(
			"Mode custom instructions",
			"Global custom instructions",
			"/fake/cwd",
			"code",
			{},
			mockSchedulableRulesManager,
		)

		// Check that getExecutableRules was called
		expect(mockSchedulableRulesManager.getExecutableRules).toHaveBeenCalledWith("/fake/cwd")

		// Check that markRuleAsExecuted was called for each rule
		expect(mockSchedulableRulesManager.markRuleAsExecuted).toHaveBeenCalledTimes(2)
		expect(mockSchedulableRulesManager.markRuleAsExecuted).toHaveBeenCalledWith(mockRules[0])
		expect(mockSchedulableRulesManager.markRuleAsExecuted).toHaveBeenCalledWith(mockRules[1])

		// Check that the result includes the rule content
		expect(result).toContain("Rules from .clinerules-5m (every 5 minutes)")
		expect(result).toContain("Some rule content for 5 minutes")
		expect(result).toContain("Rules from .clinerules-10s (every 10 seconds)")
		expect(result).toContain("Some rule content for 10 seconds")
	})

	test("should work without a schedulable rules manager", async () => {
		const result = await addCustomInstructions(
			"Mode custom instructions",
			"Global custom instructions",
			"/fake/cwd",
			"code",
			{},
		)

		// Check that the result includes normal content but not schedulable rules
		expect(result).not.toContain("Rules from .clinerules-5m")
		expect(result).not.toContain("Rules from .clinerules-10s")
		expect(result).toContain("Mode custom instructions")
		expect(result).toContain("Global custom instructions")
	})
})
