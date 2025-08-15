import { describe, it, expect } from "vitest"
import { EVALS_SETTINGS } from "../global-settings.js"

describe("EVALS_SETTINGS", () => {
	it("should not have a hardcoded apiProvider", () => {
		// EVALS_SETTINGS should not have apiProvider set by default
		// to allow flexibility in choosing providers
		expect(EVALS_SETTINGS.apiProvider).toBeUndefined()
	})

	it("should have other necessary settings", () => {
		// Verify that other important settings are still present
		expect(EVALS_SETTINGS.autoApprovalEnabled).toBe(true)
		expect(EVALS_SETTINGS.alwaysAllowWrite).toBe(true)
		expect(EVALS_SETTINGS.alwaysAllowExecute).toBe(true)
		expect(EVALS_SETTINGS.mode).toBe("code")
		expect(EVALS_SETTINGS.openRouterUseMiddleOutTransform).toBe(false)
	})
})
