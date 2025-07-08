import { describe, it, expect, beforeEach, vi } from "vitest"
import { TelemetryEventName } from "@roo-code/types"
import { OnPremTelemetryClient } from "../OnPremTelemetryClient"

describe("OnPremTelemetryClient", () => {
	let telemetryClient: OnPremTelemetryClient

	beforeEach(() => {
		// Clear environment variables before each test
		delete process.env.ON_PREM
		telemetryClient = new OnPremTelemetryClient(true) // debug mode
	})

	describe("when ON_PREM is not set", () => {
		it("should allow telemetry capture", async () => {
			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			await telemetryClient.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { test: "value" },
			})

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("OnPremTelemetryClient: Telemetry enabled"))

			consoleSpy.mockRestore()
		})

		it("should report telemetry as enabled", () => {
			expect(telemetryClient.isTelemetryEnabled()).toBe(true)
		})
	})

	describe("when ON_PREM=true", () => {
		beforeEach(() => {
			process.env.ON_PREM = "true"
			telemetryClient = new OnPremTelemetryClient(true)
		})

		it("should block all telemetry capture", async () => {
			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			await telemetryClient.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { test: "value" },
			})

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ON_PREM mode: Telemetry disabled"))

			consoleSpy.mockRestore()
		})

		it("should report telemetry as disabled", () => {
			expect(telemetryClient.isTelemetryEnabled()).toBe(false)
		})

		it("should not capture any events", async () => {
			const result = await telemetryClient.capture({
				event: TelemetryEventName.LLM_COMPLETION,
				properties: { model: "claude-3", tokens: 100 },
			})

			expect(result).toBeUndefined()
		})
	})

	describe("when ON_PREM=false", () => {
		beforeEach(() => {
			process.env.ON_PREM = "false"
			telemetryClient = new OnPremTelemetryClient(true)
		})

		it("should allow telemetry capture", async () => {
			expect(telemetryClient.isTelemetryEnabled()).toBe(true)
		})
	})

	describe("when ON_PREM has invalid value", () => {
		beforeEach(() => {
			process.env.ON_PREM = "invalid"
			telemetryClient = new OnPremTelemetryClient(true)
		})

		it("should default to allowing telemetry", () => {
			expect(telemetryClient.isTelemetryEnabled()).toBe(true)
		})
	})

	it("should have no-op shutdown method", async () => {
		const result = await telemetryClient.shutdown()
		expect(result).toBeUndefined()
	})

	it("should have no-op updateTelemetryState method", () => {
		const result = telemetryClient.updateTelemetryState(true)
		expect(result).toBeUndefined()
	})
})
