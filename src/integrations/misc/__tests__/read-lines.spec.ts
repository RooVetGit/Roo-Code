import { promises as fs } from "fs"
import path from "path"
import { readLines } from "../read-lines"

describe("nthline", () => {
	const testFile = path.join(__dirname, "test.txt")

	beforeAll(async () => {
		// Create a test file with numbered lines
		const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n")
		await fs.writeFile(testFile, content)
	})

	afterAll(async () => {
		await fs.unlink(testFile)
	})

	describe("readLines function", () => {
		it("should read lines from start when from_line is not provided", async () => {
			const lines = await readLines(testFile, 2)
			// Expect lines with trailing newline because it exists in the file at that point
			const expected = ["Line 1", "Line 2", "Line 3"].join("\n") + "\n"
			expect(lines).toEqual(expected)
		})

		it("should read a range of lines from a file", async () => {
			const lines = await readLines(testFile, 3, 1)
			// Expect lines with trailing newline because it exists in the file at that point
			const expected = ["Line 2", "Line 3", "Line 4"].join("\n") + "\n"
			expect(lines).toEqual(expected)
		})

		it("should read lines when to_line equals from_line", async () => {
			const lines = await readLines(testFile, 2, 2)
			// Expect line with trailing newline because it exists in the file at that point
			const expected = "Line 3\n"
			expect(lines).toEqual(expected)
		})

		it("should throw error for negative to_line", async () => {
			await expect(readLines(testFile, -3)).rejects.toThrow(
				"startLine (0) must be less than or equal to endLine (-3)",
			)
		})

		it("should handle negative from_line by clamping to 0", async () => {
			const lines = await readLines(testFile, 3, -1)
			expect(lines).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"].join("\n") + "\n")
		})

		it("should floor non-integer line numbers", async () => {
			const linesWithNonIntegerStart = await readLines(testFile, 3, 1.5)
			expect(linesWithNonIntegerStart).toEqual(["Line 2", "Line 3", "Line 4"].join("\n") + "\n")

			const linesWithNonIntegerEnd = await readLines(testFile, 3.5)
			expect(linesWithNonIntegerEnd).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"].join("\n") + "\n")
		})

		it("should throw error when from_line > to_line", async () => {
			await expect(readLines(testFile, 1, 3)).rejects.toThrow(
				"startLine (3) must be less than or equal to endLine (1)",
			)
		})

		it("should return partial range if file ends before to_line", async () => {
			const lines = await readLines(testFile, 15, 8)
			expect(lines).toEqual(["Line 9", "Line 10"].join("\n"))
		})

		it("should throw error if from_line is beyond file length", async () => {
			await expect(readLines(testFile, 20, 15)).rejects.toThrow("does not exist")
		})

		// Helper function to create a temporary file, run a test, and clean up
		async function withTempFile(filename: string, content: string, testFn: (filepath: string) => Promise<void>) {
			const filepath = path.join(__dirname, filename)
			await fs.writeFile(filepath, content)
			try {
				await testFn(filepath)
			} finally {
				await fs.unlink(filepath)
			}
		}

		it("should handle empty files", async () => {
			await withTempFile("empty.txt", "", async (filepath) => {
				await expect(readLines(filepath, 0, 0)).rejects.toThrow("does not exist")
			})
		})

		it("should handle files with only one line without carriage return", async () => {
			await withTempFile("single-line-no-cr.txt", "Single line", async (filepath) => {
				const lines = await readLines(filepath, 0, 0)
				expect(lines).toEqual("Single line")
			})
		})

		it("should handle files with only one line with carriage return", async () => {
			await withTempFile("single-line-with-cr.txt", "Single line\n", async (filepath) => {
				const lines = await readLines(filepath, 0, 0)
				expect(lines).toEqual("Single line\n")
			})
		})

		it("should read the entire file when no startLine or endLine is specified", async () => {
			const content = await readLines(testFile)
			expect(content).toEqual(Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n"))
		})

		it("should handle files with different line endings", async () => {
			await withTempFile("mixed-endings.txt", "Line 1\rLine 2\r\nLine 3\n", async (filepath) => {
				const lines = await readLines(filepath, 2)
				expect(lines).toEqual("Line 1\rLine 2\r\nLine 3\n")
			})
		})

		it("should handle files with Unicode characters", async () => {
			await withTempFile("unicode.txt", "Line 1 😀\nLine 2 你好\nLine 3 こんにちは\n", async (filepath) => {
				const lines = await readLines(filepath, 1)
				expect(lines).toEqual("Line 1 😀\nLine 2 你好\n")
			})
		})

		it("should handle files containing only carriage returns", async () => {
			await withTempFile("cr-only.txt", "\n\n\n\n\n", async (filepath) => {
				// Read lines 1-3 (second, third, and fourth lines)
				const lines = await readLines(filepath, 3, 1)
				expect(lines).toEqual("\n\n\n")
			})
		})

		describe("maxChars parameter", () => {
			it("should limit output to maxChars when reading entire file", async () => {
				const content = await readLines(testFile, undefined, undefined, 20)
				expect(content).toEqual("Line 1\nLine 2\nLine 3")
				expect(content.length).toBe(20)
			})

			it("should limit output to maxChars when reading a range", async () => {
				const content = await readLines(testFile, 5, 1, 15)
				// When maxChars cuts off in the middle of a line, we get partial content
				expect(content).toEqual("Line 2\nLine 3\nL")
				expect(content.length).toBe(15)
			})

			it("should return empty string when maxChars is 0", async () => {
				const content = await readLines(testFile, undefined, undefined, 0)
				expect(content).toEqual("")
			})

			it("should handle maxChars smaller than first line", async () => {
				const content = await readLines(testFile, undefined, undefined, 3)
				expect(content).toEqual("Lin")
				expect(content.length).toBe(3)
			})

			it("should handle maxChars that cuts off in the middle of a line", async () => {
				const content = await readLines(testFile, 2, 0, 10)
				expect(content).toEqual("Line 1\nLin")
				expect(content.length).toBe(10)
			})

			it("should respect both line limits and maxChars", async () => {
				// This should read lines 2-4, but stop at 25 chars
				const content = await readLines(testFile, 3, 1, 25)
				expect(content).toEqual("Line 2\nLine 3\nLine 4\n")
				expect(content.length).toBeLessThanOrEqual(25)
			})

			it("should handle maxChars with single line file", async () => {
				await withTempFile(
					"single-line-maxchars.txt",
					"This is a long single line of text",
					async (filepath) => {
						const content = await readLines(filepath, undefined, undefined, 10)
						expect(content).toEqual("This is a ")
						expect(content.length).toBe(10)
					},
				)
			})

			it("should handle maxChars with Unicode characters", async () => {
				await withTempFile("unicode-maxchars.txt", "Hello 😀 World\nLine 2", async (filepath) => {
					// Note: The emoji counts as 2 chars in JavaScript strings
					const content = await readLines(filepath, undefined, undefined, 10)
					expect(content).toEqual("Hello 😀 W")
					expect(content.length).toBe(10)
				})
			})

			it("should handle maxChars larger than file size", async () => {
				const content = await readLines(testFile, undefined, undefined, 1000)
				const fullContent = await readLines(testFile)
				expect(content).toEqual(fullContent)
			})

			it("should handle maxChars with empty lines", async () => {
				await withTempFile("empty-lines-maxchars.txt", "Line 1\n\n\nLine 4\n", async (filepath) => {
					const content = await readLines(filepath, undefined, undefined, 10)
					expect(content).toEqual("Line 1\n\n\nL")
					expect(content.length).toBe(10)
				})
			})
		})
	})
})
