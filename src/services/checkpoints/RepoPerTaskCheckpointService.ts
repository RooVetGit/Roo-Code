import * as crypto from "crypto"
import * as path from "path"

import { CheckpointServiceOptions } from "./types"
import { ShadowCheckpointService } from "./ShadowCheckpointService"

export class RepoPerTaskCheckpointService extends ShadowCheckpointService {
	private readonly instanceId: string

	public static create({ taskId, workspaceDir, shadowDir, log = console.log }: CheckpointServiceOptions) {
		return new RepoPerTaskCheckpointService(
			taskId,
			path.join(shadowDir, "tasks", taskId, "checkpoints"),
			workspaceDir,
			log,
		)
	}

	private constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (...args: any[]) => void) {
		super(taskId, checkpointsDir, workspaceDir, log)
		this.instanceId = crypto.randomUUID()
		console.log(
			`[DEBUG] RepoPerTaskCheckpointService created for task ${this.taskId}. Instance ID: ${this.instanceId}`,
		)
	}
}
