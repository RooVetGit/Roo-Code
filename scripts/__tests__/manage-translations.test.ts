import * as fs from "fs"
import * as path from "path"
import * as os from "os"
// Mock the module
jest.mock("../manage-translations", () => {
	const actualModule = jest.requireActual("../manage-translations")
	return {
		...actualModule,
		collectStdin: jest.fn(),
	}
})

// Import after mocking
const manageTrans = require("../manage-translations")
const { getNestedValue, setNestedValue, deleteNestedValue, addTranslations, deleteTranslations, main } = manageTrans

// Helper function to mock stdin with input data
function mockStdinWithData(inputData: string) {
	const mockStdin: {
		setEncoding: jest.Mock
		on: jest.Mock<any>
	} = {
		setEncoding: jest.fn(),
		on: jest.fn().mockImplementation((event: string, callback: any) => {
			if (event === "data") {
				callback(inputData)
			}
			if (event === "end") {
				callback()
			}
			return mockStdin
		}),
	}
	Object.defineProperty(process, "stdin", { value: mockStdin })
}

describe("Translation Management", () => {
	let testDir: string
	let testFile: string

	beforeEach(async () => {
		testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "translations-test-"))
		testFile = path.join(testDir, "test.json")
	})

	afterEach(async () => {
		await fs.promises.rm(testDir, { recursive: true, force: true })
	})

	describe("Nested Value Operations", () => {
		test("handles nested paths and escaped dots", () => {
			const obj = {
				settings: {
					"customStoragePath.description": "Storage path setting",
					"vsCodeLmModelSelector.vendor.description": "Vendor setting",
					nested: { key: "normal nested" },
				},
			}

			// Regular nested path
			expect(getNestedValue(obj, "settings.nested.key")).toBe("normal nested")

			// Paths with dots
			expect(getNestedValue(obj, "settings.customStoragePath..description")).toBe("Storage path setting")
			expect(getNestedValue(obj, "settings.vsCodeLmModelSelector..vendor..description")).toBe("Vendor setting")
		})

		test("setNestedValue handles escaped dots", () => {
			const obj = {}

			// Regular nested path
			setNestedValue(obj, "settings.nested.key", "normal nested")

			// Paths with dots
			setNestedValue(obj, "settings.customStoragePath..description", "Storage path setting")
			setNestedValue(obj, "settings.vsCodeLmModelSelector..vendor..description", "Vendor setting")

			expect(obj).toEqual({
				settings: {
					nested: {
						key: "normal nested",
					},
					"customStoragePath.description": "Storage path setting",
					"vsCodeLmModelSelector.vendor.description": "Vendor setting",
				},
			})
		})

		test("deleteNestedValue handles escaped dots", () => {
			const obj = {
				settings: {
					nested: {
						key: "normal nested",
					},
					"customStoragePath.description": "Storage path setting",
					"vsCodeLmModelSelector.vendor.description": "Vendor setting",
				},
			}

			// Delete regular nested path
			expect(deleteNestedValue(obj, "settings.nested.key")).toBe(true)

			// Delete paths with dots
			expect(deleteNestedValue(obj, "settings.customStoragePath..description")).toBe(true)
			expect(deleteNestedValue(obj, "settings.vsCodeLmModelSelector..vendor..description")).toBe(true)

			expect(obj).toEqual({
				settings: {
					nested: {},
				},
			})
		})
	})

	describe("Translation Operations", () => {
		test("addTranslations adds new translations", async () => {
			const data = {}
			const pairs: [string, string][] = [
				["key1.nested", "value1"],
				["key2", "value2"],
			]
			const modified = await addTranslations(data, pairs, testFile)
			expect(modified).toBe(true)
			expect(data).toEqual({
				key1: { nested: "value1" },
				key2: "value2",
			})
		})

		test("addTranslations skips existing translations", async () => {
			const data = { key1: { nested: "existing" } }
			const pairs: [string, string][] = [["key1.nested", "new value"]]
			const modified = await addTranslations(data, pairs, testFile)
			expect(modified).toBe(false)
			expect(data).toEqual({ key1: { nested: "existing" } })
		})

		test("deleteTranslations removes existing translations", async () => {
			const data = {
				key1: { nested: "value1" },
				key2: "value2",
			}
			const keys = ["key1.nested", "key2"]
			const modified = await deleteTranslations(data, keys, testFile)
			expect(modified).toBe(true)
			expect(data).toEqual({ key1: {} })
		})

		test("deleteTranslations handles non-existent keys", async () => {
			const data = { key1: { nested: "value1" } }
			const keys = ["key1.nonexistent", "key2"]
			const modified = await deleteTranslations(data, keys, testFile)
			expect(modified).toBe(false)
			expect(data).toEqual({ key1: { nested: "value1" } })
		})
	})

	describe("File Operations", () => {
		test("addTranslations creates parent directories if needed", async () => {
			const nestedFile = path.join(testDir, "nested", "test.json")
			const data = {}
			const pairs: [string, string][] = [["key", "value"]]
			await addTranslations(data, pairs, nestedFile)

			const dirExists = await fs.promises
				.access(path.dirname(nestedFile))
				.then(() => true)
				.catch(() => false)
			expect(dirExists).toBe(true)
		})

		test("addTranslations with verbose mode logs operations", async () => {
			const consoleSpy = jest.spyOn(console, "log")
			const data = {}
			const pairs: [string, string][] = [["key", "value"]]
			await addTranslations(data, pairs, testFile, true)

			expect(consoleSpy).toHaveBeenCalledWith("Created new key path: key")
			expect(consoleSpy).toHaveBeenCalledWith(`Full path: ${testFile}`)
			expect(consoleSpy).toHaveBeenCalledWith('Set value: "value"')

			consoleSpy.mockRestore()
		})

		test("deleteTranslations with verbose mode logs operations", async () => {
			const consoleSpy = jest.spyOn(console, "log")
			const data = { key: "value" }
			const keys = ["key"]
			await deleteTranslations(data, keys, testFile, true)

			expect(consoleSpy).toHaveBeenCalledWith("Deleted key: key")
			expect(consoleSpy).toHaveBeenCalledWith(`From file: ${testFile}`)

			consoleSpy.mockRestore()
		})
	})

	describe("Main Function", () => {
		beforeEach(() => {
			// Reset process.argv before each test
			process.argv = ["node", "script"]
		})

		describe("Stdin Operations", () => {
			test("adds nested key paths via stdin", async () => {
				const testFile = path.join(testDir, "test.json")
				process.argv = ["node", "script", "--stdin", testFile] as any
				mockStdinWithData('{"key.nested.path": "value1"}\n{"other.nested": "value2"}')

				await main()

				const data = JSON.parse(await fs.promises.readFile(testFile, "utf8"))
				expect(data).toEqual({
					key: {
						nested: {
							path: "value1",
						},
					},
					other: {
						nested: "value2",
					},
				})
			})

			test("adds keys with dots using double-dot escaping via stdin", async () => {
				const testFile = path.join(testDir, "test.json")
				process.argv = ["node", "script", "--stdin", testFile] as any
				mockStdinWithData('{"settings..path": "value1"}\n{"key..with..dots": "value2"}')

				await main()

				const data = JSON.parse(await fs.promises.readFile(testFile, "utf8"))
				expect(data).toEqual({
					"settings.path": "value1",
					"key.with.dots": "value2",
				})
			})

			test("deletes keys with dots using double-dot escaping via stdin", async () => {
				const testFile = path.join(testDir, "test.json")
				await fs.promises.writeFile(
					testFile,
					JSON.stringify({
						"settings.path": "value1",
						"key.with.dots": "value2",
					}),
				)

				process.argv = ["node", "script", "-d", "--stdin", testFile] as any
				mockStdinWithData('["settings..path"]\n["key..with..dots"]')

				await main()

				const data = JSON.parse(await fs.promises.readFile(testFile, "utf8"))
				expect(data).toEqual({})
			})

			test("handles mixed nested paths and escaped dots via stdin", async () => {
				const testFile = path.join(testDir, "test.json")
				process.argv = ["node", "script", "--stdin", testFile] as any
				mockStdinWithData('{"nested.key..with..dots": "value1"}\n' + '{"settings..path.sub.key": "value2"}')

				await main()

				const data = JSON.parse(await fs.promises.readFile(testFile, "utf8"))
				expect(data).toEqual({
					nested: {
						"key.with.dots": "value1",
					},
					"settings.path": {
						sub: {
							key: "value2",
						},
					},
				})
			})

			test("deletes translations from multiple files via stdin", async () => {
				mockStdinWithData('["key1"]\n["key2"]')
				const testFile1 = path.join(testDir, "test1.json")
				const testFile2 = path.join(testDir, "test2.json")

				// Create test files with initial content
				await fs.promises.writeFile(testFile1, JSON.stringify({ key1: "value1", key2: "value2" }))
				await fs.promises.writeFile(testFile2, JSON.stringify({ key1: "value1", key2: "value2" }))

				process.argv = ["node", "script", "-d", "--stdin", testFile1, testFile2] as any

				await main()

				const data1 = JSON.parse(await fs.promises.readFile(testFile1, "utf8"))
				const data2 = JSON.parse(await fs.promises.readFile(testFile2, "utf8"))

				expect(data1).toEqual({})
				expect(data2).toEqual({})
			})
		})

		test("main throws error for invalid JSON file", async () => {
			const invalidJson = path.join(testDir, "invalid.json")
			await fs.promises.writeFile(invalidJson, "invalid json content")

			process.argv = ["node", "script", invalidJson]
			await expect(main()).rejects.toThrow("Invalid JSON in translation file")
		})

		test("main handles missing file in non-verbose mode", async () => {
			const nonExistentFile = path.join(testDir, "nonexistent.json")
			process.argv = ["node", "script", nonExistentFile, "key", "value"]
			await main()

			const fileContent = await fs.promises.readFile(nonExistentFile, "utf8")
			const data = JSON.parse(fileContent)
			expect(data).toEqual({ key: "value" })
		})

		test("main adds translations from command line", async () => {
			const testFile = path.join(testDir, "test.json")
			process.argv = ["node", "script", testFile, "key1", "value1", "key2", "value2"]
			await main()

			const fileContent = await fs.promises.readFile(testFile, "utf8")
			const data = JSON.parse(fileContent)
			expect(data).toEqual({ key1: "value1", key2: "value2" })
		})

		test("main deletes translations in delete mode", async () => {
			const testFile = path.join(testDir, "test.json")
			await fs.promises.writeFile(testFile, JSON.stringify({ key1: "value1", key2: "value2" }))

			process.argv = ["node", "script", "-d", testFile, "--", "key1"]
			await main()

			const fileContent = await fs.promises.readFile(testFile, "utf8")
			const data = JSON.parse(fileContent)
			expect(data).toEqual({ key2: "value2" })
		})
	})
})
