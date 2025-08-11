import * as path from "path"
import * as fs from "fs/promises"

import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { getTaskDirectoryPath } from "../../utils/storage"
import { GlobalFileNames } from "../../shared/globalFileNames"

/**
 * Persistent state for OpenAI Native (Responses API) provider.
 * Stores encrypted reasoning content (via conversationHistory) and lineage (lastResponseId)
 * so stateless flows can be resumed across pauses, crashes, and task switches.
 */
export type OpenAiNativePersistentState = {
	lastResponseId?: string
	conversationHistory: any[]
	/**
	 * Pairing of assistant turn -> its encrypted reasoning artifact, for precise stateless restoration.
	 * Each item is a Responses API input item containing the encrypted artifact for that responseId.
	 */
	encryptedArtifacts?: Array<{ responseId: string; item: any }>
}

export type ReadOpenAiNativeStateOptions = {
	taskId: string
	globalStoragePath: string
}

export type SaveOpenAiNativeStateOptions = ReadOpenAiNativeStateOptions & {
	state: OpenAiNativePersistentState
}

/**
 * Read provider state persisted for a specific task.
 * Returns undefined if no state exists yet.
 */
export async function readOpenAiNativeState({
	taskId,
	globalStoragePath,
}: ReadOpenAiNativeStateOptions): Promise<OpenAiNativePersistentState | undefined> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.openAiNativeState)

	try {
		if (await fileExistsAtPath(filePath)) {
			const raw = await fs.readFile(filePath, "utf8")
			const parsed = JSON.parse(raw)
			// Basic shape sanity
			if (parsed && typeof parsed === "object" && Array.isArray(parsed.conversationHistory || [])) {
				return parsed as OpenAiNativePersistentState
			}
		}
	} catch (error) {
		console.error(`[OpenAiNativeState] Failed to read state for task ${taskId}:`, error)
	}

	return undefined
}

/**
 * Persist provider state to the task directory (atomic via safeWriteJson).
 */
export async function saveOpenAiNativeState({
	taskId,
	globalStoragePath,
	state,
}: SaveOpenAiNativeStateOptions): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.openAiNativeState)

	try {
		await safeWriteJson(filePath, state)
	} catch (error) {
		console.error(`[OpenAiNativeState] Failed to write state for task ${taskId}:`, error)
	}
}
