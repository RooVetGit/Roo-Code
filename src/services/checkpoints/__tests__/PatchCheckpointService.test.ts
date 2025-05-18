// npx jest src/services/checkpoints/__tests__/PatchCheckpointService.test.ts

import fs from "fs/promises"
import path from "path"
import os from "os"

import { PatchCheckpointService } from "../PatchCheckpointService"
import { PatchCheckpointServiceFactory } from "../PatchCheckpointServiceFactory"

jest.setTimeout(10_000)

const tmpDir = path.join(os.tmpdir(), "PatchCheckpointService")

async function initWorkspaceRepo({ workspaceDir }: { workspaceDir: string }) {
	await fs.mkdir(workspaceDir, { recursive: true })
	const testFile = path.join(workspaceDir, "test.txt")
	await fs.writeFile(testFile, "Hello, world!")

	return { testFile }
}

describe("PatchCheckpointService", () => {
	const taskId = "test-task"

	let testFile: string
	let service: PatchCheckpointService

	beforeEach(async () => {
		const shadowDir = path.join(tmpDir, `PatchCheckpointService-${Date.now()}`)
		const workspaceDir = path.join(tmpDir, `workspace-${Date.now()}`)
		const repo = await initWorkspaceRepo({ workspaceDir })

		testFile = repo.testFile

		service = PatchCheckpointServiceFactory.create({
			taskId,
			shadowDir,
			workspaceDir,
			log: () => {},
		})
		await service.initialize()
	})

	afterEach(async () => {
		await service.close()
		jest.restoreAllMocks()
	})

	afterAll(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("should initialize and create a base snapshot", async () => {
		expect(service.isInitialized).toBe(true)
		expect(service.baseSnapshot).toBeDefined()
	})

	it("should save a checkpoint", async () => {
		// Modify the test file
		await fs.writeFile(testFile, "Hello, world! Updated")

		// Save a checkpoint
		const result = await service.saveCheckpoint("Test checkpoint")

		// Verify the checkpoint was saved
		expect(result).toBeDefined()
		expect(result?.commit).toBeDefined()
	})

	it("should not save a checkpoint if no changes", async () => {
		// Save a checkpoint without making changes
		const result = await service.saveCheckpoint("No changes")

		// Verify no checkpoint was saved
		expect(result).toBeUndefined()
	})

	it("should restore a checkpoint", async () => {
		// Modify the test file and save a checkpoint
		await fs.writeFile(testFile, "Hello, world! Updated")
		const checkpoint1 = await service.saveCheckpoint("Checkpoint 1")

		// Modify the file again
		await fs.writeFile(testFile, "Hello, world! Updated again")

		// Restore the checkpoint
		await service.restoreCheckpoint(checkpoint1!.commit)

		// Verify the file was restored
		const content = await fs.readFile(testFile, "utf-8")
		expect(content).toBe("Hello, world! Updated")
	})

	it("should get diff between checkpoints", async () => {
		// Modify the test file and save a checkpoint
		await fs.writeFile(testFile, "Hello, world! Updated")
		const checkpoint1 = await service.saveCheckpoint("Checkpoint 1")

		// Modify the file again and save another checkpoint
		await fs.writeFile(testFile, "Hello, world! Updated again")
		const checkpoint2 = await service.saveCheckpoint("Checkpoint 2")

		// Get diff between checkpoints
		const diff = await service.getDiff({
			from: checkpoint1!.commit,
			to: checkpoint2!.commit,
		})

		// Verify the diff
		expect(diff).toHaveLength(1)
		expect(diff[0].paths.relative).toBe("test.txt")
		expect(diff[0].content.before).toBe("Hello, world! Updated")
		expect(diff[0].content.after).toBe("Hello, world! Updated again")
	})

	it("should handle multiple files", async () => {
		// Create a second file
		const testFile2 = path.join(path.dirname(testFile), "test2.txt")
		await fs.writeFile(testFile2, "Second file")

		// Save a checkpoint
		const checkpoint1 = await service.saveCheckpoint("Checkpoint with two files")

		// Modify both files
		await fs.writeFile(testFile, "Hello, world! Updated")
		await fs.writeFile(testFile2, "Second file updated")

		// Save another checkpoint
		const checkpoint2 = await service.saveCheckpoint("Updated both files")

		// Get diff between checkpoints
		const diff = await service.getDiff({
			from: checkpoint1!.commit,
			to: checkpoint2!.commit,
		})

		// Verify the diff
		expect(diff).toHaveLength(2)

		// Restore the first checkpoint
		await service.restoreCheckpoint(checkpoint1!.commit)

		// Verify both files were restored
		const content1 = await fs.readFile(testFile, "utf-8")
		const content2 = await fs.readFile(testFile2, "utf-8")
		expect(content1).toBe("Hello, world!")
		expect(content2).toBe("Second file")
	})

	it("should handle file deletion", async () => {
		// Create a second file
		const testFile2 = path.join(path.dirname(testFile), "test2.txt")
		await fs.writeFile(testFile2, "File to be deleted")

		// Save a checkpoint
		const checkpoint1 = await service.saveCheckpoint("Checkpoint with two files")

		// Delete the second file
		await fs.unlink(testFile2)

		// Save another checkpoint
		const checkpoint2 = await service.saveCheckpoint("Deleted second file")

		// Get diff between checkpoints
		const diff = await service.getDiff({
			from: checkpoint1!.commit,
			to: checkpoint2!.commit,
		})

		// Verify the diff shows the deletion
		expect(diff.some((d) => d.paths.relative.includes("test2.txt") && d.content.after === "")).toBe(true)

		// Restore the first checkpoint
		await service.restoreCheckpoint(checkpoint1!.commit)

		// Verify the deleted file was restored
		const exists = await fs
			.stat(testFile2)
			.then(() => true)
			.catch(() => false)
		expect(exists).toBe(true)

		const content = await fs.readFile(testFile2, "utf-8")
		expect(content).toBe("File to be deleted")
	})
})
