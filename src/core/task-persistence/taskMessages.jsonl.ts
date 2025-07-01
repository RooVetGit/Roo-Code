import * as path from "path"
import * as fs from "fs/promises"
import * as readline from "readline"
import { createReadStream } from "fs"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { ClineMessage } from "../../shared/ExtensionMessage"
import { getTaskDirectoryPath } from "../../shared/storagePathManager"

import type { ReadTaskMessagesOptions, SaveTaskMessagesOptions } from "./taskMessages"

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, `${GlobalFileNames.apiConversationHistory}l`)
	const fileExists = await fileExistsAtPath(filePath)

	if (!fileExists) {
		return []
	}

	const messages: ClineMessage[] = []
	const fileStream = createReadStream(filePath, { encoding: "utf8" })
	const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

	for await (const line of rl) {
		if (line.trim()) {
			messages.push(JSON.parse(line))
		}
	}

	return messages
}

export async function writeTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, `${GlobalFileNames.apiConversationHistory}l`)
	const content = messages.map((message) => JSON.stringify(message)).join("\n")
	await fs.writeFile(filePath, content)
}

export type AppendTaskMessageOptions = {
	message: ClineMessage
	taskId: string
	globalStoragePath: string
}

export async function appendTaskMessage({ message, taskId, globalStoragePath }: AppendTaskMessageOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, `${GlobalFileNames.apiConversationHistory}l`)
	await fs.appendFile(filePath, JSON.stringify(message) + "\n")
}
