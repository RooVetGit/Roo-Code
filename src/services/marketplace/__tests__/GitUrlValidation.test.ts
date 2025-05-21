import { isValidGitRepositoryUrl } from "../../../shared/MarketplaceValidation"

describe("Git URL Validation", () => {
	test("validates multi-segment domain SSH URL", () => {
		const url = "git@git.lab.company.com:team-name/project-name.git"
		expect(isValidGitRepositoryUrl(url)).toBe(true)
	})
})
