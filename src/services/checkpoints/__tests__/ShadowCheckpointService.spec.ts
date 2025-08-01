// npx vitest run src/services/checkpoints/__tests__/ShadowCheckpointService.spec.ts

import { describe, it, expect, beforeEach, afterEach, afterAll, vitest } from "vitest"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { EventEmitter } from "events"

import { simpleGit, SimpleGit } from "simple-git"

import { fileExistsAtPath } from "../../../utils/fs"
import * as fileSearch from "../../../services/search/file-search"

import { RepoPerTaskCheckpointService } from "../RepoPerTaskCheckpointService"

const tmpDir = path.join(os.tmpdir(), "CheckpointService")

const initWorkspaceRepo = async ({
	workspaceDir,
	userName = "Roo Code",
	userEmail = "support@roocode.com",
	testFileName = "test.txt",
	textFileContent = "Hello, world!",
}: {
	workspaceDir: string
	userName?: string
	userEmail?: string
	testFileName?: string
	textFileContent?: string
}) => {
	// Create a temporary directory for testing.
	await fs.mkdir(workspaceDir, { recursive: true })

	// Initialize git repo.
	const git = simpleGit(workspaceDir)
	await git.init()
	await git.addConfig("user.name", userName)
	await git.addConfig("user.email", userEmail)

	// Create test file.
	const testFile = path.join(workspaceDir, testFileName)
	await fs.writeFile(testFile, textFileContent)

	// Create initial commit.
	await git.add(".")
	await git.commit("Initial commit")!

	return { git, testFile }
}

