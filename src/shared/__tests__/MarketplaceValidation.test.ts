import { isValidGitRepositoryUrl } from "../MarketplaceValidation"

describe("Git URL Validation", () => {
	const validUrls = [
		"https://github.com/user/repo",
		"https://gitlab.com/group/repo",
		"https://git.internal.company.com/team/repo",
		"git@github.com:user/repo.git",
		"git@git.internal.company.com:team/repo",
		"git://gitlab.com/group/repo.git",
		"git://git.internal.company.com/team-name/repo-name",
		"https://github.com/org-name/repo-name",
		"git@gitlab.com:group-name/project-name.git",
	]

	const invalidUrls = [
		"not-a-url",
		"http://single/repo",
		"https://github.com/no-repo",
		"git@github.com/wrong-format",
		"git://invalid@domain:repo",
		"git@domain:no-slash",
		"git@domain:/invalid-start",
		"git@domain:group//repo",
	]

	test.each(validUrls)("should accept valid git URL: %s", (url) => {
		expect(isValidGitRepositoryUrl(url)).toBe(true)
	})

	test.each(invalidUrls)("should reject invalid git URL: %s", (url) => {
		expect(isValidGitRepositoryUrl(url)).toBe(false)
	})
})
