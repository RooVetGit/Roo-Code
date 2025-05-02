import { ConfigSource, ServerConfig } from "../types"

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
	/** Configuration source (global or project) */
	source: ConfigSource
	/** Updated configuration */
	configs: Record<string, ServerConfig>
}

/**
 * Configuration change listener
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void | Promise<void>
