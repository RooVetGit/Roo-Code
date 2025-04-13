import { convertToMentionPath } from "../path-mentions"

/**
 * IMPORTANT NOTE ABOUT BACKSLASH ESCAPING IN TESTS:
 * ================================================
 * The handling of backslashes and spaces in paths is complex due to multiple levels of escaping:
 *
 * 1. JavaScript string escaping:
 *    - A single backslash in code must be written as "\\".
 *    - For example, "C:\\path\\file.txt" represents the path "C:\path\file.txt".
 *
 * 2. Path normalization:
 *    - Windows backslashes are converted to forward slashes.
 *    - "C:\\path\\file.txt" becomes "C:/path/file.txt".
 *
 * 3. Space escaping:
 *    - When a path contains spaces, we escape them with backslashes.
 *    - "path/file with spaces.txt" becomes "path/file\ with\ spaces.txt".
 *    - In code, this looks like: "path/file\\ with\\ spaces.txt".
 *
 * 4. Multiple escaping:
 *    - For paths that already contain escaped spaces, the escaping gets doubled.
 *    - A path with already escaped spaces like "path/file\ with\ spaces.txt"
 *      (which in code is "path/file\\ with\\ spaces.txt")
 *      gets double-escaped to "path/file\\ with\\ spaces.txt"
 *      (which in code is "path/file\\\\ with\\\\ spaces.txt").
 *
 * The tests in this file verify these complex escaping behaviors, which may appear
 * confusing at first glance but are necessary to ensure proper handling of paths
 * with spaces across the application.
 */
describe("path-mentions", () => {
	describe("convertToMentionPath", () => {
		it("should convert an absolute path to a mention path when it starts with cwd", () => {
			// Windows-style paths
			expect(convertToMentionPath("C:\\Users\\user\\project\\file.txt", "C:\\Users\\user\\project")).toBe(
				"@/file.txt",
			)

			// Unix-style paths
			expect(convertToMentionPath("/Users/user/project/file.txt", "/Users/user/project")).toBe("@/file.txt")
		})

		it("should handle paths with trailing slashes in cwd", () => {
			expect(convertToMentionPath("/Users/user/project/file.txt", "/Users/user/project/")).toBe("@/file.txt")
		})

		it("should be case-insensitive when matching paths", () => {
			expect(convertToMentionPath("/Users/User/Project/file.txt", "/users/user/project")).toBe("@/file.txt")
		})

		it("should return the original path when cwd is not provided", () => {
			expect(convertToMentionPath("/Users/user/project/file.txt")).toBe("/Users/user/project/file.txt")
		})

		it("should return the original path when it does not start with cwd", () => {
			expect(convertToMentionPath("/Users/other/project/file.txt", "/Users/user/project")).toBe(
				"/Users/other/project/file.txt",
			)
		})

		it("should normalize backslashes to forward slashes", () => {
			expect(convertToMentionPath("C:\\Users\\user\\project\\subdir\\file.txt", "C:\\Users\\user\\project")).toBe(
				"@/subdir/file.txt",
			)
		})

		it("should handle nested paths correctly", () => {
			expect(convertToMentionPath("/Users/user/project/nested/deeply/file.txt", "/Users/user/project")).toBe(
				"@/nested/deeply/file.txt",
			)
		})

		it("should handle paths with spaces correctly", () => {
			expect(
				convertToMentionPath("C:\\Users\\user\\project\\file with spaces.txt", "C:\\Users\\user\\project"),
			).toBe("@/file\\ with\\ spaces.txt")

			expect(convertToMentionPath("/Users/user/project/file with spaces.txt", "/Users/user/project")).toBe(
				"@/file\\ with\\ spaces.txt",
			)
		})

		it("should handle paths with multiple consecutive spaces", () => {
			expect(
				convertToMentionPath("C:\\Users\\user\\project\\file  with   spaces.txt", "C:\\Users\\user\\project"),
			).toBe("@/file\\ \\ with\\ \\ \\ spaces.txt")
		})

		it("should handle paths with Unicode characters", () => {
			expect(
				convertToMentionPath("C:\\Users\\user\\project\\文件名with空格.txt", "C:\\Users\\user\\project"),
			).toBe("@/文件名with空格.txt")
		})

		it("should handle paths with special characters", () => {
			expect(
				convertToMentionPath(
					"C:\\Users\\user\\project\\file-with_special#chars&.txt",
					"C:\\Users\\user\\project",
				),
			).toBe("@/file-with_special#chars&.txt")
		})

		it("should handle nested paths with spaces", () => {
			expect(
				convertToMentionPath(
					"C:\\Users\\user\\project\\folder with spaces\\file with spaces.txt",
					"C:\\Users\\user\\project",
				),
			).toBe("@/folder\\ with\\ spaces/file\\ with\\ spaces.txt")
		})

		it("should handle extremely long paths", () => {
			const longDirectoryName = "a".repeat(50)
			const longFileName = "b".repeat(50) + " " + "c".repeat(50) + ".txt"
			const fullPath = `C:\\Users\\user\\project\\${longDirectoryName}\\${longFileName}`

			expect(convertToMentionPath(fullPath, "C:\\Users\\user\\project")).toBe(
				`@/${longDirectoryName}/${longFileName.replace(/ /g, "\\ ")}`,
			)
		})

		it("should handle paths with already escaped spaces", () => {
			// Note: The input has literal backslash-space sequences which must be written with double backslashes in JS
			// Input in code: "C:\\Users\\user\\project\\file\\ with\\ spaces.txt"
			// Actual string: "C:\Users\user\project\file\ with\ spaces.txt"
			expect(
				convertToMentionPath("C:\\Users\\user\\project\\file\\ with\\ spaces.txt", "C:\\Users\\user\\project"),
			).toBe(
				// Expected output has double-escaped spaces (written with four backslashes in code)
				"@/file/\\ with/\\ spaces.txt",
			)

			// Same test with Unix path format
			expect(convertToMentionPath("/Users/user/project/file\\ with\\ spaces.txt", "/Users/user/project")).toBe(
				"@/file/\\ with/\\ spaces.txt",
			)
		})

		it("should handle UNC paths", () => {
			expect(convertToMentionPath("\\\\server\\share\\folder with spaces\\file.txt", "\\\\server\\share")).toBe(
				"@/folder\\ with\\ spaces/file.txt",
			)
		})

		it("should handle properly escaped backslashes", () => {
			// Each \\\\ in the code represents two backslashes in the actual string
			// Input in code: "C:\\Users\\user\\project\\file\\\\ with\\\\ spaces.txt"
			// Actual string: "C:\Users\user\project\file\\ with\\ spaces.txt"
			expect(
				convertToMentionPath(
					"C:\\Users\\user\\project\\file\\\\ with\\\\ spaces.txt",
					"C:\\Users\\user\\project",
				),
			).toBe(
				// Expected output has double-escaped spaces (the result of two rounds of escaping)
				"@/file//\\ with//\\ spaces.txt",
			)

			// Same test with Unix path format
			expect(
				convertToMentionPath("/Users/user/project/file\\\\ with\\\\ spaces.txt", "/Users/user/project"),
			).toBe("@/file//\\ with//\\ spaces.txt")
		})
	})
})
