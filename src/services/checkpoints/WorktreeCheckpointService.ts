import fs from "fs/promises"
import * as path from "path"

import simpleGit, { SimpleGit } from "simple-git"

import { fileExistsAtPath } from "../../utils/fs"

import { CheckpointServiceOptions } from "./types"
import { ShadowCheckpointService } from "./ShadowCheckpointService"

export class WorktreeCheckpointService extends ShadowCheckpointService {
	private readonly worktreeDir: string

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log = console.log) {
		super(taskId, checkpointsDir, workspaceDir, log)
		this.configDir = this.checkpointsDir
		this.worktreeDir = path.join(path.dirname(this.checkpointsDir), taskId)
	}

	protected override isShadowRepoAvailable() {
		return fileExistsAtPath(path.join(this.configDir, "workspace"))
	}

	protected override async initializeShadowRepo() {
		const result = await super.initializeShadowRepo()
		const git = simpleGit(this.worktreeDir)
		return { ...result, git }
	}

	protected override async createShadowRepo(git: SimpleGit) {
		this.log(`[${this.constructor.name}#createShadowRepo] creating bare shadow git repo at ${this.configDir}`)
		await git.init(["--bare"])

		await fs.writeFile(path.join(this.configDir, "workspace"), this.workspaceDir)

		await git.addConfig("commit.gpgSign", "false") // Disable commit signing for shadow repo.
		await git.addConfig("user.name", "Roo Code")
		await git.addConfig("user.email", "noreply@example.com")

		await git.raw(["worktree", "add", "--orphan", this.worktreeDir])

		const worktreeGit = simpleGit(this.worktreeDir)
		await worktreeGit.checkoutLocalBranch("main")

		// await this.writeExcludeFile()
		await this.stageAll(worktreeGit)
		await worktreeGit.raw("--work-tree", this.worktreeDir, "commit", "-m", "Initial commit", "--allow-empty")
		return await worktreeGit.revparse(["HEAD"])
	}

	protected override stagePath(git: SimpleGit, path: string) {
		return git.raw("--work-tree", this.worktreeDir, "add", path)
	}

	protected override async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				const workspace = await fs.readFile(path.join(this.configDir, "workspace"), "utf-8")
				this.shadowGitConfigWorktree = workspace || undefined
			} catch (error) {
				this.log(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get workspace: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	public static create({ taskId, workspaceDir, shadowDir, log = console.log }: CheckpointServiceOptions) {
		const workspaceHash = this.hashWorkspaceDir(workspaceDir)
		const checkpointsDir = path.join(shadowDir, "checkpoints", workspaceHash, "parent")
		return new WorktreeCheckpointService(taskId, checkpointsDir, workspaceDir, log)
	}
}
