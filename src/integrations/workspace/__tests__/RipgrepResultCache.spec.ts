import type { Mock } from "vitest"
import { RipgrepResultCache, type SimpleTreeNode } from "../RipgrepResultCache"
import { spawn } from "child_process"
import { EventEmitter } from "events"

// Mock child_process spawn
vitest.mock("child_process", () => ({
	spawn: vitest.fn(),
}))

// Mock process for testing
class MockChildProcess extends EventEmitter {
	stdout = new EventEmitter()
	stderr = new EventEmitter()
	killed = false

	kill() {
		this.killed = true
		this.emit("close", 0)
	}
}

describe("RipgrepResultCache", () => {
	let mockSpawn: Mock
	let mockChildProcess: MockChildProcess

	beforeEach(() => {
		vitest.clearAllMocks()
		mockChildProcess = new MockChildProcess()
		mockSpawn = spawn as Mock
		mockSpawn.mockReturnValue(mockChildProcess)
	})

	describe("constructor", () => {
		it("should initialize with default parameters", () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			expect(cache.targetPath).toBe("/test/workspace")
		})

		it("should resolve target path", () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "test/workspace")

			expect(cache.targetPath).toContain("test/workspace")
		})

		it("should use custom file limit", () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], 10000)

			expect(cache.targetPath).toBe("/test/workspace")
			expect((cache as any).fileLimit).toBe(10000)
		})
	})

	describe("getTree", () => {
		it("should build tree on first call", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Simulate successful ripgrep output
			const treePromise = cache.getTree()

			// Simulate ripgrep output
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/file2.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", ["--files"], {
				cwd: "/test/workspace",
				stdio: ["pipe", "pipe", "pipe"],
			})
			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"file2.ts": true,
				},
			})
		})

		it("should return cached tree on subsequent calls", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// First call
			const firstPromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)
			await firstPromise

			// Second call should not spawn new process
			mockSpawn.mockClear()
			const secondResult = await cache.getTree()

			expect(mockSpawn).not.toHaveBeenCalled()
			expect(secondResult).toEqual({
				src: {
					"file1.ts": true,
				},
			})
		})

		it("should wait for ongoing build if already building", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Start first build
			const firstPromise = cache.getTree()

			// Start second build immediately
			const secondPromise = cache.getTree()

			// Complete the build
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise])

			// Should only spawn once
			expect(mockSpawn).toHaveBeenCalledTimes(1)
			expect(firstResult).toEqual(secondResult)
		})

		it("should handle ripgrep errors gracefully", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()

			setTimeout(() => {
				mockChildProcess.stderr.emit("data", Buffer.from("ripgrep error"))
				mockChildProcess.emit("close", 1) // Error exit code
			}, 10)

			await expect(treePromise).rejects.toThrow()
		})

		it("should respect file limit", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], 2)

			const treePromise = cache.getTree()

			setTimeout(() => {
				// Send more files than the limit
				mockChildProcess.stdout.emit("data", Buffer.from("file1.ts\nfile2.ts\nfile3.ts\nfile4.ts\n"))
				// Process should be killed when limit reached
				expect(mockChildProcess.killed).toBe(true)
			}, 10)

			const result = await treePromise

			// Should only have 2 files due to limit
			const fileCount = Object.keys(result).length
			expect(fileCount).toBeLessThanOrEqual(2)
		})
	})

	describe("file change notifications", () => {
		let cache: RipgrepResultCache

		beforeEach(async () => {
			cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Build initial tree
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/utils/helper.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)
			await treePromise
		})

		it("should mark directory as invalid when file is added", async () => {
			// Clear spawn mock to detect new calls
			mockSpawn.mockClear()

			cache.fileAdded("/test/workspace/src/newfile.ts")

			// Next getTree call should trigger rebuild
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/newfile.ts\nsrc/utils/helper.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			// Should have rebuilt the tree
			expect(mockSpawn).toHaveBeenCalled()
		})

		it("should mark directory as invalid when file is removed", async () => {
			// Clear spawn mock to detect new calls
			mockSpawn.mockClear()

			cache.fileRemoved("/test/workspace/src/file1.ts")

			// Next getTree call should trigger rebuild
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/utils/helper.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			// Should have rebuilt the tree
			expect(mockSpawn).toHaveBeenCalled()
		})

		it("should handle relative file paths correctly", async () => {
			mockSpawn.mockClear()

			// Test with relative path
			cache.fileAdded("src/relative.ts")

			// Next getTree call should trigger rebuild
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/relative.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			expect(mockSpawn).toHaveBeenCalled()
		})
	})

	describe("incremental updates", () => {
		let cache: RipgrepResultCache

		beforeEach(async () => {
			cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Build initial tree
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from("src/file1.ts\nsrc/components/Button.tsx\nutils/helper.ts\n"),
				)
				mockChildProcess.emit("close", 0)
			}, 10)
			await treePromise
		})

		it("should perform incremental update for invalidated directories", async () => {
			// Add file to invalidate src directory
			cache.fileAdded("/test/workspace/src/newfile.ts")
			mockSpawn.mockClear()

			// Mock incremental update response (only for src directory)
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from("src/file1.ts\nsrc/newfile.ts\nsrc/components/Button.tsx\n"),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"newfile.ts": true,
					components: {
						"Button.tsx": true,
					},
				},
				utils: {
					"helper.ts": true,
				},
			})
		})

		it("should handle nested directory invalidation correctly", async () => {
			// Add file to nested directory
			cache.fileAdded("/test/workspace/src/components/Icon.tsx")
			mockSpawn.mockClear()

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from("src/components/Button.tsx\nsrc/components/Icon.tsx\n"),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			expect(mockSpawn).toHaveBeenCalled()
		})

		it("should avoid duplicate invalidation for parent directories", async () => {
			// First invalidate parent directory
			cache.fileAdded("/test/workspace/src/newfile.ts")

			// Then try to invalidate child directory (should be ignored)
			cache.fileAdded("/test/workspace/src/components/NewComponent.tsx")

			mockSpawn.mockClear()

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from(
						"src/file1.ts\nsrc/newfile.ts\nsrc/components/Button.tsx\nsrc/components/NewComponent.tsx\n",
					),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			// Should have called spawn for incremental update
			expect(mockSpawn).toHaveBeenCalled()
		})

		it("should handle multiple directory invalidations in single incremental update", async () => {
			// Invalidate multiple independent directories
			cache.fileAdded("/test/workspace/src/newfile.ts")
			cache.fileAdded("/test/workspace/utils/newutil.ts")
			cache.fileAdded("/test/workspace/lib/helper.ts")

			mockSpawn.mockClear()

			// Mock incremental update response for all invalidated directories
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from(
						"src/file1.ts\nsrc/newfile.ts\nsrc/components/Button.tsx\nutils/helper.ts\nutils/newutil.ts\nlib/helper.ts\n",
					),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			// Should have called spawn for incremental update
			expect(mockSpawn).toHaveBeenCalled()

			// Verify all directories are updated correctly
			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"newfile.ts": true,
					components: {
						"Button.tsx": true,
					},
				},
				utils: {
					"helper.ts": true,
					"newutil.ts": true,
				},
				lib: {
					"helper.ts": true,
				},
			})
		})

		it("should handle multiple nested directory invalidations with parent-child relationships", async () => {
			// Invalidate multiple directories with parent-child relationships
			cache.fileAdded("/test/workspace/src/newfile.ts") // Parent directory
			cache.fileAdded("/test/workspace/src/components/NewComponent.tsx") // Child directory
			cache.fileAdded("/test/workspace/src/components/ui/Button.tsx") // Grandchild directory
			cache.fileAdded("/test/workspace/utils/newutil.ts") // Independent directory

			mockSpawn.mockClear()

			// Mock incremental update response for all invalidated directories
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from(
						"src/file1.ts\nsrc/newfile.ts\nsrc/components/Button.tsx\nsrc/components/NewComponent.tsx\nsrc/components/ui/Button.tsx\nutils/helper.ts\nutils/newutil.ts\n",
					),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			// Should have called spawn for incremental update
			expect(mockSpawn).toHaveBeenCalled()

			// Verify all directories are updated correctly with proper nesting
			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"newfile.ts": true,
					components: {
						"Button.tsx": true,
						"NewComponent.tsx": true,
						ui: {
							"Button.tsx": true,
						},
					},
				},
				utils: {
					"helper.ts": true,
					"newutil.ts": true,
				},
			})
		})

		it("should trigger only one ripgrep call when multiple directories are invalidated", async () => {
			// Invalidate multiple directories in sequence
			cache.fileAdded("/test/workspace/src/newfile.ts")
			cache.fileAdded("/test/workspace/utils/newutil.ts")
			cache.fileAdded("/test/workspace/lib/helper.ts")
			cache.fileAdded("/test/workspace/tests/test.ts")

			mockSpawn.mockClear()

			// Call getTree - should trigger only one ripgrep process
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit(
					"data",
					Buffer.from(
						"src/file1.ts\nsrc/newfile.ts\nsrc/components/Button.tsx\nutils/helper.ts\nutils/newutil.ts\nlib/helper.ts\ntests/test.ts\n",
					),
				)
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			// Should have called spawn exactly once for all invalidations
			expect(mockSpawn).toHaveBeenCalledTimes(1)
		})
	})

	describe("ripgrep arguments", () => {
		it("should use custom ripgrep arguments", async () => {
			const customArgs = ["--files", "--follow", "--hidden", "--no-ignore"]
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", customArgs)

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", customArgs, {
				cwd: "/test/workspace",
				stdio: ["pipe", "pipe", "pipe"],
			})
		})

		it("should use default --files argument when no args provided", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [])

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await treePromise

			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", ["--files"], {
				cwd: "/test/workspace",
				stdio: ["pipe", "pipe", "pipe"],
			})
		})
	})

	describe("clearCache", () => {
		it("should clear all cached data", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Build initial cache
			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)
			await treePromise

			// Clear cache
			cache.clearCache()

			// Next call should rebuild
			mockSpawn.mockClear()
			const newTreePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await newTreePromise

			expect(mockSpawn).toHaveBeenCalled()
		})
	})

	describe("edge cases", () => {
		it("should handle empty ripgrep output", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({})
		})

		it("should handle ripgrep output with empty lines", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n\n\nsrc/file2.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"file2.ts": true,
				},
			})
		})

		it("should handle file paths with special characters", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file-with-dash.ts\nsrc/file with spaces.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"file-with-dash.ts": true,
					"file with spaces.ts": true,
				},
			})
		})

		it("should handle deeply nested directory structures", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("a/b/c/d/e/f/deep.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				a: {
					b: {
						c: {
							d: {
								e: {
									f: {
										"deep.ts": true,
									},
								},
							},
						},
					},
				},
			})
		})

		it("should handle mixed files and directories with same names", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/utils.ts\nsrc/utils/helper.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"utils.ts": true,
					utils: {
						"helper.ts": true,
					},
				},
			})
		})
	})

	describe("streaming buffer handling", () => {
		it("should handle partial data chunks correctly", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				// Send data in partial chunks
				mockChildProcess.stdout.emit("data", Buffer.from("src/fi"))
				mockChildProcess.stdout.emit("data", Buffer.from("le1.ts\nsrc/file"))
				mockChildProcess.stdout.emit("data", Buffer.from("2.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"file2.ts": true,
				},
			})
		})

		it("should handle final buffer content without newline", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			const treePromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/file2.ts"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			expect(result).toEqual({
				src: {
					"file1.ts": true,
					"file2.ts": true,
				},
			})
		})
	})

	describe("concurrent ripgrep calls", () => {
		beforeEach(() => {
			vitest.clearAllMocks()
			mockChildProcess = new MockChildProcess()
			mockSpawn = spawn as Mock
		})

		it("should handle multiple concurrent successful calls", async () => {
			mockSpawn.mockReturnValue(mockChildProcess)
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Start multiple concurrent getTree calls
			const promise1 = cache.getTree()
			const promise2 = cache.getTree()
			const promise3 = cache.getTree()

			// All should wait for the same build
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			// Simulate successful ripgrep output
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/file2.ts\nlib/utils.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

			// All should return the same result
			const expectedResult = {
				src: {
					"file1.ts": true,
					"file2.ts": true,
				},
				lib: {
					"utils.ts": true,
				},
			}

			expect(result1).toEqual(expectedResult)
			expect(result2).toEqual(expectedResult)
			expect(result3).toEqual(expectedResult)

			// Only one spawn call should have been made
			expect(mockSpawn).toHaveBeenCalledTimes(1)
		})

		it("should handle multiple concurrent calls when first fails", async () => {
			mockSpawn.mockReturnValue(mockChildProcess)
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Start multiple concurrent getTree calls
			const promise1 = cache.getTree()
			const promise2 = cache.getTree()
			const promise3 = cache.getTree()

			// Simulate ripgrep error
			setTimeout(() => {
				mockChildProcess.stderr.emit("data", Buffer.from("Permission denied"))
				mockChildProcess.emit("close", 1) // Error exit code
			}, 10)

			// All should reject with the same error
			await expect(promise1).rejects.toThrow()
			await expect(promise2).rejects.toThrow()
			await expect(promise3).rejects.toThrow()

			// Only one spawn call should have been made
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			// After error, subsequent calls should trigger new builds
			mockSpawn.mockClear()
			mockChildProcess = new MockChildProcess()
			mockSpawn.mockReturnValue(mockChildProcess)

			const retryPromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			await retryPromise
			expect(mockSpawn).toHaveBeenCalledTimes(1)
		})

		it("should handle concurrent calls after invalidation", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace")

			// Build initial cache
			mockSpawn.mockReturnValue(mockChildProcess)
			const initialPromise = cache.getTree()
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)
			await initialPromise

			// Clear spawn mock and create new process for subsequent calls
			mockSpawn.mockClear()
			mockChildProcess = new MockChildProcess()
			mockSpawn.mockReturnValue(mockChildProcess)

			// Invalidate cache
			cache.fileAdded("/test/workspace/src/newfile.ts")

			// Start multiple concurrent calls after invalidation
			const promise1 = cache.getTree()
			const promise2 = cache.getTree()
			const promise3 = cache.getTree()

			// Should trigger only one rebuild
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("src/file1.ts\nsrc/newfile.ts\n"))
				mockChildProcess.emit("close", 0)
			}, 10)

			const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

			const expectedResult = {
				src: {
					"file1.ts": true,
					"newfile.ts": true,
				},
			}

			expect(result1).toEqual(expectedResult)
			expect(result2).toEqual(expectedResult)
			expect(result3).toEqual(expectedResult)
		})
	})

	describe("large file set performance and memory", () => {
		it("should handle 500k files efficiently", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], 500000)

			mockSpawn.mockReturnValue(mockChildProcess)

			const treePromise = cache.getTree()

			setTimeout(async () => {
				// Generate 500k file paths with varying depth
				const generateLargeFileSet = () => {
					const files: string[] = []
					const dirs = ["src", "lib", "components", "utils", "services", "types", "hooks", "pages"]
					const subdirs = ["common", "shared", "specific", "custom", "base", "core"]
					const fileTypes = [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"]

					for (let i = 0; i < 500000; i++) {
						const dir = dirs[i % dirs.length]
						const subdir = subdirs[i % subdirs.length]
						const fileType = fileTypes[i % fileTypes.length]
						const fileName = `file${i}${fileType}`
						files.push(`${dir}/${subdir}/${fileName}`)
					}
					return files
				}

				const files = generateLargeFileSet()
				const fileData = files.join("\n") + "\n"

				// Emit data in chunks to simulate real ripgrep behavior
				const chunkSize = 10000
				for (let i = 0; i < fileData.length; i += chunkSize) {
					const chunk = fileData.slice(i, i + chunkSize)
					mockChildProcess.stdout.emit("data", Buffer.from(chunk))
				}

				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			let memoryBeforeBuild = process.memoryUsage()

			let copy = JSON.parse(JSON.stringify(result))

			let memoryAfterBuild = process.memoryUsage()

			// Verify tree structure
			expect(Object.keys(result)).toHaveLength(8) // 8 main directories

			// Calculate memory increase (approximate)
			const memoryIncrease = memoryAfterBuild.heapUsed - memoryBeforeBuild.heapUsed
			const memoryIncreaseInMB = memoryIncrease / (1024 * 1024)

			// Memory should be reasonable for 500k files (should be less than 80MB)
			expect(memoryIncreaseInMB).toBeLessThan(80)

			// Verify tree contains expected number of files
			const countFilesInTree = (node: any): number => {
				let count = 0
				for (const key in node) {
					if (node[key] === true) {
						count++
					} else if (typeof node[key] === "object") {
						count += countFilesInTree(node[key])
					}
				}
				return count
			}

			const totalFiles = countFilesInTree(result)
			expect(totalFiles).toBe(500000)
		})

		it("should handle extreme case with deep nesting", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], 10000)

			mockSpawn.mockReturnValue(mockChildProcess)

			const treePromise = cache.getTree()

			setTimeout(() => {
				// Create extremely deep nesting paths that would create large tree structures
				const deepPaths = []

				// Case 1: Very deep directory nesting (100 levels deep)
				for (let i = 0; i < 50; i++) {
					const deepPath = Array.from({ length: 100 }, (_, j) => `level${j}`).join("/") + `/file${i}.ts`
					deepPaths.push(deepPath)
				}

				// Case 2: Many sibling directories at same level
				for (let i = 0; i < 1000; i++) {
					deepPaths.push(`dir${i}/file.ts`)
				}

				// Case 3: Factorial explosion (each level has more directories)
				for (let level = 0; level < 5; level++) {
					for (let branch = 0; branch < Math.pow(10, level); branch++) {
						const path =
							Array.from({ length: level + 1 }, (_, i) => `l${i}d${branch % Math.pow(10, i + 1)}`).join(
								"/",
							) + "/file.ts"
						deepPaths.push(path)
					}
				}

				const fileData = deepPaths.join("\n") + "\n"
				mockChildProcess.stdout.emit("data", Buffer.from(fileData))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			// Verify the tree structure handles deep nesting
			const getMaxDepth = (node: any, currentDepth = 0): number => {
				let maxDepth = currentDepth
				for (const key in node) {
					if (typeof node[key] === "object" && node[key] !== true) {
						const depth = getMaxDepth(node[key], currentDepth + 1)
						maxDepth = Math.max(maxDepth, depth)
					}
				}
				return maxDepth
			}

			const maxDepth = getMaxDepth(result)
			expect(maxDepth).toBeGreaterThan(50) // Should handle deep nesting

			// Verify we have the expected wide structure
			expect(Object.keys(result).length).toBeGreaterThan(100) // Many top-level directories
		})

		it("should respect file limit and stop processing when reached", async () => {
			const fileLimit = 1000
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], fileLimit)

			mockSpawn.mockReturnValue(mockChildProcess)

			const treePromise = cache.getTree()

			setTimeout(() => {
				// Generate more files than the limit
				const files = Array.from({ length: 2000 }, (_, i) => `file${i}.ts`)
				const fileData = files.join("\n") + "\n"

				// Emit all data at once
				mockChildProcess.stdout.emit("data", Buffer.from(fileData))

				// Process should be killed when limit is reached
				expect(mockChildProcess.killed).toBe(true)
			}, 10)

			const result = await treePromise

			// Count total files in result
			const countFiles = (node: any): number => {
				let count = 0
				for (const key in node) {
					if (node[key] === true) {
						count++
					} else if (typeof node[key] === "object") {
						count += countFiles(node[key])
					}
				}
				return count
			}

			const totalFiles = countFiles(result)
			expect(totalFiles).toBeLessThanOrEqual(fileLimit)
		})

		it("should handle memory-intensive file name patterns", async () => {
			const cache = new RipgrepResultCache("/usr/bin/rg", "/test/workspace", [], 50000)

			mockSpawn.mockReturnValue(mockChildProcess)

			const treePromise = cache.getTree()

			setTimeout(() => {
				const memoryIntensivePaths = []

				// Case 1: Very long file names
				for (let i = 0; i < 1000; i++) {
					const longFileName = "a".repeat(200) + i + ".ts"
					memoryIntensivePaths.push(`long-names/${longFileName}`)
				}

				// Case 2: Many files with common prefixes (creates large branching factor)
				for (let i = 0; i < 10000; i++) {
					const fileName = `component-${i.toString().padStart(10, "0")}.tsx`
					memoryIntensivePaths.push(`components/${fileName}`)
				}

				// Case 3: Unicode and special characters
				const specialChars = ["测试", "файл", "ファイル", "αρχείο", "파일"]
				for (let i = 0; i < 1000; i++) {
					const char = specialChars[i % specialChars.length]
					memoryIntensivePaths.push(`unicode/${char}${i}.ts`)
				}

				const fileData = memoryIntensivePaths.join("\n") + "\n"
				mockChildProcess.stdout.emit("data", Buffer.from(fileData))
				mockChildProcess.emit("close", 0)
			}, 10)

			const result = await treePromise

			// Verify structure integrity
			expect(result["long-names"]).toBeDefined()
			expect(result["components"]).toBeDefined()
			expect(result["unicode"]).toBeDefined()

			// Verify we can handle special characters
			expect(typeof result["unicode"]).toBe("object")
			expect(Object.keys(result["unicode"] as any).length).toBeGreaterThan(0)
		})
	})
})
