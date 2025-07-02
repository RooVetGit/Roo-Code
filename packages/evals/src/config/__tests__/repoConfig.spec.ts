import { describe, test, expect } from "vitest"
import { REPO_CONFIGS, getRepoConfig, getRepoConfigByName } from "../repoConfig.js"

describe("repoConfig", () => {
	test("should have correct repo configurations", () => {
		expect(REPO_CONFIGS).toHaveLength(2)

		const rooCode = REPO_CONFIGS.find((config) => config.name === "Roo-Code")
		expect(rooCode).toBeDefined()
		expect(rooCode?.path).toBe("/roo/repos/Roo-Code")
		expect(rooCode?.description).toBe("Main Roo Code repository")

		const rooCodeCloud = REPO_CONFIGS.find((config) => config.name === "Roo-Code-Cloud")
		expect(rooCodeCloud).toBeDefined()
		expect(rooCodeCloud?.path).toBe("/roo/repos/Roo-Code-Cloud")
		expect(rooCodeCloud?.description).toBe("Roo Code Cloud repository")
	})

	test("getRepoConfig should return correct config by path", () => {
		const config = getRepoConfig("/roo/repos/Roo-Code")
		expect(config).toBeDefined()
		expect(config?.name).toBe("Roo-Code")
		expect(config?.path).toBe("/roo/repos/Roo-Code")
	})

	test("getRepoConfig should return undefined for unknown path", () => {
		const config = getRepoConfig("/unknown/path")
		expect(config).toBeUndefined()
	})

	test("getRepoConfigByName should return correct config by name", () => {
		const config = getRepoConfigByName("Roo-Code-Cloud")
		expect(config).toBeDefined()
		expect(config?.name).toBe("Roo-Code-Cloud")
		expect(config?.path).toBe("/roo/repos/Roo-Code-Cloud")
	})

	test("getRepoConfigByName should return undefined for unknown name", () => {
		const config = getRepoConfigByName("Unknown-Repo")
		expect(config).toBeUndefined()
	})
})
