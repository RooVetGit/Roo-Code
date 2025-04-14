import { parseMentionsFromText, extractFilePath } from "../context-mentions"

describe("extractFilePath", () => {
	it("should extract fullMatch for path with escaped spaces", () => {
		const text = "@/foo\\ bar/abc.txt"
		const result = extractFilePath(text)
		expect(result).not.toBeNull()
		expect(result!.fullMatch).toBe("@/foo\\ bar/abc.txt")
		expect(result!.value).toBe("/foo bar/abc.txt")
	})

	it("should extract only up to first space for path with unescaped space", () => {
		const text = "@/foo bar/abc.txt"
		const result = extractFilePath(text)
		expect(result).not.toBeNull()
		expect(result!.fullMatch).toBe("@/foo")
		expect(result!.value).toBe("/foo")
	})

	it("should extract fullMatch for path with multiple escaped spaces", () => {
		const text = "@/foo\\ bar/baz\\ qux/abc.txt"
		const result = extractFilePath(text)
		expect(result).not.toBeNull()
		expect(result!.fullMatch).toBe("@/foo\\ bar/baz\\ qux/abc.txt")
		expect(result!.value).toBe("/foo bar/baz qux/abc.txt")
	})

	it("should extract fullMatch for path with special characters", () => {
		const text = "@/foo\\ bar/abc-123_测试.txt"
		const result = extractFilePath(text)
		expect(result).not.toBeNull()
		expect(result!.fullMatch).toBe("@/foo\\ bar/abc-123_测试.txt")
		expect(result!.value).toBe("/foo bar/abc-123_测试.txt")
	})
})

describe("parseMentionsFromText", () => {
	it("should parse mention with escaped spaces", () => {
		const text = "请看这个文件 @/foo\\ bar/abc.txt 很重要"
		const result = parseMentionsFromText(text)
		expect(result.length).toBe(1)
		expect(result[0].fullMatch).toBe("@/foo\\ bar/abc.txt")
		expect(result[0].value).toBe("/foo bar/abc.txt")
	})

	it("should only parse up to first space for path with unescaped space", () => {
		const text = "请看这个文件 @/foo bar/abc.txt 很重要"
		const result = parseMentionsFromText(text)
		expect(result.length).toBe(1)
		expect(result[0].fullMatch).toBe("@/foo")
		expect(result[0].value).toBe("/foo")
	})

	it("should parse multiple mentions with escaped spaces", () => {
		const text = "A @/foo\\ bar/abc.txt and B @/baz\\ qux/def.txt"
		const result = parseMentionsFromText(text)
		expect(result.length).toBe(2)
		expect(result[0].fullMatch).toBe("@/foo\\ bar/abc.txt")
		expect(result[0].value).toBe("/foo bar/abc.txt")
		expect(result[1].fullMatch).toBe("@/baz\\ qux/def.txt")
		expect(result[1].value).toBe("/baz qux/def.txt")
	})
})
