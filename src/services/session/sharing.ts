import { z } from "zod"
import * as vscode from "vscode"

import type { HistoryItem, ClineMessage } from "@roo-code/types"

import { SerializedSessionSchema, SerializedSession } from "./schema"
import { readTaskMessages, saveTaskMessages } from "../../core/task-persistence/taskMessages"
import { readApiMessages, saveApiMessages } from "../../core/task-persistence/apiMessages"
import { getTaskDirectoryPath } from "../../utils/storage"
import { GlobalFileNames } from "../../shared/globalFileNames"

const CURRENT_VERSION = "1.0.0"

export async function exportTask(task: HistoryItem, globalStoragePath: string): Promise<void> {
	const messages = await readTaskMessages({ taskId: task.id, globalStoragePath })
	const apiMessages = await readApiMessages({ taskId: task.id, globalStoragePath })

	const session: SerializedSession = {
		version: CURRENT_VERSION,
		task,
		messages,
	}

	const saveDialogOptions: vscode.SaveDialogOptions = {
		saveLabel: "Export Task",
		filters: {
			"JSON Files": ["json"],
		},
		defaultUri: vscode.Uri.file(`${task.task.replace(/[^a-z0-9]/gi, "_")}.json`),
	}

	const uri = await vscode.window.showSaveDialog(saveDialogOptions)
	if (!uri) return

	await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(session, null, 2)))
	vscode.window.showInformationMessage(`Task exported to ${uri.fsPath}`)
}

export async function importTask(globalStoragePath: string): Promise<void> {
	const openDialogOptions: vscode.OpenDialogOptions = {
		canSelectMany: false,
		openLabel: "Import Task",
		filters: {
			"JSON Files": ["json"],
		},
	}

	const uris = await vscode.window.showOpenDialog(openDialogOptions)
	if (!uris || uris.length === 0) return

	const uri = uris[0]
	const fileContent = await vscode.workspace.fs.readFile(uri)
	const json = JSON.parse(fileContent.toString())

	const parseResult = SerializedSessionSchema.safeParse(json)
	if (!parseResult.success) {
		vscode.window.showErrorMessage(`Invalid task file: ${parseResult.error.message}`)
		return
	}

	const session = parseResult.data
	const newTaskId = session.task.id

	await saveTaskMessages({
		taskId: newTaskId,
		globalStoragePath,
		messages: session.messages,
	})

	const taskDir = await getTaskDirectoryPath(globalStoragePath, newTaskId)

	vscode.window.showInformationMessage(`Task "${session.task.task}" imported successfully.`)
}

// ========== Cloud Sharing (Export/Import via Website) ==========

/**
 * Cloud session sharing allows:
 * 1) VS Code extension to POST a SerializedSession to the website
 * 2) Website returns a session id and share URL
 * 3) Other users can GET the session by id or via the API URL embedded in the share page
 *
 * Website API contract (MVP):
 * - POST /api/sessions
 *   Body: SerializedSession (see SerializedSessionSchema)
 *   Response: 201 { id: string, url?: string }
 * - GET /api/sessions/:id
 *   Response: 200 SerializedSession
 *
 * Base URL resolution order:
 * - VS Code setting: syntx.sessionSharing.baseUrl (e.g., https://sessions.syntx.dev)
 * - Env var: SYNTX_SESSIONS_BASE_URL
 * If not set, the commands will show a VS Code error.
 */

const SETTINGS_NAMESPACE = "syntx"
const SETTINGS_KEY = "sessionSharing.baseUrl"
const ENV_BASE_URL = "SYNTX_SESSIONS_BASE_URL"

function resolveBaseUrl(): string | undefined {
	const cfg = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string>(SETTINGS_KEY)
	const env = process.env[ENV_BASE_URL]
	const base = (cfg?.trim() || env?.trim() || "").replace(/\/+$/, "")
	return base || undefined
}

function ensureFetchAvailable(): typeof fetch | undefined {
	// VS Code on Node >=18 has global fetch. If not, instruct configuration.
	if (typeof fetch !== "function") {
		vscode.window.showErrorMessage(
			"Global fetch is not available in this environment. Please use VS Code with Node >= 18 or add a fetch polyfill.",
		)
		return undefined
	}
	return fetch
}

