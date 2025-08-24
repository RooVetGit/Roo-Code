// npx vitest run packages/telemetry/src/__tests__/TelemetryService.slashCommands.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TelemetryService } from "../TelemetryService"
import { TelemetryEventName } from "@roo-code/types"

describe("TelemetryService - Slash Commands", () => {
	let telemetryService: TelemetryService
	let mockClient: {
		capture: ReturnType<typeof vi.fn>
		setProvider: ReturnType<typeof vi.fn>
		updateTelemetryState: ReturnType<typeof vi.fn>
		isTelemetryEnabled: ReturnType<typeof vi.fn>
		shutdown: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		// Reset the singleton instance
		;(TelemetryService as unknown as { _instance: TelemetryService | null })._instance = null

		mockClient = {
			capture: vi.fn(),
			setProvider: vi.fn(),
			updateTelemetryState: vi.fn(),
			isTelemetryEnabled: vi.fn().mockReturnValue(true),
			shutdown: vi.fn(),
		}

		telemetryService = TelemetryService.createInstance([mockClient])
	})

	afterEach(() => {
		// Clean up singleton instance after each test
		;(TelemetryService as unknown as { _instance: TelemetryService | null })._instance = null
	})

	describe("captureSlashCommandUsed", () => {
		it("should capture custom slash command usage", () => {
			const taskId = "test-task-123"
			const commandType = "custom"
			const commandName = "deploy"

			telemetryService.captureSlashCommandUsed(taskId, commandType, commandName)

			expect(mockClient.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.SLASH_COMMAND_USED,
				properties: {
					taskId,
					commandType,
					commandName,
				},
			})
		})

		it("should capture mode switch slash command usage", () => {
			const taskId = "test-task-456"
			const commandType = "mode_switch"
			const commandName = "code"

			telemetryService.captureSlashCommandUsed(taskId, commandType, commandName)

			expect(mockClient.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.SLASH_COMMAND_USED,
				properties: {
					taskId,
					commandType,
					commandName,
				},
			})
		})

		it("should handle multiple slash command captures", () => {
			const taskId = "test-task-789"

			telemetryService.captureSlashCommandUsed(taskId, "custom", "build")
			telemetryService.captureSlashCommandUsed(taskId, "mode_switch", "debug")
			telemetryService.captureSlashCommandUsed(taskId, "custom", "test")

			expect(mockClient.capture).toHaveBeenCalledTimes(3)
			expect(mockClient.capture).toHaveBeenNthCalledWith(1, {
				event: TelemetryEventName.SLASH_COMMAND_USED,
				properties: {
					taskId,
					commandType: "custom",
					commandName: "build",
				},
			})
			expect(mockClient.capture).toHaveBeenNthCalledWith(2, {
				event: TelemetryEventName.SLASH_COMMAND_USED,
				properties: {
					taskId,
					commandType: "mode_switch",
					commandName: "debug",
				},
			})
			expect(mockClient.capture).toHaveBeenNthCalledWith(3, {
				event: TelemetryEventName.SLASH_COMMAND_USED,
				properties: {
					taskId,
					commandType: "custom",
					commandName: "test",
				},
			})
		})

		it("should not capture when service is not ready", () => {
			// Reset the instance to test empty service
			;(TelemetryService as unknown as { _instance: TelemetryService | null })._instance = null
			const emptyService = TelemetryService.createInstance([])

			emptyService.captureSlashCommandUsed("task-id", "custom", "command")

			// Should not throw and should not call any client methods
			expect(mockClient.capture).not.toHaveBeenCalled()
		})
	})
})
