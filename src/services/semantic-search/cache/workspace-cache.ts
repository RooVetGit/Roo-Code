import { Vector } from "../vector-store/types"
import { CodeDefinition, Storage } from "../types"
import * as crypto from "crypto"

interface CacheEntry {
	vector: Vector
	metadata: CodeDefinition
}

interface CacheData {
	entries: { [hash: string]: CacheEntry }
}

export class WorkspaceCache {
	constructor(
		private storage: Storage,
		private workspaceId: string,
	) {}

	private getCacheKey(): string {
		return `semantic-search-cache-${this.workspaceId}`
	}

	private getHash(definition: CodeDefinition): string {
		const hash = crypto.createHash("sha256")
		hash.update(definition.filePath)
		hash.update(definition.content)
		return hash.digest("hex")
	}

	private getCacheData(): CacheData {
		return this.storage.get<CacheData>(this.getCacheKey()) || { entries: {} }
	}

	private async saveCacheData(data: CacheData): Promise<void> {
		await this.storage.update(this.getCacheKey(), data)
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
		await this.storage.update(this.getCacheKey(), { entries: {} })
	}
}
