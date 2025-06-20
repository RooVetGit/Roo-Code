import * as path from "path"
import fs from "fs/promises"

import NodeCache from "node-cache"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../utils/storage"
import { RouterName, ModelRecord } from "../../../shared/api"
import { fileExistsAtPath } from "../../../utils/fs"

import { getOpenRouterModels } from "./openrouter"
import { getRequestyModels } from "./requesty"
import { getGlamaModels } from "./glama"
import { getUnboundModels } from "./unbound"
import { getLiteLLMModels } from "./litellm"
import { GetModelsOptions } from "../../../shared/api"
const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

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
export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	const cacheKey = JSON.stringify(options)
	let models = memoryCache.get<ModelRecord>(cacheKey)

	if (models) {
		return models
	}

	try {
		switch (provider) {
			case "openrouter":
				models = await getOpenRouterModels(options.baseUrl, options.apiKey)
				break
			case "requesty":
				// Requesty models endpoint requires an API key for per-user custom policies
				models = await getRequestyModels(options.apiKey)
				break
			case "glama":
				models = await getGlamaModels()
				break
			case "unbound":
				// Unbound models endpoint requires an API key to fetch application specific models
				models = await getUnboundModels(options.apiKey)
				break
			case "litellm":
				// Type safety ensures apiKey and baseUrl are always provided for litellm
				models = await getLiteLLMModels(options.apiKey, options.baseUrl)
				break
			default: {
				// Ensures router is exhaustively checked if RouterName is a strict union
				const exhaustiveCheck: never = provider
				throw new Error(`Unknown provider: ${exhaustiveCheck}`)
			}
		}

		// Cache the fetched models (even if empty, to signify a successful fetch with no models)
		memoryCache.set(cacheKey, models)

		return models || {}
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models in modelCache for ${provider}:`, error)

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
