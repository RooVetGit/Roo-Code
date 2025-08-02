/**
 * Enum for different collection types in Qdrant
 */
export enum QdrantCollectionType {
	CODEBASE = "codebase",
	MEMORY = "memory",
}

/**
 * Interface for collection configuration
 */
export interface CollectionConfig {
	type: QdrantCollectionType
	vectorSize: number
}
