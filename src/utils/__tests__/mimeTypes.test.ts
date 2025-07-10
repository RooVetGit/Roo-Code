import { describe, it, expect } from "vitest"
import { getMimeType, isImageExtension } from "../mimeTypes"

describe("mimeTypes", () => {
	describe("getMimeType", () => {
		it("should return correct MIME types for common image formats", () => {
			expect(getMimeType("image.png")).toBe("image/png")
			expect(getMimeType("photo.jpg")).toBe("image/jpeg")
			expect(getMimeType("photo.jpeg")).toBe("image/jpeg")
			expect(getMimeType("icon.gif")).toBe("image/gif")
			expect(getMimeType("logo.svg")).toBe("image/svg+xml")
			expect(getMimeType("picture.webp")).toBe("image/webp")
			expect(getMimeType("bitmap.bmp")).toBe("image/bmp")
			expect(getMimeType("icon.ico")).toBe("image/x-icon")
		})

		it("should return correct MIME types for text formats", () => {
			expect(getMimeType("file.txt")).toBe("text/plain")
			expect(getMimeType("script.js")).toBe("text/javascript")
			expect(getMimeType("script.ts")).toBe("text/typescript")
			expect(getMimeType("style.css")).toBe("text/css")
			expect(getMimeType("page.html")).toBe("text/html")
			expect(getMimeType("data.json")).toBe("application/json")
			expect(getMimeType("config.xml")).toBe("application/xml")
			expect(getMimeType("readme.md")).toBe("text/markdown")
			expect(getMimeType("config.yaml")).toBe("text/yaml")
			expect(getMimeType("config.yml")).toBe("text/yaml")
		})

		it("should return correct MIME types for programming languages", () => {
			expect(getMimeType("app.py")).toBe("text/x-python")
			expect(getMimeType("main.java")).toBe("text/x-java")
			expect(getMimeType("main.cpp")).toBe("text/x-c++src")
			expect(getMimeType("main.c")).toBe("text/x-c")
			expect(getMimeType("main.cs")).toBe("text/x-csharp")
			expect(getMimeType("main.go")).toBe("text/x-go")
			expect(getMimeType("main.rs")).toBe("text/x-rust")
			expect(getMimeType("main.rb")).toBe("text/x-ruby")
			expect(getMimeType("main.php")).toBe("text/x-php")
			expect(getMimeType("main.swift")).toBe("text/x-swift")
			expect(getMimeType("main.kt")).toBe("text/x-kotlin")
		})

		it("should handle paths with directories", () => {
			expect(getMimeType("/path/to/image.png")).toBe("image/png")
			expect(getMimeType("C:\\Users\\test\\document.pdf")).toBe("application/pdf")
			expect(getMimeType("./src/main.js")).toBe("text/javascript")
		})

		it("should be case insensitive", () => {
			expect(getMimeType("IMAGE.PNG")).toBe("image/png")
			expect(getMimeType("Script.JS")).toBe("text/javascript")
			expect(getMimeType("DATA.JSON")).toBe("application/json")
		})

		it("should return application/octet-stream for unknown extensions", () => {
			expect(getMimeType("file.xyz")).toBe("application/octet-stream")
			expect(getMimeType("unknown")).toBe("application/octet-stream")
			expect(getMimeType("")).toBe("application/octet-stream")
		})

		it("should handle files without extensions", () => {
			expect(getMimeType("README")).toBe("application/octet-stream")
			expect(getMimeType("Makefile")).toBe("application/octet-stream")
			expect(getMimeType(".gitignore")).toBe("application/octet-stream")
		})

		it("should handle special cases", () => {
			expect(getMimeType("archive.tar.gz")).toBe("application/octet-stream")
			expect(getMimeType("file.min.js")).toBe("text/javascript")
			expect(getMimeType("style.min.css")).toBe("text/css")
		})
	})

	describe("isImageExtension", () => {
		it("should return true for common image extensions", () => {
			expect(isImageExtension("png")).toBe(true)
			expect(isImageExtension("jpg")).toBe(true)
			expect(isImageExtension("jpeg")).toBe(true)
			expect(isImageExtension("gif")).toBe(true)
			expect(isImageExtension("webp")).toBe(true)
			expect(isImageExtension("bmp")).toBe(true)
			expect(isImageExtension("svg")).toBe(true)
			expect(isImageExtension("ico")).toBe(true)
		})

		it("should be case insensitive", () => {
			expect(isImageExtension("PNG")).toBe(true)
			expect(isImageExtension("Jpg")).toBe(true)
			expect(isImageExtension("JPEG")).toBe(true)
		})

		it("should return false for non-image extensions", () => {
			expect(isImageExtension("txt")).toBe(false)
			expect(isImageExtension("js")).toBe(false)
			expect(isImageExtension("pdf")).toBe(false)
			expect(isImageExtension("doc")).toBe(false)
			expect(isImageExtension("mp4")).toBe(false)
		})

		it("should return false for empty or invalid input", () => {
			expect(isImageExtension("")).toBe(false)
			expect(isImageExtension("   ")).toBe(false)
		})

		it("should handle extensions with dots", () => {
			expect(isImageExtension(".png")).toBe(true)
			expect(isImageExtension(".jpg")).toBe(true)
		})
	})
})
