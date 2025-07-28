import { describe, it, expect, vi, beforeEach } from "vitest"
import { isTemperatureRelatedError } from "../temperatureErrorDetection"
import type { Task } from "../../../task/Task"
import type { ProviderSettings } from "@roo-code/types"

describe("temperatureErrorDetection", () => {
	let mockTask: Partial<Task>
	let mockApiConfiguration: ProviderSettings

	beforeEach(() => {
		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			modelTemperature: 0.7,
		} as ProviderSettings

		mockTask = {
			apiConfiguration: mockApiConfiguration,
		}
	})

	describe("isTemperatureRelatedError", () => {
		it("should return false for non-temperature related errors", () => {
			const result = isTemperatureRelatedError("write_to_file", "Permission denied", mockTask as Task)
			expect(result).toBe(false)
		})

		it("should return false when temperature is already low (0.2 or below)", () => {
			mockApiConfiguration.modelTemperature = 0.2
			const result = isTemperatureRelatedError(
				"write_to_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(false)
		})

		it("should return false when temperature is undefined (using default)", () => {
			mockApiConfiguration.modelTemperature = undefined
			const result = isTemperatureRelatedError(
				"write_to_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(false)
		})

		it('should return true for "content appears to be truncated" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"write_to_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it('should return true for "rest of code unchanged" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"apply_diff",
				'Error: Found "// rest of code unchanged" in the content',
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it('should return true for "previous code" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"write_to_file",
				'Error: Content contains "// ... previous code ..." placeholder',
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it('should return true for "existing code" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"apply_diff",
				'Error: Found "// ... existing code ..." in the diff',
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it('should return true for "keep the rest" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"write_to_file",
				'Error: Content includes "// keep the rest of the file" comment',
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it('should return true for "remaining code" error with high temperature', () => {
			const result = isTemperatureRelatedError(
				"apply_diff",
				'Error: Found "// ... remaining code ..." in the content',
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it("should handle Error objects as well as strings", () => {
			const error = new Error("content appears to be truncated")
			const result = isTemperatureRelatedError("write_to_file", error, mockTask as Task)
			expect(result).toBe(true)
		})

		it("should be case insensitive when checking error patterns", () => {
			const result = isTemperatureRelatedError(
				"write_to_file",
				"ERROR: CONTENT APPEARS TO BE TRUNCATED",
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it("should return false when temperature is 0", () => {
			mockApiConfiguration.modelTemperature = 0
			const result = isTemperatureRelatedError(
				"write_to_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(false)
		})

		it("should return true when temperature is exactly 0.3", () => {
			mockApiConfiguration.modelTemperature = 0.3
			const result = isTemperatureRelatedError(
				"write_to_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it("should work with apply_diff tool", () => {
			const result = isTemperatureRelatedError(
				"apply_diff",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(true)
		})

		it("should return false for other tools even with temperature error patterns", () => {
			const result = isTemperatureRelatedError(
				"read_file",
				"Error: content appears to be truncated",
				mockTask as Task,
			)
			expect(result).toBe(false)
		})
	})
})
