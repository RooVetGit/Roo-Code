import { describe, it, expect, beforeAll, afterAll } from "vitest"
import os from "os"
import * as path from "path"
import * as fs from "fs"
import simpleGit from "simple-git"
import { listFiles } from "../list-files"
import { getWorkspacePath } from "../../../utils/path"

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(),
	arePathsEqual: (a: string, b: string) => path.resolve(a) === path.resolve(b),
}))

describe("listFiles integration tests", () => {
	let testRepoPath: string

	beforeAll(async () => {
		// Create a temporary directory for the Git repo
		testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`)
		await fs.promises.mkdir(testRepoPath, { recursive: true })

		// Initialize a Git repository
		const git = simpleGit(testRepoPath)
		await git.init()

		// Create root .gitignore
		await fs.promises.writeFile(path.join(testRepoPath, ".gitignore"), "root_ignored.txt\nignored_in_root")

		// Create files and directories
		await fs.promises.writeFile(path.join(testRepoPath, "root_kept.txt"), "content")
		await fs.promises.writeFile(path.join(testRepoPath, "root_ignored.txt"), "content")

		// Subdirectory 1 with its own .gitignore
		const subdir1Path = path.join(testRepoPath, "subdir1")
		await fs.promises.mkdir(subdir1Path)
		await fs.promises.writeFile(path.join(subdir1Path, ".gitignore"), "subdir1_ignored.txt")
		await fs.promises.writeFile(path.join(subdir1Path, "subdir1_kept.txt"), "content")
		await fs.promises.writeFile(path.join(subdir1Path, "subdir1_ignored.txt"), "content")

		// Subdirectory 2 (should be affected by root .gitignore)
		const subdir2Path = path.join(testRepoPath, "subdir2")
		await fs.promises.mkdir(subdir2Path)
		await fs.promises.writeFile(path.join(subdir2Path, "subdir2_kept.txt"), "content")
		await fs.promises.writeFile(path.join(testRepoPath, "ignored_in_root"), "content")
	})

	afterAll(async () => {
		// Cleanup the temporary directory
		await fs.promises.rm(testRepoPath, { recursive: true, force: true })
	})

	it("should correctly handle multiple .gitignore files", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)

		const [files] = await listFiles(testRepoPath, true, 1000)

		const expectedFiles = [
			"root_kept.txt",
			"subdir1",
			"subdir1/subdir1_kept.txt",
			"subdir2",
			"subdir2/subdir2_kept.txt",
		]

		// We need to sort both arrays to ensure a stable comparison
		const sortedFiles = files.sort()
		const sortedExpected = expectedFiles.sort()

		expect(sortedFiles).toEqual(sortedExpected)

		// Verify that ignored files are not present
		expect(files.some((f) => f.endsWith("root_ignored.txt"))).toBe(false)
		expect(files.some((f) => f.endsWith("subdir1_ignored.txt"))).toBe(false)
		expect(files.some((f) => f.endsWith("ignored_in_root"))).toBe(false)
	})
})
