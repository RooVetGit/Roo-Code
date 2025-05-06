import { mkdir } from "fs/promises"
import { join } from "path"
import { ExtensionContext } from "vscode"

export async function ensureSettingsDirectoryExists(context: ExtensionContext): Promise<string> {
	const settingsDir = join(context.globalStorageUri.fsPath, "settings")
	await mkdir(settingsDir, { recursive: true })
	return settingsDir
}
