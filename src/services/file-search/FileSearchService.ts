import { globbyStream, Options } from "globby"
import fuzzysort from "fuzzysort"

import { IGNORE } from "../glob/ignore"

export class FileSearchService {
	private files: string[] = []

	constructor(private readonly dirPath: string) {}

	async indexFiles(globbyOptions: Options = {}) {
		const options: Options = {
			cwd: this.dirPath,
			// Do not ignore hidden files/directories.
			dot: true,
			absolute: true,
			// Append a / on any directories matched (/ is used on windows as well,
			// so dont use path.sep).
			markDirectories: true,
			// Globby ignores any files that are in .gitignore.
			gitignore: true,
			// Just in case there is no gitignore, we ignore sensible defaults.
			ignore: IGNORE,
			// List directories on their own too.
			onlyFiles: false,
			...globbyOptions,
		}

		const stream = globbyStream("**", options)

		for await (const file of stream) {
			this.files.push(file.toString())
		}
	}

	public addFiles(files: string[]) {
		this.files.push(...files)
	}

	public removeFiles(files: string[]) {
		this.files = this.files.filter((file) => !files.includes(file))
	}

	public get count() {
		return this.files.length
	}

	public search(query: string, { limit = 25, threshold = 0.5 }: { limit?: number; threshold?: number } = {}) {
		return fuzzysort.go(query, this.files, { limit, threshold })
	}
}
