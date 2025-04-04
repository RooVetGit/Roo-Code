// npx jest src/services/checkpoints/__tests__/RepoPerWorkspaceCheckpointService.test.ts

import fs from "fs/promises"
import path from "path"
import os from "os"

import { initWorkspaceRepo } from "./initWorkspaceRepo"

import { RepoPerWorkspaceCheckpointService } from "../RepoPerWorkspaceCheckpointService"

jest.mock("globby", () => ({
	globby: jest.fn().mockResolvedValue([]),
}))

describe("RepoPerWorkspaceCheckpointService", () => {
	const tmpDir = path.join(os.tmpdir(), RepoPerWorkspaceCheckpointService.name)
	const globalStorageDir = path.join(tmpDir, "globalStorage")
	const workspaceDir = path.join(tmpDir, "workspace")
	const log = () => {}

	beforeEach(async () => {
		await initWorkspaceRepo({ workspaceDir })
		await fs.mkdir(globalStorageDir, { recursive: true })
	})

	afterEach(async () => {
		await fs.rm(globalStorageDir, { recursive: true, force: true })
		await fs.rm(workspaceDir, { recursive: true, force: true })
	})

	it("does not achieve isolation", async () => {
		const service1 = RepoPerWorkspaceCheckpointService.create({
			taskId: "task1",
			shadowDir: globalStorageDir,
			workspaceDir,
			log,
		})
		await service1.initShadowGit()

		await fs.writeFile(path.join(workspaceDir, "foo.txt"), "foo")
		const commit1 = await service1.saveCheckpoint("foo")
		expect(commit1?.commit).toBeTruthy()

		const service2 = RepoPerWorkspaceCheckpointService.create({
			taskId: "task2",
			shadowDir: globalStorageDir,
			workspaceDir,
			log,
		})
		await service2.initShadowGit()

		await fs.writeFile(path.join(workspaceDir, "bar.txt"), "bar")
		const commit2 = await service2.saveCheckpoint("bar")
		expect(commit2?.commit).toBeTruthy()

		const diff = await service1.getDiff({ to: commit1!.commit })
		expect(diff).toHaveLength(1)

		expect(await fs.readFile(path.join(workspaceDir, "foo.txt"), "utf-8")).toBe("foo")

		// Argh! This should not happen!
		expect(fs.readFile(path.join(workspaceDir, "bar.txt"), "utf-8")).rejects.toThrow(/no such file or directory/)
	})
})
