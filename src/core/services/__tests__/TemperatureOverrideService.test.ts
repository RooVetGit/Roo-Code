import { TemperatureOverrideService } from "../TemperatureOverrideService"
import * as vscode from "vscode"

jest.mock("vscode", () => ({
	workspace: {
		getConfiguration: jest.fn(),
	},
}))

describe("TemperatureOverrideService", () => {
	let service: TemperatureOverrideService
	let mockGetConfig: jest.Mock
	let consoleSpy: jest.SpyInstance

	beforeEach(() => {
		jest.clearAllMocks()
		service = new TemperatureOverrideService()
		mockGetConfig = jest.fn().mockReturnValue(true)
		;(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
			get: mockGetConfig,
		})
		consoleSpy = jest.spyOn(console, "error").mockImplementation()
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe("parseAndApplyOverride", () => {
		test("respects configuration setting when disabled", () => {
			mockGetConfig.mockReturnValue(false)
			const result = service.parseAndApplyOverride("@customTemperature:0.8 Hello", 0.7)
			expect(result).toBeNull()
			expect(mockGetConfig).toHaveBeenCalledWith("enableTemperatureOverride", true)
		})

		test("allows temperature override when configuration is enabled by default", () => {
			mockGetConfig.mockReturnValue(true) // Default value
			const result = service.parseAndApplyOverride("@customTemperature:0.8 Hello", 0.7)
			expect(result).toEqual({
				temperature: 0.8,
				originalTemp: 0.7,
				cleanedInput: " Hello",
			})
			expect(mockGetConfig).toHaveBeenCalledWith("enableTemperatureOverride", true)
		})

		test("parses valid temperature override", () => {
			const result = service.parseAndApplyOverride("@customTemperature:0.8 Hello world", 0.7)
			expect(result).toEqual({
				temperature: 0.8,
				originalTemp: 0.7,
				cleanedInput: " Hello world",
			})
			expect(consoleSpy).not.toHaveBeenCalled()
		})

		test("handles invalid temperature values", () => {
			const testCases = [
				[
					"@customTemperature:0.555 Hello",
					"Invalid temperature format: 0.555 (maximum 2 decimal places allowed)",
				],
				[
					"@customTemperature:-0.1 Hello",
					"Invalid temperature value: -0.1 (must be greater than 0 and less than or equal to 2.0)",
				],
				[
					"@customTemperature:2.1 Hello",
					"Invalid temperature value: 2.1 (must be greater than 0 and less than or equal to 2.0)",
				],
				[
					"@customTemperature:abc Hello",
					"Invalid temperature value: abc (must be greater than 0 and less than or equal to 2.0)",
				],
			]

			testCases.forEach(([input, errorMessage]) => {
				consoleSpy.mockClear()
				const result = service.parseAndApplyOverride(input, 0.7)
				expect(result).toBeNull()
				expect(consoleSpy).toHaveBeenCalledWith(`[TemperatureOverrideService] ${errorMessage}`)
				expect(consoleSpy).toHaveBeenCalledTimes(1)
			})
		})

		test("handles valid temperature range", () => {
			const testCases = [
				["@customTemperature:0.1 Test", 0.1],
				["@customTemperature:1.0 Test", 1.0],
				["@customTemperature:2.0 Test", 2.0],
			]

			testCases.forEach(([input, expected]) => {
				consoleSpy.mockClear()
				const result = service.parseAndApplyOverride(input as string, 0.7)
				expect(result).toEqual({
					temperature: expected,
					originalTemp: 0.7,
					cleanedInput: " Test",
				})
				expect(consoleSpy).not.toHaveBeenCalled()
			})
		})

		test("preserves whitespace after command", () => {
			const result = service.parseAndApplyOverride("@customTemperature:0.8   Hello   world  ", 0.7)
			expect(result).toEqual({
				temperature: 0.8,
				originalTemp: 0.7,
				cleanedInput: "   Hello   world  ",
			})
			expect(consoleSpy).not.toHaveBeenCalled()
		})

		test("returns null for non-temperature-override input", () => {
			const inputs = [
				"Hello world",
				"  @customTemperature:0.8", // Not at start
				"@wrongCommand:0.8 test", // Wrong command
				"@customTemperature: test", // No number
				"@customTemperature: ", // Empty value
			]

			inputs.forEach((input) => {
				consoleSpy.mockClear()
				const result = service.parseAndApplyOverride(input, 0.7)
				expect(result).toBeNull()
				expect(consoleSpy).not.toHaveBeenCalled()
			})
		})
	})
})
