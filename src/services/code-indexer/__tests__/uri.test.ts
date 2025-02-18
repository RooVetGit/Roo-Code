import { getCleanUriPath, getUriPathBasename, getFileExtensionFromBasename, getUriFileExtension } from "../uri"

describe("getCleanUriPath", () => {
	it("removes leading and trailing slashes", () => {
		expect(getCleanUriPath("/path/to/file/")).toBe("path/to/file")
		expect(getCleanUriPath("path/to/file/")).toBe("path/to/file")
		expect(getCleanUriPath("/path/to/file")).toBe("path/to/file")
		expect(getCleanUriPath("path/to/file")).toBe("path/to/file")
	})

	it("handles empty paths", () => {
		expect(getCleanUriPath("")).toBe("")
		expect(getCleanUriPath("/")).toBe("")
	})

	it("works with full URLs", () => {
		expect(getCleanUriPath("https://example.com/path/to/file/")).toBe("path/to/file")
		expect(getCleanUriPath("file:///path/to/file")).toBe("path/to/file")
	})
})

describe("getUriPathBasename", () => {
	it("extracts the last path component", () => {
		expect(getUriPathBasename("/path/to/file.txt")).toBe("file.txt")
		expect(getUriPathBasename("path/to/file.txt")).toBe("file.txt")
		expect(getUriPathBasename("file.txt")).toBe("file.txt")
	})

	it("handles encoded characters", () => {
		expect(getUriPathBasename("/path/to/file%20with%20spaces.txt")).toBe("file with spaces.txt")
		expect(getUriPathBasename("/path/to/file%2B%2B.cpp")).toBe("file++.cpp")
	})

	it("returns empty string for empty or root paths", () => {
		expect(getUriPathBasename("")).toBe("")
		expect(getUriPathBasename("/")).toBe("")
	})

	it("works with full URLs", () => {
		expect(getUriPathBasename("https://example.com/path/file.txt")).toBe("file.txt")
		expect(getUriPathBasename("file:///path/to/file.txt")).toBe("file.txt")
	})
})

describe("getFileExtensionFromBasename", () => {
	it("extracts file extensions", () => {
		expect(getFileExtensionFromBasename("file.txt")).toBe("txt")
		expect(getFileExtensionFromBasename("file.TXT")).toBe("txt")
		expect(getFileExtensionFromBasename("script.test.ts")).toBe("ts")
	})

	it("returns empty string for no extension", () => {
		expect(getFileExtensionFromBasename("file")).toBe("")
		expect(getFileExtensionFromBasename(".hidden")).toBe("hidden")
	})

	it("handles empty input", () => {
		expect(getFileExtensionFromBasename("")).toBe("")
		expect(getFileExtensionFromBasename(".")).toBe("")
	})
})

describe("getUriFileExtension", () => {
	it("extracts extensions from URIs", () => {
		expect(getUriFileExtension("https://example.com/path/file.txt")).toBe("txt")
		expect(getUriFileExtension("file:///path/to/script.test.ts")).toBe("ts")
		expect(getUriFileExtension("/path/to/file.TXT")).toBe("txt")
	})

	it("handles paths without extensions", () => {
		expect(getUriFileExtension("https://example.com/path/file")).toBe("")
		expect(getUriFileExtension("/path/to/file")).toBe("")
	})

	it("handles encoded characters", () => {
		expect(getUriFileExtension("/path/to/file%2B%2B.cpp")).toBe("cpp")
		expect(getUriFileExtension("/path/to/file%20with%20spaces.txt")).toBe("txt")
	})
})
