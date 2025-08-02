import path from "path"
import { ApiMessage } from "../task-persistence/apiMessages"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"

export class HierarchicalMemoryManager {
	private readonly read = new Set<string>()

	constructor(
		private readonly enabled: boolean,
		private readonly names: string[],
	) {}

	async loadFor(filePath: string, root: string): Promise<ApiMessage[]> {
		if (!this.enabled || this.names.length === 0) return []

		const messages: ApiMessage[] = []
		let dir = path.dirname(path.resolve(filePath))
		root = path.resolve(root)

		while (dir.startsWith(root)) {
			for (const name of this.names) {
				const full = path.join(dir, name)
				if (!this.read.has(full)) {
					try {
						const exists = await fileExistsAtPath(full)
						if (exists) {
							const body = await fs.readFile(full, "utf8")
							messages.push({
								role: "user",
								content: `--- Memory from ${full} ---\n${body}`,
								ts: Date.now(),
								isHierarchicalMemory: true,
							})
							this.read.add(full)
						}
					} catch (e: any) {
						if (e.code !== "ENOENT") console.error(e)
					}
				}
			}
			if (dir === root) break
			dir = path.dirname(dir)
		}
		return messages.reverse() // root → leaf
	}

	/**
	 * Get all loaded memory files
	 */
	getLoadedMemories(): string[] {
		return Array.from(this.read)
	}

	/**
	 * Clear the cache of loaded memories
	 */
	clearCache(): void {
		this.read.clear()
	}
}