describe.each([[RepoPerTaskCheckpointService, "RepoPerTaskCheckpointService"]])(
	"CheckpointService",
	(klass, prefix) => {
		const taskId = "test-task"

		let workspaceGit: SimpleGit
		let testFile: string
		let service: RepoPerTaskCheckpointService

		beforeEach(async () => {
			const shadowDir = path.join(tmpDir, `${prefix}-${Date.now()}`)
			const workspaceDir = path.join(tmpDir, `workspace-${Date.now()}`)
			const repo = await initWorkspaceRepo({ workspaceDir })

			workspaceGit = repo.git
			testFile = repo.testFile

			service = await klass.create({ taskId, shadowDir, workspaceDir, log: () => {} })
			await service.initShadowGit()
		})

		afterEach(async () => {
			vitest.restoreAllMocks()
		})

		afterAll(async () => {
			await fs.rm(tmpDir, { recursive: true, force: true })
		})

		describe(`${klass.name}#getDiff`, () => {
			it("returns the correct diff between commits", async () => {
				await fs.writeFile(testFile, "Ahoy, world!")
				const commit1 = await service.saveCheckpoint("Ahoy, world!")
				expect(commit1?.commit).toBeTruthy()

				await fs.writeFile(testFile, "Goodbye, world!")
				const commit2 = await service.saveCheckpoint("Goodbye, world!")
				expect(commit2?.commit).toBeTruthy()

				const diff1 = await service.getDiff({ to: commit1!.commit })
				expect(diff1).toHaveLength(1)
				expect(diff1[0].paths.relative).toBe("test.txt")
				expect(diff1[0].paths.absolute).toBe(testFile)
				expect(diff1[0].content.before).toBe("Hello, world!")
				expect(diff1[0].content.after).toBe("Ahoy, world!")

				const diff2 = await service.getDiff({ from: service.baseHash, to: commit2!.commit })
				expect(diff2).toHaveLength(1)
				expect(diff2[0].paths.relative).toBe("test.txt")
				expect(diff2[0].paths.absolute).toBe(testFile)
				expect(diff2[0].content.before).toBe("Hello, world!")
				expect(diff2[0].content.after).toBe("Goodbye, world!")

				const diff12 = await service.getDiff({ from: commit1!.commit, to: commit2!.commit })
				expect(diff12).toHaveLength(1)
				expect(diff12[0].paths.relative).toBe("test.txt")
				expect(diff12[0].paths.absolute).toBe(testFile)
				expect(diff12[0].content.before).toBe("Ahoy, world!")
				expect(diff12[0].content.after).toBe("Goodbye, world!")
			})

			it("handles new files in diff", async () => {
				const newFile = path.join(service.workspaceDir, "new.txt")
				await fs.writeFile(newFile, "New file content")
				const commit = await service.saveCheckpoint("Add new file")
				expect(commit?.commit).toBeTruthy()

				const changes = await service.getDiff({ to: commit!.commit })
				const change = changes.find((c) => c.paths.relative === "new.txt")
				expect(change).toBeDefined()
				expect(change?.content.before).toBe("")
				expect(change?.content.after).toBe("New file content")
			})

			it("handles deleted files in diff", async () => {
				const fileToDelete = path.join(service.workspaceDir, "new.txt")
				await fs.writeFile(fileToDelete, "New file content")
				const commit1 = await service.saveCheckpoint("Add file")
				expect(commit1?.commit).toBeTruthy()

				await fs.unlink(fileToDelete)
				const commit2 = await service.saveCheckpoint("Delete file")
				expect(commit2?.commit).toBeTruthy()

				const changes = await service.getDiff({ from: commit1!.commit, to: commit2!.commit })
				const change = changes.find((c) => c.paths.relative === "new.txt")
				expect(change).toBeDefined()
				expect(change!.content.before).toBe("New file content")
				expect(change!.content.after).toBe("")
			})
		})

		describe(`${klass.name}#saveCheckpoint`, () => {
			it("creates a checkpoint if there are pending changes", async () => {
				await fs.writeFile(testFile, "Ahoy, world!")
				const commit1 = await service.saveCheckpoint("First checkpoint")
				expect(commit1?.commit).toBeTruthy()
				const details1 = await service.getDiff({ to: commit1!.commit })
				expect(details1[0].content.before).toContain("Hello, world!")
				expect(details1[0].content.after).toContain("Ahoy, world!")

				await fs.writeFile(testFile, "Hola, world!")
				const commit2 = await service.saveCheckpoint("Second checkpoint")
				expect(commit2?.commit).toBeTruthy()
				const details2 = await service.getDiff({ from: commit1!.commit, to: commit2!.commit })
				expect(details2[0].content.before).toContain("Ahoy, world!")
				expect(details2[0].content.after).toContain("Hola, world!")

				// Switch to checkpoint 1.
				await service.restoreCheckpoint(commit1!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Ahoy, world!")

				// Switch to checkpoint 2.
				await service.restoreCheckpoint(commit2!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Hola, world!")

				// Switch back to initial commit.
				expect(service.baseHash).toBeTruthy()
				await service.restoreCheckpoint(service.baseHash!)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Hello, world!")
			})

			it("preserves workspace and index state after saving checkpoint", async () => {
				// Create three files with different states: staged, unstaged, and mixed.
				const unstagedFile = path.join(service.workspaceDir, "unstaged.txt")
				const stagedFile = path.join(service.workspaceDir, "staged.txt")
				const mixedFile = path.join(service.workspaceDir, "mixed.txt")

				await fs.writeFile(unstagedFile, "Initial unstaged")
				await fs.writeFile(stagedFile, "Initial staged")
				await fs.writeFile(mixedFile, "Initial mixed")
				await workspaceGit.add(["."])
				const result = await workspaceGit.commit("Add initial files")
				expect(result?.commit).toBeTruthy()

				await fs.writeFile(unstagedFile, "Modified unstaged")

				await fs.writeFile(stagedFile, "Modified staged")
				await workspaceGit.add([stagedFile])

				await fs.writeFile(mixedFile, "Modified mixed - staged")
				await workspaceGit.add([mixedFile])
				await fs.writeFile(mixedFile, "Modified mixed - unstaged")

				// Save checkpoint.
				const commit = await service.saveCheckpoint("Test checkpoint")
				expect(commit?.commit).toBeTruthy()

				// Verify workspace state is preserved.
				const status = await workspaceGit.status()

				// All files should be modified.
				expect(status.modified).toContain("unstaged.txt")
				expect(status.modified).toContain("staged.txt")
				expect(status.modified).toContain("mixed.txt")

				// Only staged and mixed files should be staged.
				expect(status.staged).not.toContain("unstaged.txt")
				expect(status.staged).toContain("staged.txt")
				expect(status.staged).toContain("mixed.txt")

				// Verify file contents.
				expect(await fs.readFile(unstagedFile, "utf-8")).toBe("Modified unstaged")
				expect(await fs.readFile(stagedFile, "utf-8")).toBe("Modified staged")
				expect(await fs.readFile(mixedFile, "utf-8")).toBe("Modified mixed - unstaged")

				// Verify staged changes (--cached shows only staged changes).
				const stagedDiff = await workspaceGit.diff(["--cached", "mixed.txt"])
				expect(stagedDiff).toContain("-Initial mixed")
				expect(stagedDiff).toContain("+Modified mixed - staged")

				// Verify unstaged changes (shows working directory changes).
				const unstagedDiff = await workspaceGit.diff(["mixed.txt"])
				expect(unstagedDiff).toContain("-Modified mixed - staged")
				expect(unstagedDiff).toContain("+Modified mixed - unstaged")
			})

			it("does not create a checkpoint if there are no pending changes", async () => {
				const commit0 = await service.saveCheckpoint("Zeroth checkpoint")
				expect(commit0?.commit).toBeFalsy()

				await fs.writeFile(testFile, "Ahoy, world!")
				const commit1 = await service.saveCheckpoint("First checkpoint")
				expect(commit1?.commit).toBeTruthy()

				const commit2 = await service.saveCheckpoint("Second checkpoint")
				expect(commit2?.commit).toBeFalsy()
			})

			it("includes untracked files in checkpoints", async () => {
				// Create an untracked file.
				const untrackedFile = path.join(service.workspaceDir, "untracked.txt")
				await fs.writeFile(untrackedFile, "I am untracked!")

				// Save a checkpoint with the untracked file.
				const commit1 = await service.saveCheckpoint("Checkpoint with untracked file")
				expect(commit1?.commit).toBeTruthy()

				// Verify the untracked file was included in the checkpoint.
				const details = await service.getDiff({ to: commit1!.commit })
				expect(details[0].content.before).toContain("")
				expect(details[0].content.after).toContain("I am untracked!")

				// Create another checkpoint with a different state.
				await fs.writeFile(testFile, "Changed tracked file")
				const commit2 = await service.saveCheckpoint("Second checkpoint")
				expect(commit2?.commit).toBeTruthy()

				// Restore first checkpoint and verify untracked file is preserved.
				await service.restoreCheckpoint(commit1!.commit)
				expect(await fs.readFile(untrackedFile, "utf-8")).toBe("I am untracked!")
				expect(await fs.readFile(testFile, "utf-8")).toBe("Hello, world!")

				// Restore second checkpoint and verify untracked file remains (since
				// restore preserves untracked files)
				await service.restoreCheckpoint(commit2!.commit)
				expect(await fs.readFile(untrackedFile, "utf-8")).toBe("I am untracked!")
				expect(await fs.readFile(testFile, "utf-8")).toBe("Changed tracked file")
			})

			it("handles file deletions correctly", async () => {
				await fs.writeFile(testFile, "I am tracked!")
				const untrackedFile = path.join(service.workspaceDir, "new.txt")
				await fs.writeFile(untrackedFile, "I am untracked!")
				const commit1 = await service.saveCheckpoint("First checkpoint")
				expect(commit1?.commit).toBeTruthy()

				await fs.unlink(testFile)
				await fs.unlink(untrackedFile)
				const commit2 = await service.saveCheckpoint("Second checkpoint")
				expect(commit2?.commit).toBeTruthy()

				// Verify files are gone.
				await expect(fs.readFile(testFile, "utf-8")).rejects.toThrow()
				await expect(fs.readFile(untrackedFile, "utf-8")).rejects.toThrow()

				// Restore first checkpoint.
				await service.restoreCheckpoint(commit1!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("I am tracked!")
				expect(await fs.readFile(untrackedFile, "utf-8")).toBe("I am untracked!")

				// Restore second checkpoint.
				await service.restoreCheckpoint(commit2!.commit)
				await expect(fs.readFile(testFile, "utf-8")).rejects.toThrow()
				await expect(fs.readFile(untrackedFile, "utf-8")).rejects.toThrow()
			})

			it("does not create a checkpoint for ignored files", async () => {
				// Create a file that matches an ignored pattern (e.g., .log file).
				const ignoredFile = path.join(service.workspaceDir, "ignored.log")
				await fs.writeFile(ignoredFile, "Initial ignored content")

				const commit = await service.saveCheckpoint("Ignored file checkpoint")
				expect(commit?.commit).toBeFalsy()

				await fs.writeFile(ignoredFile, "Modified ignored content")

				const commit2 = await service.saveCheckpoint("Ignored file modified checkpoint")
				expect(commit2?.commit).toBeFalsy()

				expect(await fs.readFile(ignoredFile, "utf-8")).toBe("Modified ignored content")
			})

			it("does not create a checkpoint for LFS files", async () => {
				// Create a .gitattributes file with LFS patterns.
				const gitattributesPath = path.join(service.workspaceDir, ".gitattributes")
				await fs.writeFile(gitattributesPath, "*.lfs filter=lfs diff=lfs merge=lfs -text")

				// Re-initialize the service to trigger a write to .git/info/exclude.
				service = new klass(service.taskId, service.checkpointsDir, service.workspaceDir, () => {})
				const excludesPath = path.join(service.checkpointsDir, ".git", "info", "exclude")
				expect((await fs.readFile(excludesPath, "utf-8")).split("\n")).not.toContain("*.lfs")
				await service.initShadowGit()
				expect((await fs.readFile(excludesPath, "utf-8")).split("\n")).toContain("*.lfs")

				const commit0 = await service.saveCheckpoint("Add gitattributes")
				expect(commit0?.commit).toBeTruthy()

				// Create a file that matches an LFS pattern.
				const lfsFile = path.join(service.workspaceDir, "foo.lfs")
				await fs.writeFile(lfsFile, "Binary file content simulation")

				const commit = await service.saveCheckpoint("LFS file checkpoint")
				expect(commit?.commit).toBeFalsy()

				await fs.writeFile(lfsFile, "Modified binary content")

				const commit2 = await service.saveCheckpoint("LFS file modified checkpoint")
				expect(commit2?.commit).toBeFalsy()

				expect(await fs.readFile(lfsFile, "utf-8")).toBe("Modified binary content")
			})
		})

		describe(`${klass.name}#create`, () => {
			it("initializes a git repository if one does not already exist", async () => {
				const shadowDir = path.join(tmpDir, `${prefix}2-${Date.now()}`)
				const workspaceDir = path.join(tmpDir, `workspace2-${Date.now()}`)
				await fs.mkdir(workspaceDir)

				const newTestFile = path.join(workspaceDir, "test.txt")
				await fs.writeFile(newTestFile, "Hello, world!")
				expect(await fs.readFile(newTestFile, "utf-8")).toBe("Hello, world!")

				// Ensure the git repository was initialized.
				const newService = await klass.create({ taskId, shadowDir, workspaceDir, log: () => {} })
				const { created } = await newService.initShadowGit()
				expect(created).toBeTruthy()

				const gitDir = path.join(newService.checkpointsDir, ".git")
				expect(await fs.stat(gitDir)).toBeTruthy()

				// Save a new checkpoint: Ahoy, world!
				await fs.writeFile(newTestFile, "Ahoy, world!")
				const commit1 = await newService.saveCheckpoint("Ahoy, world!")
				expect(commit1?.commit).toBeTruthy()
				expect(await fs.readFile(newTestFile, "utf-8")).toBe("Ahoy, world!")

				// Restore "Hello, world!"
				await newService.restoreCheckpoint(newService.baseHash!)
				expect(await fs.readFile(newTestFile, "utf-8")).toBe("Hello, world!")

				// Restore "Ahoy, world!"
				await newService.restoreCheckpoint(commit1!.commit)
				expect(await fs.readFile(newTestFile, "utf-8")).toBe("Ahoy, world!")

				await fs.rm(newService.checkpointsDir, { recursive: true, force: true })
				await fs.rm(newService.workspaceDir, { recursive: true, force: true })
			})
		})

		describe(`${klass.name}#hasNestedGitRepositories`, () => {
			// NOTE: This test is commented out because ShadowCheckpointService no longer checks for nested git repositories.
			// The FCO integration changed the shadow git implementation to use .roo directory approach,
			// eliminating the need for nested git repository detection.
			/* 
			it("throws error when nested git repositories are detected during initialization", async () => {
				// Create a new temporary workspace and service for this test.
				const shadowDir = path.join(tmpDir, `${prefix}-nested-git-${Date.now()}`)
				const workspaceDir = path.join(tmpDir, `workspace-nested-git-${Date.now()}`)

				// Create a primary workspace repo.
				await fs.mkdir(workspaceDir, { recursive: true })
				const mainGit = simpleGit(workspaceDir)
				await mainGit.init()
				await mainGit.addConfig("user.name", "Roo Code")
				await mainGit.addConfig("user.email", "support@roocode.com")

				// Create a nested repo inside the workspace.
				const nestedRepoPath = path.join(workspaceDir, "nested-project")
				await fs.mkdir(nestedRepoPath, { recursive: true })
				const nestedGit = simpleGit(nestedRepoPath)
				await nestedGit.init()
				await nestedGit.addConfig("user.name", "Roo Code")
				await nestedGit.addConfig("user.email", "support@roocode.com")

				// Add a file to the nested repo.
				const nestedFile = path.join(nestedRepoPath, "nested-file.txt")
				await fs.writeFile(nestedFile, "Content in nested repo")
				await nestedGit.add(".")
				await nestedGit.commit("Initial commit in nested repo")

				// Create a test file in the main workspace.
				const mainFile = path.join(workspaceDir, "main-file.txt")
				await fs.writeFile(mainFile, "Content in main repo")
				await mainGit.add(".")
				await mainGit.commit("Initial commit in main repo")

				// Confirm nested git directory exists before initialization.
				const nestedGitDir = path.join(nestedRepoPath, ".git")
				const headFile = path.join(nestedGitDir, "HEAD")
				await fs.writeFile(headFile, "HEAD")
				expect(await fileExistsAtPath(nestedGitDir)).toBe(true)

				vitest.spyOn(fileSearch, "executeRipgrep").mockImplementation(({ args }) => {
					const searchPattern = args[4]

					if (searchPattern.includes(".git/HEAD")) {
						return Promise.resolve([
							{
								path: path.relative(workspaceDir, nestedGitDir),
								type: "folder",
								label: ".git",
							},
						])
					} else {
						return Promise.resolve([])
					}
				})

				const service = new klass(taskId, shadowDir, workspaceDir, () => {})

				// Verify that initialization throws an error when nested git repos are detected
				await expect(service.initShadowGit()).rejects.toThrow(
					"Checkpoints are disabled because nested git repositories were detected in the workspace",
				)

				// Clean up.
				vitest.restoreAllMocks()
				await fs.rm(shadowDir, { recursive: true, force: true })
				await fs.rm(workspaceDir, { recursive: true, force: true })
			})
			*/

			it("succeeds when no nested git repositories are detected", async () => {
				// Create a new temporary workspace and service for this test.
				const shadowDir = path.join(tmpDir, `${prefix}-no-nested-git-${Date.now()}`)
				const workspaceDir = path.join(tmpDir, `workspace-no-nested-git-${Date.now()}`)

				// Create a primary workspace repo without any nested repos.
				await fs.mkdir(workspaceDir, { recursive: true })
				const mainGit = simpleGit(workspaceDir)
				await mainGit.init()
				await mainGit.addConfig("user.name", "Roo Code")
				await mainGit.addConfig("user.email", "support@roocode.com")

				// Create a test file in the main workspace.
				const mainFile = path.join(workspaceDir, "main-file.txt")
				await fs.writeFile(mainFile, "Content in main repo")
				await mainGit.add(".")
				await mainGit.commit("Initial commit in main repo")

				vitest.spyOn(fileSearch, "executeRipgrep").mockImplementation(() => {
					// Return empty array to simulate no nested git repos found
					return Promise.resolve([])
				})

				const service = new klass(taskId, shadowDir, workspaceDir, () => {})

				// Verify that initialization succeeds when no nested git repos are detected
				await expect(service.initShadowGit()).resolves.not.toThrow()
				expect(service.isInitialized).toBe(true)

				// Clean up.
				vitest.restoreAllMocks()
				await fs.rm(shadowDir, { recursive: true, force: true })
				await fs.rm(workspaceDir, { recursive: true, force: true })
			})
		})

		describe(`${klass.name}#events`, () => {
			it("emits initialize event when service is created", async () => {
				const shadowDir = path.join(tmpDir, `${prefix}3-${Date.now()}`)
				const workspaceDir = path.join(tmpDir, `workspace3-${Date.now()}`)
				await fs.mkdir(workspaceDir, { recursive: true })

				const newTestFile = path.join(workspaceDir, "test.txt")
				await fs.writeFile(newTestFile, "Testing events!")

				// Create a mock implementation of emit to track events.
				const emitSpy = vitest.spyOn(EventEmitter.prototype, "emit")

				// Create the service - this will trigger the initialize event.
				const newService = await klass.create({ taskId, shadowDir, workspaceDir, log: () => {} })
				await newService.initShadowGit()

				// Find the initialize event in the emit calls.
				let initializeEvent = null

				for (let i = 0; i < emitSpy.mock.calls.length; i++) {
					const call = emitSpy.mock.calls[i]

					if (call[0] === "initialize") {
						initializeEvent = call[1]
						break
					}
				}

				// Restore the spy.
				emitSpy.mockRestore()

				// Verify the event was emitted with the correct data.
				expect(initializeEvent).not.toBeNull()
				expect(initializeEvent.type).toBe("initialize")
				expect(initializeEvent.workspaceDir).toBe(workspaceDir)
				expect(initializeEvent.baseHash).toBeTruthy()
				expect(typeof initializeEvent.created).toBe("boolean")
				expect(typeof initializeEvent.duration).toBe("number")

				// Verify the event was emitted with the correct data.
				expect(initializeEvent).not.toBeNull()
				expect(initializeEvent.type).toBe("initialize")
				expect(initializeEvent.workspaceDir).toBe(workspaceDir)
				expect(initializeEvent.baseHash).toBeTruthy()
				expect(typeof initializeEvent.created).toBe("boolean")
				expect(typeof initializeEvent.duration).toBe("number")

				// Clean up.
				await fs.rm(shadowDir, { recursive: true, force: true })
				await fs.rm(workspaceDir, { recursive: true, force: true })
			})

			it("emits checkpointCreated event when saving checkpoint", async () => {
				const checkpointHandler = vitest.fn()
				service.on("checkpointCreated", checkpointHandler)

				await fs.writeFile(testFile, "Changed content for checkpoint event test")
				const result = await service.saveCheckpoint("Test checkpoint event")
				expect(result?.commit).toBeDefined()

				expect(checkpointHandler).toHaveBeenCalledTimes(1)
				const eventData = checkpointHandler.mock.calls[0][0]
				expect(eventData.type).toBe("checkpointCreated")
				expect(eventData.toHash).toBeDefined()
				expect(eventData.toHash).toBe(result!.commit)
				expect(typeof eventData.duration).toBe("number")
			})

			it("emits restore event when restoring checkpoint", async () => {
				// First create a checkpoint to restore.
				await fs.writeFile(testFile, "Content for restore test")
				const commit = await service.saveCheckpoint("Checkpoint for restore test")
				expect(commit?.commit).toBeTruthy()

				// Change the file again.
				await fs.writeFile(testFile, "Changed after checkpoint")

				// Setup restore event listener.
				const restoreHandler = vitest.fn()
				service.on("restore", restoreHandler)

				// Restore the checkpoint.
				await service.restoreCheckpoint(commit!.commit)

				// Verify the event was emitted.
				expect(restoreHandler).toHaveBeenCalledTimes(1)
				const eventData = restoreHandler.mock.calls[0][0]
				expect(eventData.type).toBe("restore")
				expect(eventData.commitHash).toBe(commit!.commit)
				expect(typeof eventData.duration).toBe("number")

				// Verify the file was actually restored.
				expect(await fs.readFile(testFile, "utf-8")).toBe("Content for restore test")
			})

			it("emits error event when an error occurs", async () => {
				const errorHandler = vitest.fn()
				service.on("error", errorHandler)

				// Force an error by providing an invalid commit hash.
				const invalidCommitHash = "invalid-commit-hash"

				// Try to restore an invalid checkpoint.
				try {
					await service.restoreCheckpoint(invalidCommitHash)
				} catch (error) {
					// Expected to throw, we're testing the event emission.
				}

				// Verify the error event was emitted.
				expect(errorHandler).toHaveBeenCalledTimes(1)
				const eventData = errorHandler.mock.calls[0][0]
				expect(eventData.type).toBe("error")
				expect(eventData.error).toBeInstanceOf(Error)
			})

			it("supports multiple event listeners for the same event", async () => {
				const checkpointHandler1 = vitest.fn()
				const checkpointHandler2 = vitest.fn()

				service.on("checkpointCreated", checkpointHandler1)
				service.on("checkpointCreated", checkpointHandler2)

				await fs.writeFile(testFile, "Content for multiple listeners test")
				const result = await service.saveCheckpoint("Testing multiple listeners")

				// Verify both handlers were called with the same event data.
				expect(checkpointHandler1).toHaveBeenCalledTimes(1)
				expect(checkpointHandler2).toHaveBeenCalledTimes(1)

				const eventData1 = checkpointHandler1.mock.calls[0][0]
				const eventData2 = checkpointHandler2.mock.calls[0][0]

				expect(eventData1).toEqual(eventData2)
				expect(eventData1.type).toBe("checkpointCreated")
				expect(eventData1.toHash).toBe(result?.commit)
			})

			it("allows removing event listeners", async () => {
				const checkpointHandler = vitest.fn()

				// Add the listener.
				service.on("checkpointCreated", checkpointHandler)

				// Make a change and save a checkpoint.
				await fs.writeFile(testFile, "Content for remove listener test - part 1")
				await service.saveCheckpoint("Testing listener - part 1")

				// Verify handler was called.
				expect(checkpointHandler).toHaveBeenCalledTimes(1)
				checkpointHandler.mockClear()

				// Remove the listener.
				service.off("checkpointCreated", checkpointHandler)

				// Make another change and save a checkpoint.
				await fs.writeFile(testFile, "Content for remove listener test - part 2")
				await service.saveCheckpoint("Testing listener - part 2")

				// Verify handler was not called after being removed.
				expect(checkpointHandler).not.toHaveBeenCalled()
			})
		})

		describe(`${klass.name}#saveCheckpoint with allowEmpty option`, () => {
			it("creates checkpoint with allowEmpty=true even when no changes", async () => {
				// No changes made, but force checkpoint creation
				const result = await service.saveCheckpoint("Empty checkpoint", { allowEmpty: true })

				expect(result).toBeDefined()
				expect(result?.commit).toBeTruthy()
				expect(typeof result?.commit).toBe("string")
			})

			it("does not create checkpoint with allowEmpty=false when no changes", async () => {
				const result = await service.saveCheckpoint("No changes checkpoint", { allowEmpty: false })

				expect(result).toBeUndefined()
			})

			it("does not create checkpoint by default when no changes", async () => {
				const result = await service.saveCheckpoint("Default behavior checkpoint")

				expect(result).toBeUndefined()
			})

			it("creates checkpoint with changes regardless of allowEmpty setting", async () => {
				await fs.writeFile(testFile, "Modified content for allowEmpty test")

				const resultWithAllowEmpty = await service.saveCheckpoint("With changes and allowEmpty", {
					allowEmpty: true,
				})
				expect(resultWithAllowEmpty?.commit).toBeTruthy()

				await fs.writeFile(testFile, "Another modification for allowEmpty test")

				const resultWithoutAllowEmpty = await service.saveCheckpoint("With changes, no allowEmpty")
				expect(resultWithoutAllowEmpty?.commit).toBeTruthy()
			})

			it("emits checkpoint event for empty commits when allowEmpty=true", async () => {
				const checkpointHandler = vitest.fn()
				service.on("checkpointCreated", checkpointHandler)

				const result = await service.saveCheckpoint("Empty checkpoint event test", { allowEmpty: true })

				expect(checkpointHandler).toHaveBeenCalledTimes(1)
				const eventData = checkpointHandler.mock.calls[0][0]
				expect(eventData.type).toBe("checkpointCreated")
				expect(eventData.toHash).toBe(result?.commit)
				expect(typeof eventData.duration).toBe("number")
				expect(typeof eventData.isFirst).toBe("boolean") // Can be true or false depending on checkpoint history
			})

			it("does not emit checkpoint event when no changes and allowEmpty=false", async () => {
				// First, create a checkpoint to ensure we're not in the initial state
				await fs.writeFile(testFile, "Setup content")
				await service.saveCheckpoint("Setup checkpoint")

				// Reset the file to original state
				await fs.writeFile(testFile, "Hello, world!")
				await service.saveCheckpoint("Reset to original")

				// Now test with no changes and allowEmpty=false
				const checkpointHandler = vitest.fn()
				service.on("checkpointCreated", checkpointHandler)

				const result = await service.saveCheckpoint("No changes, no event", { allowEmpty: false })

				expect(result).toBeUndefined()
				expect(checkpointHandler).not.toHaveBeenCalled()
			})

			it("handles multiple empty checkpoints correctly", async () => {
				const commit1 = await service.saveCheckpoint("First empty checkpoint", { allowEmpty: true })
				expect(commit1?.commit).toBeTruthy()

				const commit2 = await service.saveCheckpoint("Second empty checkpoint", { allowEmpty: true })
				expect(commit2?.commit).toBeTruthy()

				// Commits should be different
				expect(commit1?.commit).not.toBe(commit2?.commit)
			})

			it("logs correct message for allowEmpty option", async () => {
				const logMessages: string[] = []
				const testService = await klass.create({
					taskId: "log-test",
					shadowDir: path.join(tmpDir, `log-test-${Date.now()}`),
					workspaceDir: service.workspaceDir,
					log: (message: string) => logMessages.push(message),
				})
				await testService.initShadowGit()

				await testService.saveCheckpoint("Test logging with allowEmpty", { allowEmpty: true })

				const saveCheckpointLogs = logMessages.filter(
					(msg) => msg.includes("starting checkpoint save") && msg.includes("allowEmpty: true"),
				)
				expect(saveCheckpointLogs).toHaveLength(1)

				await testService.saveCheckpoint("Test logging without allowEmpty")

				const defaultLogs = logMessages.filter(
					(msg) => msg.includes("starting checkpoint save") && msg.includes("allowEmpty: false"),
				)
				expect(defaultLogs).toHaveLength(1)
			})

			it("maintains checkpoint history with empty commits", async () => {
				// Create a regular checkpoint
				await fs.writeFile(testFile, "Regular change")
				const regularCommit = await service.saveCheckpoint("Regular checkpoint")
				expect(regularCommit?.commit).toBeTruthy()

				// Create an empty checkpoint
				const emptyCommit = await service.saveCheckpoint("Empty checkpoint", { allowEmpty: true })
				expect(emptyCommit?.commit).toBeTruthy()

				// Create another regular checkpoint
				await fs.writeFile(testFile, "Another regular change")
				const anotherCommit = await service.saveCheckpoint("Another regular checkpoint")
				expect(anotherCommit?.commit).toBeTruthy()

				// Verify we can restore to the empty checkpoint
				await service.restoreCheckpoint(emptyCommit!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Regular change")

				// Verify we can restore to other checkpoints
				await service.restoreCheckpoint(regularCommit!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Regular change")

				await service.restoreCheckpoint(anotherCommit!.commit)
				expect(await fs.readFile(testFile, "utf-8")).toBe("Another regular change")
			})

			it("handles getDiff correctly with empty commits", async () => {
				// Create a regular checkpoint
				await fs.writeFile(testFile, "Content before empty")
				const beforeEmpty = await service.saveCheckpoint("Before empty")
				expect(beforeEmpty?.commit).toBeTruthy()

				// Create an empty checkpoint
				const emptyCommit = await service.saveCheckpoint("Empty checkpoint", { allowEmpty: true })
				expect(emptyCommit?.commit).toBeTruthy()

				// Get diff between regular commit and empty commit
				const diff = await service.getDiff({
					from: beforeEmpty!.commit,
					to: emptyCommit!.commit,
				})

				// Should have no differences since empty commit doesn't change anything
				expect(diff).toHaveLength(0)
			})

			it("works correctly in integration with new task workflow", async () => {
				// Simulate the new task workflow where we force a checkpoint even with no changes
				// This tests the specific use case mentioned in the git commit

				// Start with a clean state (no pending changes)
				const initialState = await service.saveCheckpoint("Check initial state")
				expect(initialState).toBeUndefined() // No changes, so no commit

				// Force a checkpoint for new task (this is the new functionality)
				const newTaskCheckpoint = await service.saveCheckpoint("New task checkpoint", { allowEmpty: true })
				expect(newTaskCheckpoint?.commit).toBeTruthy()

				// Verify the checkpoint was created and can be restored
				await fs.writeFile(testFile, "Work done in new task")
				const workCommit = await service.saveCheckpoint("Work in new task")
				expect(workCommit?.commit).toBeTruthy()

				// Restore to the new task checkpoint
				await service.restoreCheckpoint(newTaskCheckpoint!.commit)

				// File should be back to original state
				expect(await fs.readFile(testFile, "utf-8")).toBe("Hello, world!")
			})
		})

		describe(`${klass.name}#getContent and file rejection workflow`, () => {
			it("should delete newly created files when getContent throws 'does not exist' error", async () => {
				// Test the complete workflow: create file -> checkpoint -> reject file -> verify deletion
				// This tests the integration between ShadowCheckpointService and FCO file rejection

				// 1. Create a new file that didn't exist in the base checkpoint
				const newFile = path.join(service.workspaceDir, "newly-created.txt")
				await fs.writeFile(newFile, "This file was created by LLM")

				// Verify file exists
				expect(await fs.readFile(newFile, "utf-8")).toBe("This file was created by LLM")

				// 2. Save a checkpoint containing the new file
				const commit = await service.saveCheckpoint("Add newly created file")
				expect(commit?.commit).toBeTruthy()

				// 3. Verify the diff shows the new file
				const changes = await service.getDiff({ to: commit!.commit })
				const newFileChange = changes.find((c) => c.paths.relative === "newly-created.txt")
				expect(newFileChange).toBeDefined()
				expect(newFileChange?.content.before).toBe("")
				expect(newFileChange?.content.after).toBe("This file was created by LLM")

				// 4. Simulate FCO file rejection: try to get content from baseHash (should throw)
				// This simulates what FCOMessageHandler.revertFileToCheckpoint() does
				await expect(service.getContent(service.baseHash!, newFile)).rejects.toThrow(
					/does not exist|exists on disk, but not in/,
				)

				// 5. Since getContent threw an error, simulate the deletion logic from FCOMessageHandler
				// In real FCO, this would be handled by FCOMessageHandler.revertFileToCheckpoint()
				try {
					await service.getContent(service.baseHash!, newFile)
				} catch (error) {
					// File didn't exist in previous checkpoint, so delete it
					const errorMessage = error instanceof Error ? error.message : String(error)
					if (
						errorMessage.includes("exists on disk, but not in") ||
						errorMessage.includes("does not exist")
					) {
						await fs.unlink(newFile)
					}
				}

				// 6. Verify the file was deleted
				await expect(fs.readFile(newFile, "utf-8")).rejects.toThrow("ENOENT")
			})

			it("should restore file content when getContent succeeds for modified files", async () => {
				// Test the complete workflow: modify file -> checkpoint -> reject file -> verify restoration
				// This tests the integration between ShadowCheckpointService and FCO file rejection for existing files

				// 1. Modify the existing test file
				const originalContent = await fs.readFile(testFile, "utf-8")
				expect(originalContent).toBe("Hello, world!")

				await fs.writeFile(testFile, "Modified by LLM")
				expect(await fs.readFile(testFile, "utf-8")).toBe("Modified by LLM")

				// 2. Save a checkpoint containing the modification
				const commit = await service.saveCheckpoint("Modify existing file")
				expect(commit?.commit).toBeTruthy()

				// 3. Verify the diff shows the modification
				const changes = await service.getDiff({ to: commit!.commit })
				const modifiedFileChange = changes.find((c) => c.paths.relative === "test.txt")
				expect(modifiedFileChange).toBeDefined()
				expect(modifiedFileChange?.content.before).toBe("Hello, world!")
				expect(modifiedFileChange?.content.after).toBe("Modified by LLM")

				// 4. Simulate FCO file rejection: get original content from baseHash
				// This simulates what FCOMessageHandler.revertFileToCheckpoint() does
				const previousContent = await service.getContent(service.baseHash!, testFile)
				expect(previousContent).toBe("Hello, world!")

				// 5. Simulate the restoration logic from FCOMessageHandler
				// In real FCO, this would be handled by FCOMessageHandler.revertFileToCheckpoint()
				await fs.writeFile(testFile, previousContent, "utf8")

				// 6. Verify the file was restored to its original content
				expect(await fs.readFile(testFile, "utf-8")).toBe("Hello, world!")
			})

			it("should handle getContent with absolute vs relative paths correctly", async () => {
				// Test that getContent works with both absolute and relative paths
				// This ensures FCOMessageHandler path handling is compatible with ShadowCheckpointService

				const originalContent = await fs.readFile(testFile, "utf-8")

				// Test with absolute path
				const absoluteContent = await service.getContent(service.baseHash!, testFile)
				expect(absoluteContent).toBe(originalContent)

				// Test with relative path
				const relativePath = path.relative(service.workspaceDir, testFile)
				const relativeContent = await service.getContent(
					service.baseHash!,
					path.join(service.workspaceDir, relativePath),
				)
				expect(relativeContent).toBe(originalContent)
			})
		})

		describe(`${klass.name} baseline handling`, () => {
			it("should track previous commit hash correctly for baseline management", async () => {
				// This tests the concept that the checkpoint service properly tracks
				// the previous commit hash which is used for baseline management

				// Initial state - no checkpoints yet
				expect(service.checkpoints).toHaveLength(0)
				expect(service.baseHash).toBeTruthy()

				// Save first checkpoint
				await fs.writeFile(testFile, "First modification")
				const firstCheckpoint = await service.saveCheckpoint("First checkpoint")
				expect(firstCheckpoint?.commit).toBeTruthy()

				// Service should now track this checkpoint
				expect(service.checkpoints).toHaveLength(1)
				expect(service.getCurrentCheckpoint()).toBe(firstCheckpoint?.commit)

				// Save second checkpoint - this is where previous commit tracking matters
				await fs.writeFile(testFile, "Second modification")
				const secondCheckpoint = await service.saveCheckpoint("Second checkpoint")
				expect(secondCheckpoint?.commit).toBeTruthy()

				// Service should track both checkpoints in order
				expect(service.checkpoints).toHaveLength(2)
				expect(service.checkpoints[0]).toBe(firstCheckpoint?.commit)
				expect(service.checkpoints[1]).toBe(secondCheckpoint?.commit)

				// The previous commit for the second checkpoint would be the first checkpoint
				// This is what the FCO baseline logic uses to set proper baselines
				const previousCommitForSecond = service.checkpoints[0]
				expect(previousCommitForSecond).toBe(firstCheckpoint?.commit)
			})

			it("should handle baseline scenarios for new vs existing tasks", async () => {
				// This tests the baseline initialization concepts that FCO relies on

				// === New Task Scenario ===
				// For new tasks, baseline should be set to service.baseHash (not "HEAD" string)
				const newTaskBaseline = service.baseHash
				expect(newTaskBaseline).toBeTruthy()
				expect(newTaskBaseline).not.toBe("HEAD") // Should be actual git hash

				// === Existing Task Scenario ===
				// Create some checkpoints to simulate an existing task
				await fs.writeFile(testFile, "Existing task modification 1")
				const existingCheckpoint1 = await service.saveCheckpoint("Existing checkpoint 1")

				await fs.writeFile(testFile, "Existing task modification 2")
				const existingCheckpoint2 = await service.saveCheckpoint("Existing checkpoint 2")

				// For existing task resumption, the baseline should be set to prevent
				// showing historical changes. The "previous commit" for the next checkpoint
				// would be existingCheckpoint2
				const resumptionBaseline = service.getCurrentCheckpoint()
				expect(resumptionBaseline).toBe(existingCheckpoint2?.commit)
				expect(resumptionBaseline).not.toBe("HEAD") // Should be actual git hash

				// When existing task creates new checkpoint, previous commit is tracked
				await fs.writeFile(testFile, "New work in existing task")
				const newWorkCheckpoint = await service.saveCheckpoint("New work checkpoint")

				// The baseline for FCO should be set to existingCheckpoint2 to show only new work
				const baselineForNewWork = service.checkpoints[service.checkpoints.length - 2]
				expect(baselineForNewWork).toBe(existingCheckpoint2?.commit)
			})
		})

		describe(`${klass.name} baseline initialization with FileChangeManager integration`, () => {
			// Mock the FileChangeManager to test baseline initialization scenarios
			const mockFileChangeManager = {
				_baseline: "HEAD" as string,
				getChanges: vitest.fn(),
				updateBaseline: vitest.fn(),
				setFiles: vitest.fn(),
				getLLMOnlyChanges: vitest.fn(),
			}

			// Mock the provider
			const mockProvider = {
				getFileChangeManager: vitest.fn(() => mockFileChangeManager),
				log: vitest.fn(),
			}

			beforeEach(() => {
				vitest.clearAllMocks()
				mockFileChangeManager.getChanges.mockReturnValue({
					baseCheckpoint: "HEAD",
					files: [],
				})
				mockFileChangeManager.updateBaseline.mockResolvedValue(undefined)
				mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue({ files: [] })
			})

			describe("New task scenario", () => {
				it("should set baseline to baseHash for new tasks on initialize event", async () => {
					// Test FileChangeManager baseline update when checkpoint service initializes

					// Set up event handler to simulate what happens in getCheckpointService
					service.on("initialize", async () => {
						// Simulate FileChangeManager baseline update for new task
						const fcm = mockProvider.getFileChangeManager()
						if (fcm) {
							try {
								await fcm.updateBaseline(service.baseHash!)
								mockProvider.log(
									`New task: Updated FileChangeManager baseline from HEAD to ${service.baseHash}`,
								)
							} catch (error) {
								mockProvider.log(`Failed to update FileChangeManager baseline: ${error}`)
							}
						}
					})

					// Trigger the initialize event
					service.emit("initialize", {
						type: "initialize",
						workspaceDir: service.workspaceDir,
						baseHash: service.baseHash!,
						created: true,
						duration: 100,
					})

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Verify that baseline was updated to baseHash for new task
					expect(mockFileChangeManager.updateBaseline).toHaveBeenCalledWith(service.baseHash)
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(
							`New task: Updated FileChangeManager baseline from HEAD to ${service.baseHash}`,
						),
					)
				})
			})

			describe("Existing task scenario", () => {
				it("should not immediately set baseline for existing tasks, waiting for first checkpoint", async () => {
					// Create some existing checkpoints to simulate an existing task
					await fs.writeFile(testFile, "Existing task content")
					const existingCheckpoint = await service.saveCheckpoint("Existing checkpoint")
					expect(existingCheckpoint?.commit).toBeTruthy()

					// Clear the mocks to focus on the existing task behavior
					vitest.clearAllMocks()

					// Set up event handler for existing task (has checkpoints)
					service.on("initialize", async () => {
						// For existing tasks with checkpoints, don't immediately update baseline
						const hasExistingCheckpoints = service.checkpoints.length > 0
						if (hasExistingCheckpoints) {
							mockProvider.log(
								"Existing task: Will set baseline to first new checkpoint to show only fresh changes",
							)
						}
					})

					// Trigger the initialize event
					service.emit("initialize", {
						type: "initialize",
						workspaceDir: service.workspaceDir,
						baseHash: service.baseHash!,
						created: false,
						duration: 50,
					})

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Verify that baseline was NOT immediately updated for existing task
					expect(mockFileChangeManager.updateBaseline).not.toHaveBeenCalled()
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(
							"Existing task: Will set baseline to first new checkpoint to show only fresh changes",
						),
					)
				})

				it("should set baseline to fromHash when first checkpoint is created for existing task", async () => {
					// Create existing checkpoints
					await fs.writeFile(testFile, "Existing content 1")
					const existingCheckpoint1 = await service.saveCheckpoint("Existing checkpoint 1")

					// Mock FileChangeManager to return HEAD baseline (indicating existing task)
					mockFileChangeManager.getChanges.mockReturnValue({
						baseCheckpoint: "HEAD",
						files: [],
					})

					// Set up event handler for checkpointCreated
					service.on("checkpointCreated", async (event) => {
						// Simulate baseline update logic for existing task with HEAD baseline
						const fcm = mockProvider.getFileChangeManager()
						if (fcm) {
							const changes = fcm.getChanges()
							if (changes.baseCheckpoint === "HEAD") {
								await fcm.updateBaseline(event.fromHash)
								mockProvider.log(
									`Existing task with HEAD baseline - setting baseline to fromHash ${event.fromHash} for fresh tracking`,
								)
							}
						}
					})

					// Create a new checkpoint (simulates first checkpoint after task resumption)
					await fs.writeFile(testFile, "New work content")
					const newCheckpoint = await service.saveCheckpoint("New work checkpoint")
					expect(newCheckpoint?.commit).toBeTruthy()

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Verify that baseline was updated to fromHash for existing task with HEAD baseline
					expect(mockFileChangeManager.updateBaseline).toHaveBeenCalledWith(existingCheckpoint1?.commit)
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(
							`Existing task with HEAD baseline - setting baseline to fromHash ${existingCheckpoint1?.commit} for fresh tracking`,
						),
					)
				})

				it("should preserve existing valid baseline for established existing tasks", async () => {
					// Create existing checkpoints
					await fs.writeFile(testFile, "Established content")
					const establishedCheckpoint = await service.saveCheckpoint("Established checkpoint")

					// Mock FileChangeManager to return valid existing baseline (not HEAD)
					const existingBaseline = "established-baseline-xyz789"
					mockFileChangeManager.getChanges.mockReturnValue({
						baseCheckpoint: existingBaseline,
						files: [],
					})

					// Mock successful baseline validation
					const mockGetDiff = vitest.spyOn(service, "getDiff").mockResolvedValue([])

					// Set up event handler for checkpointCreated
					service.on("checkpointCreated", async (event) => {
						// Simulate baseline validation logic for existing task with non-HEAD baseline
						const fcm = mockProvider.getFileChangeManager()
						if (fcm) {
							const changes = fcm.getChanges()
							if (changes.baseCheckpoint !== "HEAD") {
								try {
									// Validate existing baseline
									await service.getDiff({ from: changes.baseCheckpoint })
									mockProvider.log(
										`Using existing baseline ${changes.baseCheckpoint} for cumulative tracking`,
									)
								} catch (error) {
									// Baseline validation failed, update to fromHash
									await fcm.updateBaseline(event.fromHash)
									mockProvider.log(`Baseline validation failed for ${changes.baseCheckpoint}`)
									mockProvider.log(`Updating baseline to fromHash: ${event.fromHash}`)
								}
							}
						}
					})

					// Create a new checkpoint
					await fs.writeFile(testFile, "More established work")
					const newEstablishedCheckpoint = await service.saveCheckpoint("More established work")
					expect(newEstablishedCheckpoint?.commit).toBeTruthy()

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Verify that baseline was NOT updated (existing valid baseline preserved)
					expect(mockFileChangeManager.updateBaseline).not.toHaveBeenCalled()
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(`Using existing baseline ${existingBaseline} for cumulative tracking`),
					)

					// Restore the original method
					mockGetDiff.mockRestore()
				})

				it("should update baseline to fromHash when existing baseline is invalid", async () => {
					// Create existing checkpoint
					await fs.writeFile(testFile, "Content with invalid baseline")
					const validCheckpoint = await service.saveCheckpoint("Valid checkpoint")

					// Mock FileChangeManager to return invalid existing baseline
					const invalidBaseline = "invalid-baseline-hash"
					mockFileChangeManager.getChanges.mockReturnValue({
						baseCheckpoint: invalidBaseline,
						files: [],
					})

					// Mock failed baseline validation
					const mockGetDiff = vitest
						.spyOn(service, "getDiff")
						.mockRejectedValue(new Error("Invalid baseline hash"))

					// Set up event handler for checkpointCreated
					service.on("checkpointCreated", async (event) => {
						// Simulate baseline validation logic for existing task with invalid baseline
						const fcm = mockProvider.getFileChangeManager()
						if (fcm) {
							const changes = fcm.getChanges()
							if (changes.baseCheckpoint !== "HEAD") {
								try {
									// Try to validate existing baseline
									await service.getDiff({ from: changes.baseCheckpoint })
									mockProvider.log(
										`Using existing baseline ${changes.baseCheckpoint} for cumulative tracking`,
									)
								} catch (error) {
									// Baseline validation failed, update to fromHash
									await fcm.updateBaseline(event.fromHash)
									mockProvider.log(`Baseline validation failed for ${changes.baseCheckpoint}`)
									mockProvider.log(`Updating baseline to fromHash: ${event.fromHash}`)
								}
							}
						}
					})

					// Create a new checkpoint
					await fs.writeFile(testFile, "Work with invalid baseline recovery")
					const recoveryCheckpoint = await service.saveCheckpoint("Recovery checkpoint")
					expect(recoveryCheckpoint?.commit).toBeTruthy()

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Verify that baseline was updated to fromHash due to validation failure
					expect(mockFileChangeManager.updateBaseline).toHaveBeenCalledWith(validCheckpoint?.commit)
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(`Baseline validation failed for ${invalidBaseline}`),
					)
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining(`Updating baseline to fromHash: ${validCheckpoint?.commit}`),
					)

					// Restore the original method
					mockGetDiff.mockRestore()
				})
			})

			describe("Edge cases", () => {
				it("should handle missing FileChangeManager gracefully", async () => {
					// Mock provider to return no FileChangeManager
					const mockProviderNoFCM = {
						getFileChangeManager: vitest.fn(() => undefined),
						log: vitest.fn(),
					}

					// Set up event handler
					service.on("initialize", async () => {
						const fcm = mockProviderNoFCM.getFileChangeManager()
						if (!fcm) {
							// Should not throw and should not try to update baseline
							return
						}
					})

					// Trigger the initialize event
					service.emit("initialize", {
						type: "initialize",
						workspaceDir: service.workspaceDir,
						baseHash: service.baseHash!,
						created: true,
						duration: 100,
					})

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Should not throw and should not try to update baseline
					expect(mockFileChangeManager.updateBaseline).not.toHaveBeenCalled()
				})

				it("should handle FileChangeManager baseline update errors gracefully", async () => {
					// Mock updateBaseline to throw an error
					mockFileChangeManager.updateBaseline.mockRejectedValue(new Error("Update failed"))

					// Set up event handler with error handling
					service.on("initialize", async () => {
						const fcm = mockProvider.getFileChangeManager()
						if (fcm) {
							try {
								await fcm.updateBaseline(service.baseHash!)
								mockProvider.log(
									`New task: Updated FileChangeManager baseline from HEAD to ${service.baseHash}`,
								)
							} catch (error) {
								mockProvider.log(`Failed to update FileChangeManager baseline: ${error}`)
							}
						}
					})

					// Trigger the initialize event
					service.emit("initialize", {
						type: "initialize",
						workspaceDir: service.workspaceDir,
						baseHash: service.baseHash!,
						created: true,
						duration: 100,
					})

					// Wait for async operations to complete
					await new Promise((resolve) => setTimeout(resolve, 0))

					// Should log the error but not throw
					expect(mockProvider.log).toHaveBeenCalledWith(
						expect.stringContaining("Failed to update FileChangeManager baseline: Error: Update failed"),
					)
				})
			})
		})
	},
)
