// npx jest src/services/checkpoints/__tests__/WorktreeCheckpointService.test.ts

import fs from "fs/promises"
import path from "path"
import os from "os"

import { initWorkspaceRepo } from "./initWorkspaceRepo"

import { WorktreeCheckpointService } from "../WorktreeCheckpointService"

jest.mock("globby", () => ({
	globby: jest.fn().mockResolvedValue([]),
}))

describe("WorktreeCheckpointService", () => {
	const tmpDir = path.join(os.tmpdir(), WorktreeCheckpointService.name)
	const globalStorageDir = path.join(tmpDir, "globalStorage")
	const workspaceDir = path.join(tmpDir, "workspace")
	const log = console.log

	const cleanup = async () => {
		await fs.rm(globalStorageDir, { recursive: true, force: true })
		await fs.rm(workspaceDir, { recursive: true, force: true })
	}

	beforeEach(async () => {
		await cleanup()
		await initWorkspaceRepo({ workspaceDir })
		await fs.mkdir(globalStorageDir, { recursive: true })
	})

	afterAll(async () => {
		await cleanup()
	})

	it("achieves isolation", async () => {
		const service1 = WorktreeCheckpointService.create({
			taskId: "task1",
			shadowDir: globalStorageDir,
			workspaceDir,
			log,
		})
		await service1.initShadowGit()
		console.log(service1.checkpointsDir)
	})
})
