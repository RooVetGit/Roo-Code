export class lruCache<K, V> {
	private capacity: number
	private cache: Map<K, V>

	constructor(capacity: number) {
		this.capacity = capacity
		this.cache = new Map<K, V>()
	}

	get(key: K): V | undefined {
		if (!this.cache.has(key)) {
			return undefined
		}

		const value = this.cache.get(key) as V
		this.cache.delete(key)
		this.cache.set(key, value)
		return value
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key)
		} else if (this.cache.size >= this.capacity) {
			const oldestKey = this.cache.keys().next().value
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey)
			}
		}
		this.cache.set(key, value)
	}

	clear(): void {
		this.cache.clear()
	}
}
