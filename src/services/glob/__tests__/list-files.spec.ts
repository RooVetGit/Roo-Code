// npx vitest src/services/glob/__tests__/list-files.spec.ts

import path from "path"
import { describe, expect, test } from "vitest"

import { listFiles } from "../list-files"

describe("listFiles", () => {
	test("it lists files in a directory", async () => {
		const dirPath = path.join(process.cwd(), "node_modules")
		const [files, _] = await listFiles(dirPath, true, 100_000, { gitignore: false, ignore: undefined })
		expect(files.length).toBeGreaterThan(25_000)
	})
})
