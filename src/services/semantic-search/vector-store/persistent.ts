import { InMemoryVectorStore } from "./in-memory"
import { Vector, VectorWithMetadata } from "./types"
import { Storage } from "../types"

export class PersistentVectorStore extends InMemoryVectorStore {
	private readonly storageKey = "semantic-search-vectors"

	private constructor(private storage: Storage) {
		super()
	}

	static async create(storage: Storage): Promise<PersistentVectorStore> {
		const store = new PersistentVectorStore(storage)
		await store.load()
		return store
	}

	async save(): Promise<void> {
		await this.storage.update(this.storageKey, this.vectors)
	}

	async load(): Promise<void> {
		const vectors = this.storage.get<VectorWithMetadata[]>(this.storageKey)
		this.vectors = Array.isArray(vectors) ? vectors : []
	}

	override async add(vector: Vector, metadata: any): Promise<void> {
		await super.add(vector, metadata)
		await this.save()
	}

	override async addBatch(items: VectorWithMetadata[]): Promise<void> {
		await super.addBatch(items)
		await this.save()
	}

	override clear(): void {
		super.clear()
		this.storage.update(this.storageKey, [])
	}
}
