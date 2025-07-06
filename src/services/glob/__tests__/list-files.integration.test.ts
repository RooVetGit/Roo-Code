import { describe, it, expect, beforeAll, afterAll } from "vitest"
import os from "os"
import * as path from "path"
import * as fs from "fs"
import simpleGit from "simple-git"
import { listFiles } from "../list-files"
import { getWorkspacePath } from "../../../utils/path"
import { randomInt } from "crypto"

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(),
	arePathsEqual: (a: string, b: string) => path.resolve(a) === path.resolve(b),
}))

describe("listFiles integration tests", () => {
	let testRepoPath: string

	beforeEach(async () => {
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

	afterEach(async () => {
		// Cleanup the temporary directory
		await fs.promises.rm(testRepoPath, { recursive: true, force: true })
	})

	it("should correctly handle multiple .gitignore files", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)

		const [files] = await listFiles(testRepoPath, true, 1000)

		const expectedFiles = [
			path.join(testRepoPath, "root_kept.txt"),
			path.join(testRepoPath, "subdir1", "subdir1_kept.txt"),
			path.join(testRepoPath, "subdir2", "subdir2_kept.txt"),
		].map((p) => p.replace(/\\/g, "/"))

		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()

		expect(sortedFiles).toEqual(sortedExpected)

		// Verify that ignored files are not present
		expect(normalizedFiles.some((f) => f.endsWith("root_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("subdir1_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("ignored_in_root"))).toBe(false)
	})

	it("should list only top-level non-ignored files in root (git repo)", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)
		const [files] = await listFiles(testRepoPath, false, 1000)
		const expectedFiles = [
			path.join(testRepoPath, "root_kept.txt"),
			path.join(testRepoPath, "subdir1"),
			path.join(testRepoPath, "subdir2"),
		].map((p) => p.replace(/\\/g, "/"))
		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()
		expect(sortedFiles).toEqual(sortedExpected)
		expect(normalizedFiles.some((f) => f.endsWith("root_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("ignored_in_root"))).toBe(false)
	})

	it("should list only top-level non-ignored files in subdir1 (git repo, nested)", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)
		const subdir1Path = path.join(testRepoPath, "subdir1")
		const [files] = await listFiles(subdir1Path, false, 1000)
		const expectedFiles = [path.join(subdir1Path, "subdir1_kept.txt")].map((p) => p.replace(/\\/g, "/"))
		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()
		expect(sortedFiles).toEqual(sortedExpected)
		expect(normalizedFiles.some((f) => f.endsWith("subdir1_ignored.txt"))).toBe(false)
	})
})

describe("listFiles in non-Git repository", () => {
	let testRepoPath: string

	beforeAll(async () => {
		// Create a temporary directory that is NOT a Git repo
		testRepoPath = path.join(os.tmpdir(), `test-non-git-repo-${Date.now()}${randomInt(256).toString(16)}`)
		await fs.promises.mkdir(testRepoPath, { recursive: true })

		// Create files and directories
		await fs.promises.writeFile(path.join(testRepoPath, "root_kept.txt"), "content")

		// Subdirectory 1
		const subdir1Path = path.join(testRepoPath, "subdir1")
		await fs.promises.mkdir(subdir1Path)
		await fs.promises.writeFile(path.join(subdir1Path, "subdir1_kept.txt"), "content")

		// Subdirectory 2
		const subdir2Path = path.join(testRepoPath, "subdir2")
		await fs.promises.mkdir(subdir2Path)
		await fs.promises.writeFile(path.join(subdir2Path, "subdir2_kept.txt"), "content")

		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)
	})

	afterAll(async () => {
		// Cleanup the temporary directory
		await fs.promises.rm(testRepoPath, { recursive: true, force: true })
	})

	it("should fall back to manual file search when not a git repository", async () => {
		const [files] = await listFiles(testRepoPath, true, 1000)

		const expectedFiles = [
			path.join(testRepoPath, "root_kept.txt"),
			path.join(testRepoPath, "subdir1", "subdir1_kept.txt"),
			path.join(testRepoPath, "subdir2", "subdir2_kept.txt"),
		].map((p) => p.replace(/\\/g, "/"))

		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()

		expect(sortedFiles).toEqual(sortedExpected)

		// Verify that ignored files are not present
		expect(normalizedFiles.some((f) => f.endsWith("root_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("subdir1_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("ignored_in_root"))).toBe(false)
	})

	it("should list only top-level non-ignored files in root (no git)", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)
		const [files] = await listFiles(testRepoPath, false, 1000)
		const expectedFiles = [
			path.join(testRepoPath, "root_kept.txt"),
			path.join(testRepoPath, "subdir1"),
			path.join(testRepoPath, "subdir2"),
		].map((p) => p.replace(/\\/g, "/"))
		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()
		expect(sortedFiles).toEqual(sortedExpected)
		expect(normalizedFiles.some((f) => f.endsWith("root_ignored.txt"))).toBe(false)
		expect(normalizedFiles.some((f) => f.endsWith("ignored_in_root"))).toBe(false)
	})

	it("should list only top-level non-ignored files in subdir1 (no git, nested)", async () => {
		vi.mocked(getWorkspacePath).mockReturnValue(testRepoPath)
		const subdir1Path = path.join(testRepoPath, "subdir1")
		const [files] = await listFiles(subdir1Path, false, 1000)
		const expectedFiles = [path.join(subdir1Path, "subdir1_kept.txt")].map((p) => p.replace(/\\/g, "/"))
		const normalizedFiles = files.map((p) => p.replace(/\\/g, "/"))
		const sortedFiles = normalizedFiles.sort()
		const sortedExpected = expectedFiles.sort()
		expect(sortedFiles).toEqual(sortedExpected)
		expect(normalizedFiles.some((f) => f.endsWith("subdir1_ignored.txt"))).toBe(false)
	})
})
