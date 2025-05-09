import * as path from "path"

import { CheckpointServiceOptions } from "./types"
import { PatchCheckpointService } from "./PatchCheckpointService"

/**
 * Factory class for creating PatchCheckpointService instances
 */
export class PatchCheckpointServiceFactory {
	/**
	 * Create a new PatchCheckpointService instance
	 */
	public static create({ taskId, workspaceDir, shadowDir, log = console.log }: CheckpointServiceOptions) {
		return new PatchCheckpointService(
			taskId,
			path.join(shadowDir, "tasks", taskId, "checkpoints"),
			workspaceDir,
			log,
		)
	}
}
