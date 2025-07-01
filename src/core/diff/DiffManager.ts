import { CheckpointDiff } from "../../services/checkpoints/types"
import { ShadowCheckpointService } from "../../services/checkpoints/ShadowCheckpointService"

export class DiffManager {
	private fileChanges: CheckpointDiff[] = []

	constructor(private checkpointService: ShadowCheckpointService) {}

	public async updateDiff(): Promise<void> {
		const to = this.checkpointService.baseHash
		this.fileChanges = await this.checkpointService.getDiff({ to })
	}

	public getFileChanges(): CheckpointDiff[] {
		return this.fileChanges
	}
}
