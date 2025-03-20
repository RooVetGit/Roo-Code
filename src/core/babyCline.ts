import { Cline, ClineOptions } from "./Cline"
import fs from "fs"

// create a function that appends messages to a .log file
function appendLog(message: string) {
	fs.appendFileSync("roo-code.log", message + "\n")
}

export class BabyCline extends Cline {
	constructor({
		provider,
		apiConfiguration,
		customInstructions,
		enableDiff,
		enableCheckpoints = true,
		checkpointStorage = "task",
		fuzzyMatchThreshold,
		task,
		images,
		historyItem,
		experiments,
		startTask = true,
		rootTask,
		parentTask,
		taskNumber,
	}: ClineOptions) {
		if (startTask) {
			appendLog("start task is true for BabyCline")
			appendLog("task: " + task)
			appendLog("images: " + images)
			appendLog("historyItem: " + historyItem)
		}
		super({
			provider,
			apiConfiguration,
			customInstructions,
			enableDiff,
			enableCheckpoints,
			checkpointStorage,
			fuzzyMatchThreshold,
			task,
			images,
			historyItem,
			experiments,
			startTask,
			rootTask,
			parentTask,
			taskNumber,
		})
	}
}
