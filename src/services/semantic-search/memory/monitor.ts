import { Vector } from "../vector-store/types"
import { CodeDefinition } from "../types"

export interface MemoryStats {
	vectorCount: number
	totalVectorMemory: number // in bytes
	totalMetadataMemory: number // in bytes
	cacheEntryCount: number
	totalCacheMemory: number // in bytes
	timestamp: number
}

export class MemoryMonitor {
	private static readonly BYTES_PER_NUMBER = 8 // 64-bit float
	private static readonly METADATA_ESTIMATE_MULTIPLIER = 2 // Rough estimate for metadata overhead

	static estimateVectorSize(vector: Vector): number {
		return vector.values.length * this.BYTES_PER_NUMBER
	}

	static estimateMetadataSize(metadata: CodeDefinition): number {
		// Rough estimate based on string lengths
		const stringSize =
			(metadata.type.length + metadata.name.length + metadata.filePath.length + metadata.content.length) * 2 // UTF-16 characters

		// Add fixed overhead for numbers and object structure
		const overhead = 32 // Rough estimate for object structure

		return (stringSize + overhead) * this.METADATA_ESTIMATE_MULTIPLIER
	}

	static calculateStats(
		vectors: { vector: Vector; metadata: CodeDefinition }[],
		cacheEntries: { vector: Vector; metadata: CodeDefinition }[],
	): MemoryStats {
		let totalVectorMemory = 0
		let totalMetadataMemory = 0
		let totalCacheMemory = 0

		// Calculate vector store memory
		for (const { vector, metadata } of vectors) {
			totalVectorMemory += this.estimateVectorSize(vector)
			totalMetadataMemory += this.estimateMetadataSize(metadata)
		}

		// Calculate cache memory
		for (const { vector, metadata } of cacheEntries) {
			totalCacheMemory += this.estimateVectorSize(vector)
			totalCacheMemory += this.estimateMetadataSize(metadata)
		}

		return {
			vectorCount: vectors.length,
			totalVectorMemory,
			totalMetadataMemory,
			cacheEntryCount: cacheEntries.length,
			totalCacheMemory,
			timestamp: Date.now(),
		}
	}

	static formatBytes(bytes: number): string {
		const units = ["B", "KB", "MB", "GB"]
		let size = bytes
		let unitIndex = 0

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}

		return `${size.toFixed(2)} ${units[unitIndex]}`
	}

	static formatStats(stats: MemoryStats): string {
		return [
			`Vector Store:`,
			`- Vectors: ${stats.vectorCount}`,
			`- Vector Memory: ${this.formatBytes(stats.totalVectorMemory)}`,
			`- Metadata Memory: ${this.formatBytes(stats.totalMetadataMemory)}`,
			`Cache:`,
			`- Entries: ${stats.cacheEntryCount}`,
			`- Total Memory: ${this.formatBytes(stats.totalCacheMemory)}`,
			`Total Memory: ${this.formatBytes(
				stats.totalVectorMemory + stats.totalMetadataMemory + stats.totalCacheMemory,
			)}`,
			`Timestamp: ${new Date(stats.timestamp).toISOString()}`,
		].join("\n")
	}
}
