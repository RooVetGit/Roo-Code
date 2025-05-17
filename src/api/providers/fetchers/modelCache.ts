import * as path from "path"
import fs from "fs/promises"

import NodeCache from "node-cache"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../shared/storagePathManager"
import { RouterName, ModelRecord } from "../../../shared/api"

import { getOpenRouterModels } from "./openrouter"
import { getRequestyModels } from "./requesty"
import { getGlamaModels } from "./glama"
import { getUnboundModels } from "./unbound"
import { getLiteLLMModels } from "./litellm"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

async function writeModels(router: RouterName, data: ModelRecord) {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	await fs.writeFile(path.join(cacheDir, filename), JSON.stringify(data))
}

/**
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * @param router - The router to fetch models from.
 * @param apiKey - Optional API key for the provider.
 * @param baseUrl - Optional base URL for the provider (currently used only for LiteLLM).
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (
	router: RouterName,
	apiKey: string | undefined = undefined,
	baseUrl: string | undefined = undefined,
): Promise<ModelRecord> => {
	// If this call is meant for a refresh (indicated by apiKey/baseUrl for specific routers),
	// the memory cache should have been flushed by the caller (e.g., webviewMessageHandler).
	// Otherwise, for general calls, check memory cache first.
	const modelsFromMemory = memoryCache.get<ModelRecord>(router)
	if (modelsFromMemory) {
		return modelsFromMemory
	}

	let fetchedModels: ModelRecord
	try {
		switch (router) {
			case "openrouter":
				fetchedModels = await getOpenRouterModels()
				break
			case "requesty":
				// Assuming getRequestyModels will throw if apiKey is needed and not provided or invalid.
				fetchedModels = await getRequestyModels(apiKey)
				break
			case "glama":
				fetchedModels = await getGlamaModels()
				break
			case "unbound":
				fetchedModels = await getUnboundModels()
				break
			case "litellm":
				if (!baseUrl || !apiKey) {
					// This case should ideally be handled by the caller if baseUrl is strictly required.
					// However, for robustness, if called without baseUrl for litellm, it would fail in getLiteLLMModels or here.
					throw new Error("Base URL and api key are required for LiteLLM models.")
				}
				fetchedModels = await getLiteLLMModels(apiKey || "", baseUrl)
				break
			default:
				// Ensures router is exhaustively checked if RouterName is a strict union
				const exhaustiveCheck: never = router
				throw new Error(`Unknown router: ${exhaustiveCheck}`)
		}

		// Cache the fetched models (even if empty, to signify a successful fetch with no models)
		memoryCache.set(router, fetchedModels)
		await writeModels(router, fetchedModels).catch((err) =>
			console.error(`[getModels] Error writing ${router} models to file cache:`, err),
		)
		return fetchedModels
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models for ${router}:`, error)

		throw error // Re-throw the original error to be handled by the caller.
	}
}

/**
 * Flush models memory cache for a specific router
 * @param router - The router to flush models for.
 */
export const flushModels = async (router: RouterName) => {
	memoryCache.del(router)
}
