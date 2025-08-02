/**
 * Qdrant Vector Store Configuration Constants
 *
 * These constants define default values for Qdrant memory optimization settings
 * to reduce RAM usage by storing vectors and indexes on disk instead of in memory.
 */

/**
 * Default memory optimization settings for Qdrant
 */
export const QDRANT_MEMORY_OPTIMIZATION_DEFAULTS = {
	/**
	 * Enable on-disk storage for vectors and HNSW indexes by default
	 * This significantly reduces memory usage at the cost of slightly slower access
	 */
	USE_ON_DISK_STORAGE: true,

	/**
	 * Number of vectors before using memory-mapped files
	 * Segments larger than this threshold will use memory-mapped files for better memory management
	 */
	MEMORY_MAP_THRESHOLD: 50000,

	/**
	 * HNSW search parameter (ef) - controls search quality vs memory usage
	 * Higher values = better search quality but more memory usage
	 * Lower values = less memory usage but potentially lower search quality
	 * Default: 128 (original value, not reduced for testing purposes)
	 */
	HNSW_EF_SEARCH: 128,
} as const

/**
 * HNSW (Hierarchical Navigable Small World) index configuration constants
 */
export const QDRANT_HNSW_CONFIG_DEFAULTS = {
	/**
	 * Number of bi-directional links created for each node during construction
	 */
	M: 16,

	/**
	 * Size of the dynamic list during index construction
	 */
	EF_CONSTRUCT: 100,

	/**
	 * Use full scan for collections smaller than this threshold
	 */
	FULL_SCAN_THRESHOLD: 10000,

	/**
	 * Maximum number of threads for indexing (0 = use all available CPU cores)
	 */
	MAX_INDEXING_THREADS: 0,

	/**
	 * Payload index configuration (null = use default)
	 */
	PAYLOAD_M: null,
} as const

/**
 * Optimizer configuration constants for memory-mapped storage
 */
export const QDRANT_OPTIMIZER_CONFIG_DEFAULTS = {
	/**
	 * Trigger optimization when this percentage of vectors are deleted
	 */
	DELETED_THRESHOLD: 0.2,

	/**
	 * Minimum number of vectors before vacuum operation
	 */
	VACUUM_MIN_VECTOR_NUMBER: 1000,

	/**
	 * Default number of segments to create
	 */
	DEFAULT_SEGMENT_NUMBER: 2,

	/**
	 * Maximum segment size (null = no limit)
	 */
	MAX_SEGMENT_SIZE: null,

	/**
	 * Start indexing after this many vectors
	 */
	INDEXING_THRESHOLD: 20000,

	/**
	 * Flush to disk interval in seconds
	 */
	FLUSH_INTERVAL_SEC: 5,

	/**
	 * Maximum optimization threads (0 = use all available CPU cores)
	 */
	MAX_OPTIMIZATION_THREADS: 0,
} as const

/**
 * Quantization configuration for search operations
 * These settings are applied during vector search queries to balance memory efficiency and search quality
 */
export const QDRANT_QUANTIZATION_CONFIG_DEFAULTS = {
	/**
	 * Enable quantization for memory efficiency
	 */
	IGNORE: false,

	/**
	 * Rescore with original vectors for accuracy
	 */
	RESCORE: true,

	/**
	 * Oversample to maintain quality
	 */
	OVERSAMPLING: 2.0,
} as const
