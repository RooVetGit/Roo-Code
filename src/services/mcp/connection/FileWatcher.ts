import * as chokidar from "chokidar"

/**
 * File watcher class
 * Responsible for monitoring changes to files related to MCP servers
 */
export class FileWatcher {
	private watchers: Map<string, chokidar.FSWatcher[]> = new Map()

	/**
	 * Set up file watchers for server
	 * @param serverName Server name
	 * @param paths Paths to watch
	 * @param onFileChange File change callback
	 */
	setupWatchers(serverName: string, paths: string[], onFileChange: () => Promise<void>): void {
		// Clear existing watchers
		this.clearWatchers(serverName)

		// Set up watchers
		if (paths.length > 0) {
			const serverWatchers: chokidar.FSWatcher[] = []

			for (const path of paths) {
				const watcher = chokidar.watch(path, {
					persistent: true,
					ignoreInitial: true,
					awaitWriteFinish: {
						stabilityThreshold: 500,
						pollInterval: 100,
					},
				})

				watcher.on("change", async () => {
					try {
						await onFileChange()
					} catch (error) {
						console.error(`Error handling file change:`, error)
					}
				})

				serverWatchers.push(watcher)
			}

			this.watchers.set(serverName, serverWatchers)
		}
	}

	/**
	 * Clear watchers
	 * @param serverName Optional server name, if not provided clear all watchers
	 */
	clearWatchers(serverName?: string): void {
		if (serverName) {
			const watchers = this.watchers.get(serverName)
			if (watchers) {
				watchers.forEach((watcher) => watcher.close())
				this.watchers.delete(serverName)
			}
		} else {
			for (const watchers of this.watchers.values()) {
				watchers.forEach((watcher) => watcher.close())
			}
			this.watchers.clear()
		}
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.clearWatchers()
	}
}
