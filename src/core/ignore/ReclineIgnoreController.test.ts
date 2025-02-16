import * as fs from "fs/promises"
import { ReclineIgnoreController } from "./ReclineIgnoreController"
import { fileExistsAtPath } from "../../utils/fs"

jest.mock("../../utils/fs")
jest.mock("fs/promises")

const mockedFileExistsAtPath = fileExistsAtPath as jest.Mock
const mockedReadFile = fs.readFile as jest.Mock

describe("ReclineIgnoreController", () => {
	const cwd = "/workspace"

	beforeEach(() => {
		jest.resetAllMocks()
	})

	test("should load .rooignore and filter files appropriately", async () => {
		// Simulate that .rooignore exists and contains test patterns.
		mockedFileExistsAtPath.mockResolvedValue(true)
		const ignoreContent = "test-ignored.txt\n*.ignored\n"
		mockedReadFile.mockResolvedValue(ignoreContent)

		const controller = new ReclineIgnoreController(cwd)
		await controller.initialize()

		// Files matching the ignore patterns should be blocked.
		expect(controller.validateAccess("test-ignored.txt")).toBe(false)
		expect(controller.validateAccess("foo.ignored")).toBe(false)

		// Files not matching ignore patterns should be allowed.
		expect(controller.validateAccess("not-ignored.txt")).toBe(true)
	})

	test("should filter paths correctly", async () => {
		mockedFileExistsAtPath.mockResolvedValue(true)
		const ignoreContent = "ignored.txt\n"
		mockedReadFile.mockResolvedValue(ignoreContent)

		const controller = new ReclineIgnoreController(cwd)
		await controller.initialize()

		const files = ["ignored.txt", "keep.txt", "another.txt"]
		const filtered = controller.filterPaths(files)
		expect(filtered).toEqual(["keep.txt", "another.txt"])
	})

	test("should allow file access if .rooignore does not exist", async () => {
		// Simulate that .rooignore does not exist.
		mockedFileExistsAtPath.mockResolvedValue(false)

		const controller = new ReclineIgnoreController(cwd)
		await controller.initialize()

		// Without any ignore rules, all files should be allowed.
		expect(controller.validateAccess("test-ignored.txt")).toBe(true)
		expect(controller.validateAccess("anyfile.ignored")).toBe(true)
	})
})
