import { Vector } from "../vector-store/types"
import { CodeDefinition, Storage } from "../types"
import * as crypto from "crypto"

const CACHE_KEY = "semantic-search-cache"

interface CacheEntry {
	vector: Vector
	metadata: CodeDefinition
}

interface CacheData {
	entries: { [hash: string]: CacheEntry }
}

export class WorkspaceCache {
	constructor(private storage: Storage) {}

	private getHash(definition: CodeDefinition): string {
		const hash = crypto.createHash("sha256")
		hash.update(definition.filePath)
		hash.update(definition.content)
		return hash.digest("hex")
	}

	private getCacheData(): CacheData {
		return this.storage.get<CacheData>(CACHE_KEY) || { entries: {} }
	}

	private async saveCacheData(data: CacheData): Promise<void> {
		await this.storage.update(CACHE_KEY, data)
	}

	async get(definition: CodeDefinition): Promise<Vector | undefined> {
		const hash = this.getHash(definition)
		const data = this.getCacheData()
		return data.entries[hash]?.vector
	}

	async set(definition: CodeDefinition, vector: Vector): Promise<void> {
		const hash = this.getHash(definition)
		const data = this.getCacheData()
		data.entries[hash] = { vector, metadata: definition }
		await this.saveCacheData(data)
	}

	async invalidate(definition: CodeDefinition): Promise<void> {
		const hash = this.getHash(definition)
		const data = this.getCacheData()
		delete data.entries[hash]
		await this.saveCacheData(data)
	}

	async clear(): Promise<void> {
		await this.storage.update(CACHE_KEY, { entries: {} })
	}
}
