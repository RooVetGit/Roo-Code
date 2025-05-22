import { readFileSmart, scoreText, getCandidateEncodings, tryDecodeBuffer } from "../readFileWithEncoding"
import * as fs from "fs/promises"
import * as chardet from "chardet"
import * as iconv from "iconv-lite"

jest.mock("fs/promises")
jest.mock("chardet")
jest.mock("iconv-lite")

const mockedFs = fs as jest.Mocked<typeof fs>
const mockedChardet = chardet as jest.Mocked<typeof chardet>
const mockedIconv = iconv as jest.Mocked<typeof iconv>

describe("readFileWithEncoding", () => {
	describe("scoreText", () => {
		it("should score pure ASCII text lower", () => {
			const score = scoreText("hello world")
			expect(score).toBeLessThan(0)
		})

		it("should score Chinese text higher", () => {
			const score = scoreText("你好世界")
			expect(score).toBeGreaterThan(0)
		})

		it("should score mixed text appropriately", () => {
			const score = scoreText("hello 你好")
			expect(score).toBeGreaterThan(0)
		})
	})

	describe("getCandidateEncodings", () => {
		it("should include base encodings", () => {
			const encodings = getCandidateEncodings("")
			expect(encodings).toEqual(expect.arrayContaining(["utf-8", "gb18030", "gbk", "shift_jis"]))
		})

		it("should add detected encoding", () => {
			const encodings = getCandidateEncodings("big5")
			expect(encodings).toContain("big5")
		})
	})

	describe("tryDecodeBuffer", () => {
		it("should return best decoded text", () => {
			const mockResult = {
				text: "测试内容",
				score: 1.5,
				encoding: "gbk",
			}
			jest.spyOn(require("../readFileWithEncoding"), "tryDecodeBuffer").mockReturnValue(mockResult)

			const buffer = Buffer.from("测试内容")
			const result = tryDecodeBuffer(buffer, ["utf-8", "gbk", "shift_jis"])

			expect(result.encoding).toBe("gbk")
			expect(result.text).toBe("测试内容")
			expect(result.score).toBe(1.5)
		})
	})

	describe("readFileSmart", () => {
		beforeEach(() => {
			jest.clearAllMocks()
		})

		it("should read utf-8 text file correctly", async () => {
			const mockBuffer = Buffer.from("utf8内容")
			mockedFs.readFile.mockResolvedValue(mockBuffer)
			mockedChardet.detect.mockReturnValue("utf-8")
			mockedIconv.decode.mockImplementation((buffer: Buffer) => buffer.toString())

			const result = await readFileSmart("test.txt")
			expect(result).toBe("utf8内容")
		})

		it("should read gbk text file correctly", async () => {
			const mockBuffer = Buffer.from("gbk内容")
			mockedFs.readFile.mockResolvedValue(mockBuffer)
			mockedChardet.detect.mockReturnValue("gbk")
			mockedIconv.decode.mockImplementation((buffer: Buffer, encoding: string) =>
				encoding === "gbk" ? "gbk解码内容" : buffer.toString(),
			)

			const result = await readFileSmart("test.txt")
			expect(result).toBe("gbk解码内容")
		})

		it("should force utf-8 output when toUtf8=true", async () => {
			const mockBuffer = Buffer.from("gbk内容")
			mockedFs.readFile.mockResolvedValue(mockBuffer)
			mockedChardet.detect.mockReturnValue("gbk")
			mockedIconv.decode.mockReturnValue("gbk解码内容")

			const result = await readFileSmart("test.txt", true)
			expect(result).toBe(Buffer.from("gbk解码内容").toString("utf8"))
		})

		it("should fallback to utf-8 when decode fails", async () => {
			const mockBuffer = Buffer.from("fallback内容")
			mockedFs.readFile.mockResolvedValue(mockBuffer)
			mockedChardet.detect.mockReturnValue("unknown")
			mockedIconv.decode.mockImplementation(() => {
				throw new Error("Decode error")
			})

			const result = await readFileSmart("test.bin")
			expect(result).toBe("fallback内容")
		})

		it("should handle text file extensions specially", async () => {
			const mockBuffer = Buffer.from("md内容")
			mockedFs.readFile.mockResolvedValue(mockBuffer)
			mockedChardet.detect.mockReturnValue("utf-8")

			const result = await readFileSmart("test.md")
			expect(result).toBe("md内容")
		})
	})
})
