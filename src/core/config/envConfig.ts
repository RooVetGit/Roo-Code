function getFromEnv(key: string, defaultValue: string): string {
	const value = process.env[key]
	return value === undefined ? defaultValue : value
}

export const ROO_AGENT_CONFIG = {
	fileReadCacheSize: () => parseInt(getFromEnv("ROO_FILE_READ_CACHE_SIZE", "100")),
}
