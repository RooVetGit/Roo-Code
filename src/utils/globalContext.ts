import { ExtensionContext } from "vscode"
import { getStorageBasePath, getSettingsDirectoryPath } from "./storage"

export async function getGlobalFsPath(context: ExtensionContext): Promise<string> {
	return getStorageBasePath(context.globalStorageUri.fsPath)
}

export async function ensureSettingsDirectoryExists(context: ExtensionContext): Promise<string> {
	return getSettingsDirectoryPath(context.globalStorageUri.fsPath)
}
