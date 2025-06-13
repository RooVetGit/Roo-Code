import NodeCache from "node-cache"
import getFolderSize from "get-folder-size"

import type { ClineMessage, HistoryItem } from "@roo-code/types"

import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { findLastIndex } from "../../shared/array"
import { getTaskDirectoryPath } from "../../utils/storage"

const taskSizeCache = new NodeCache({ stdTTL: 30, checkperiod: 5 * 60 })

export type TaskMetadataOptions = {
	messages: ClineMessage[]
	taskId: string
	taskNumber: number
	globalStoragePath: string
	workspace: string
}

export async function taskMetadata({
	messages,
	taskId,
	taskNumber,
	globalStoragePath,
	workspace,
}: TaskMetadataOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)

	// Handle edge case where there are no messages at all
	if (!messages || messages.length === 0) {
		const historyItem: HistoryItem = {
			id: taskId,
			number: taskNumber,
			ts: Date.now(),
			task: `Task #${taskNumber} (No messages)`,
			tokensIn: 0,
			tokensOut: 0,
			cacheWrites: 0,
			cacheReads: 0,
			totalCost: 0,
			size: 0,
			workspace,
		}
		return {
			historyItem,
			tokenUsage: {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0,
				contextTokens: 0,
			},
		}
	}

	const taskMessage = messages[0] // First message is always the task say.

	const lastRelevantMessage =
		messages[findLastIndex(messages, (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))] ||
		messages[0]

	let taskDirSize = taskSizeCache.get<number>(taskDir)

	if (taskDirSize === undefined) {
		try {
			taskDirSize = await getFolderSize.loose(taskDir)
			taskSizeCache.set<number>(taskDir, taskDirSize)
		} catch (error) {
			taskDirSize = 0
		}
	}

	const tokenUsage = getApiMetrics(combineApiRequests(combineCommandSequences(messages.slice(1))))

	// Ensure task name is never blank - provide fallback names
	let taskName = taskMessage.text?.trim() || ""
	if (!taskName) {
		taskName = `Task #${taskNumber} (Incomplete)`
	}

	const historyItem: HistoryItem = {
		id: taskId,
		number: taskNumber,
		ts: lastRelevantMessage.ts,
		task: taskName,
		tokensIn: tokenUsage.totalTokensIn,
		tokensOut: tokenUsage.totalTokensOut,
		cacheWrites: tokenUsage.totalCacheWrites,
		cacheReads: tokenUsage.totalCacheReads,
		totalCost: tokenUsage.totalCost,
		size: taskDirSize,
		workspace,
	}

	return { historyItem, tokenUsage }
}