function apiUrl(baseUrl: string, path: string): string {
	return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`
}

function shareUrl(baseUrl: string, id: string): string {
	return `${baseUrl}/session/${encodeURIComponent(id)}`
}

/**
 * Export current task session to cloud.
 * Returns the share URL on success (also copies to clipboard).
 */
export async function exportTaskToCloud(
	task: HistoryItem,
	globalStoragePath: string,
	opts?: { token?: string },
): Promise<string | undefined> {
	const f = ensureFetchAvailable()
	if (!f) return

	const baseUrl = resolveBaseUrl()
	if (!baseUrl) {
		vscode.window.showErrorMessage(
			`Session sharing base URL not set. Configure "${SETTINGS_NAMESPACE}.${SETTINGS_KEY}" or env ${ENV_BASE_URL}.`,
		)
		return
	}

	const messages = await readTaskMessages({ taskId: task.id, globalStoragePath })
	// apiMessages are not part of the current export schema; kept here if we extend later
	// const apiMessages = await readApiMessages({ taskId: task.id, globalStoragePath });

	const session: SerializedSession = {
		version: CURRENT_VERSION,
		task,
		messages,
	}

	try {
		const res = await f(apiUrl(baseUrl, "/api/sessions"), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(opts?.token ? { "Syntx-Api-Key": `${opts.token}` } : {}),
			},
			body: JSON.stringify(session),
		})

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			vscode.window.showErrorMessage(`Export failed: ${res.status} ${text || res.statusText}`)
			return
		}

		const body = (await res.json().catch(() => ({}) as any)) as { id?: string; url?: string }
		const id = body.id
		if (!id) {
			vscode.window.showErrorMessage("Export succeeded but response did not include an id.")
			return
		}
		const url = body.url || shareUrl(baseUrl, id)

		// Copy to clipboard for convenience
		void vscode.env.clipboard.writeText(url)
		vscode.window.showInformationMessage(`Session shared: ${url}`)
		return url
	} catch (err: any) {
		vscode.window.showErrorMessage(`Export failed: ${err?.message || String(err)}`)
		return
	}
}

/**
 * Import a session from cloud by REST id.
 */
export async function importTaskFromCloudById(
	id: string,
	globalStoragePath: string,
	opts?: { token?: string },
): Promise<void> {
	const f = ensureFetchAvailable()
	if (!f) return

	const baseUrl = resolveBaseUrl()
	if (!baseUrl) {
		vscode.window.showErrorMessage(
			`Session sharing base URL not set. Configure "${SETTINGS_NAMESPACE}.${SETTINGS_KEY}" or env ${ENV_BASE_URL}.`,
		)
		return
	}

	try {
		const res = await f(apiUrl(baseUrl, `/api/sessions/${encodeURIComponent(id)}`), {
			method: "GET",
			headers: {
				Accept: "application/json",
				...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
			},
		})

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			vscode.window.showErrorMessage(`Import failed: ${res.status} ${text || res.statusText}`)
			return
		}

		const json = await res.json()
		const parse = SerializedSessionSchema.safeParse(json)
		if (!parse.success) {
			vscode.window.showErrorMessage(`Invalid session data from cloud: ${parse.error.message}`)
			return
		}

		const session = parse.data
		const newTaskId = session.task.id

		await saveTaskMessages({
			taskId: newTaskId,
			globalStoragePath,
			messages: session.messages,
		})

		vscode.window.showInformationMessage(`Imported session "${session.task.task}" from cloud.`)
	} catch (err: any) {
		vscode.window.showErrorMessage(`Import failed: ${err?.message || String(err)}`)
	}
}

/**
 * Import a session directly from a full API URL.
 * Useful if the website's "Import to VS Code" deep link passes an API link instead of an id.
 */
export async function importTaskFromCloudByUrl(
	sessionApiUrl: string,
	globalStoragePath: string,
	opts?: { token?: string },
): Promise<void> {
	const f = ensureFetchAvailable()
	if (!f) return

	try {
		const res = await f(sessionApiUrl, {
			method: "GET",
			headers: {
				Accept: "application/json",
				...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
			},
		})

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			vscode.window.showErrorMessage(`Import failed: ${res.status} ${text || res.statusText}`)
			return
		}

		const json = await res.json()
		const parse = SerializedSessionSchema.safeParse(json)
		if (!parse.success) {
			vscode.window.showErrorMessage(`Invalid session data from cloud: ${parse.error.message}`)
			return
		}

		const session = parse.data
		const newTaskId = session.task.id

		await saveTaskMessages({
			taskId: newTaskId,
			globalStoragePath,
			messages: session.messages,
		})

		vscode.window.showInformationMessage(`Imported session "${session.task.task}" from cloud.`)
	} catch (err: any) {
		vscode.window.showErrorMessage(`Import failed: ${err?.message || String(err)}`)
	}
}

/**
 * Optional: Register a VS Code URI handler to support "vscode://<ext-id>/import-session?id=..." deep links
 * Call this from your extension activation with the extension context.
 */
export function registerSessionImportUriHandler(context: vscode.ExtensionContext) {
	const handler: vscode.UriHandler = {
		handleUri: async (uri) => {
			try {
				// Expect path like "/import-session"
				if (uri.path !== "/import-session") return
				const params = new URLSearchParams(uri.query)
				const id = params.get("id")
				if (!id) {
					vscode.window.showErrorMessage("Missing session id.")
					return
				}
				// Use extension's global storage to persist messages
				const globalStoragePath = context.globalStorageUri.fsPath
				await importTaskFromCloudById(id, globalStoragePath)
			} catch (err: any) {
				vscode.window.showErrorMessage(`Failed to handle import link: ${err?.message || String(err)}`)
			}
		},
	}

	context.subscriptions.push(vscode.window.registerUriHandler(handler))
}
