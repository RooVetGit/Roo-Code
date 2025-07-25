import { vi } from "vitest"
import { getSearchableSettings, searchSettings, SETTINGS_SEARCH_CONFIG, EXPERIMENTAL_SETTINGS } from "../searchUtils"

describe("searchUtils", () => {
	const mockT = vi.fn((key: string) => key)

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getSearchableSettings", () => {
		it("should return an array of searchable items", () => {
			const settings = getSearchableSettings(mockT)

			expect(settings).toBeInstanceOf(Array)
			expect(settings.length).toBeGreaterThan(0)

			// Check structure of first item
			const firstItem = settings[0]
			expect(firstItem).toHaveProperty("sectionId")
			expect(firstItem).toHaveProperty("sectionLabel")
			expect(firstItem).toHaveProperty("settingId")
			expect(firstItem).toHaveProperty("settingLabel")
		})

		it("should include all configured settings", () => {
			const settings = getSearchableSettings(mockT)

			// Count should match the config + experimental settings
			const expectedCount = Object.keys(SETTINGS_SEARCH_CONFIG).length + EXPERIMENTAL_SETTINGS.length
			expect(settings).toHaveLength(expectedCount)
		})

		it("should include all main sections", () => {
			const settings = getSearchableSettings(mockT)
			const sections = new Set(settings.map((item) => item.sectionId))

			expect(sections.has("providers")).toBe(true)
			expect(sections.has("autoApprove")).toBe(true)
			expect(sections.has("browser")).toBe(true)
			expect(sections.has("checkpoints")).toBe(true)
			expect(sections.has("notifications")).toBe(true)
			expect(sections.has("contextManagement")).toBe(true)
			expect(sections.has("terminal")).toBe(true)
			expect(sections.has("language")).toBe(true)
			expect(sections.has("about")).toBe(true)
			expect(sections.has("experimental")).toBe(true)
		})

		it("should include experimental settings", () => {
			const settings = getSearchableSettings(mockT)
			const experimentalSettings = settings.filter((item) => item.sectionId === "experimental")

			expect(experimentalSettings.length).toBe(EXPERIMENTAL_SETTINGS.length)
			expect(experimentalSettings.some((item) => item.settingId === "DIFF_STRATEGY_UNIFIED")).toBe(true)
			expect(experimentalSettings.some((item) => item.settingId === "POWER_STEERING")).toBe(true)
		})

		it("should include PowerShell terminal setting", () => {
			const settings = getSearchableSettings(mockT)
			const powershellSetting = settings.find((item) => item.settingId === "powershellCounter")

			expect(powershellSetting).toBeDefined()
			expect(powershellSetting?.sectionId).toBe("terminal")
			expect(powershellSetting?.keywords).toContain("powershell")
		})
	})

	describe("searchSettings", () => {
		const mockSettings = [
			{
				sectionId: "providers",
				sectionLabel: "Providers",
				settingId: "apiProvider",
				settingLabel: "API Provider",
				keywords: ["api", "provider", "model"],
			},
			{
				sectionId: "browser",
				sectionLabel: "Browser",
				settingId: "browserToolEnabled",
				settingLabel: "Enable browser tool",
				settingDescription: "Enable browser functionality",
				keywords: ["browser", "tool", "enable"],
			},
			{
				sectionId: "notifications",
				sectionLabel: "Notifications",
				settingId: "soundEnabled",
				settingLabel: "Enable sound effects",
				keywords: ["sound", "audio", "notification"],
			},
		]

		it("should return empty array for empty query", () => {
			const results = searchSettings("", mockSettings)
			expect(results).toEqual([])

			const resultsWithSpaces = searchSettings("   ", mockSettings)
			expect(resultsWithSpaces).toEqual([])
		})

		it("should find settings by label with exact match", () => {
			const results = searchSettings("browser", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("browser")
			expect(results[0].matches).toHaveLength(1)
			expect(results[0].matches[0].settingId).toBe("browserToolEnabled")
		})

		it("should find settings with fuzzy matching", () => {
			// Test fuzzy matching - "brwsr" should match "browser"
			const results = searchSettings("brwsr", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("browser")
			expect(results[0].matches).toHaveLength(1)
			expect(results[0].matches[0].settingId).toBe("browserToolEnabled")
		})

		it("should find settings with partial fuzzy match", () => {
			// Test partial fuzzy matching - "snd" should match "sound"
			const results = searchSettings("snd", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("notifications")
			expect(results[0].matches[0].settingId).toBe("soundEnabled")
		})

		it("should find settings by keywords", () => {
			const results = searchSettings("audio", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("notifications")
			expect(results[0].matches[0].settingId).toBe("soundEnabled")
		})

		it("should find settings by description", () => {
			const results = searchSettings("functionality", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("browser")
			expect(results[0].matches[0].settingId).toBe("browserToolEnabled")
		})

		it("should be case insensitive", () => {
			const resultsLower = searchSettings("api", mockSettings)
			const resultsUpper = searchSettings("API", mockSettings)
			const resultsMixed = searchSettings("ApI", mockSettings)

			expect(resultsLower).toEqual(resultsUpper)
			expect(resultsLower).toEqual(resultsMixed)
			expect(resultsLower).toHaveLength(1)
		})

		it("should find multiple matches across sections", () => {
			const results = searchSettings("enable", mockSettings)

			expect(results).toHaveLength(2)
			const sectionIds = results.map((r) => r.sectionId)
			expect(sectionIds).toContain("browser")
			expect(sectionIds).toContain("notifications")
		})

		it("should handle typos with fuzzy search", () => {
			// Test typo tolerance - "notifcation" (missing 'i') should match "notification"
			const results = searchSettings("notifcation", mockSettings)

			expect(results).toHaveLength(1)
			expect(results[0].sectionId).toBe("notifications")
			expect(results[0].matches[0].settingId).toBe("soundEnabled")
		})

		it("should return no results for completely unrelated queries", () => {
			const results = searchSettings("xyz123", mockSettings)

			expect(results).toHaveLength(0)
		})

		it("should handle acronym-style searches", () => {
			// "api" should match "API Provider"
			const results = searchSettings("ap", mockSettings)

			expect(results.length).toBeGreaterThan(0)
			const apiMatch = results.find((r) => r.matches.some((m) => m.settingId === "apiProvider"))
			expect(apiMatch).toBeDefined()
		})

		it("should rank exact matches higher in fuzzy search", () => {
			const settingsWithSimilarNames = [
				{
					sectionId: "test",
					sectionLabel: "Test",
					settingId: "setting1",
					settingLabel: "Sound",
					keywords: [],
				},
				{
					sectionId: "test",
					sectionLabel: "Test",
					settingId: "setting2",
					settingLabel: "Sound Effects",
					keywords: [],
				},
				{
					sectionId: "test",
					sectionLabel: "Test",
					settingId: "setting3",
					settingLabel: "Background Sound",
					keywords: [],
				},
			]

			const results = searchSettings("sound", settingsWithSimilarNames)

			expect(results).toHaveLength(1)
			expect(results[0].matches).toHaveLength(3)
			// Due to our tiebreaker, exact label matches should come first
			const firstMatch = results[0].matches[0]
			expect(firstMatch.settingLabel.toLowerCase()).toContain("sound")
		})
	})
})
