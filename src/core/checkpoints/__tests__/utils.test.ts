import { describe, it, expect } from "vitest"
import { isValidCheckpoint, hasValidCheckpoint, extractCheckpoint, type ValidCheckpoint } from "../utils"

describe("checkpoint utils", () => {
	describe("isValidCheckpoint", () => {
		it("should return true for valid checkpoint", () => {
			const checkpoint: ValidCheckpoint = { hash: "abc123" }
			expect(isValidCheckpoint(checkpoint)).toBe(true)
		})

		it("should return false for null or undefined", () => {
			expect(isValidCheckpoint(null)).toBe(false)
			expect(isValidCheckpoint(undefined)).toBe(false)
		})

		it("should return false for non-object types", () => {
			expect(isValidCheckpoint("string")).toBe(false)
			expect(isValidCheckpoint(123)).toBe(false)
			expect(isValidCheckpoint(true)).toBe(false)
			expect(isValidCheckpoint([])).toBe(false)
		})

		it("should return false for objects without hash property", () => {
			expect(isValidCheckpoint({})).toBe(false)
			expect(isValidCheckpoint({ other: "property" })).toBe(false)
		})

		it("should return false for objects with non-string hash", () => {
			expect(isValidCheckpoint({ hash: 123 })).toBe(false)
			expect(isValidCheckpoint({ hash: null })).toBe(false)
			expect(isValidCheckpoint({ hash: undefined })).toBe(false)
			expect(isValidCheckpoint({ hash: {} })).toBe(false)
			expect(isValidCheckpoint({ hash: [] })).toBe(false)
		})

		it("should return false for empty hash string", () => {
			expect(isValidCheckpoint({ hash: "" })).toBe(false)
		})

		it("should return true for valid hash strings", () => {
			expect(isValidCheckpoint({ hash: "a" })).toBe(true)
			expect(isValidCheckpoint({ hash: "abc123def456" })).toBe(true)
			expect(isValidCheckpoint({ hash: "commit-hash-with-dashes" })).toBe(true)
		})
	})

	describe("hasValidCheckpoint", () => {
		it("should return true for message with valid checkpoint", () => {
			const message = { checkpoint: { hash: "abc123" } }
			expect(hasValidCheckpoint(message)).toBe(true)
		})

		it("should return false for null or undefined message", () => {
			expect(hasValidCheckpoint(null)).toBe(false)
			expect(hasValidCheckpoint(undefined)).toBe(false)
		})

		it("should return false for non-object message", () => {
			expect(hasValidCheckpoint("string")).toBe(false)
			expect(hasValidCheckpoint(123)).toBe(false)
		})

		it("should return false for message without checkpoint property", () => {
			expect(hasValidCheckpoint({})).toBe(false)
			expect(hasValidCheckpoint({ text: "message" })).toBe(false)
		})

		it("should return false for message with invalid checkpoint", () => {
			expect(hasValidCheckpoint({ checkpoint: null })).toBe(false)
			expect(hasValidCheckpoint({ checkpoint: "invalid" })).toBe(false)
			expect(hasValidCheckpoint({ checkpoint: {} })).toBe(false)
			expect(hasValidCheckpoint({ checkpoint: { hash: "" } })).toBe(false)
			expect(hasValidCheckpoint({ checkpoint: { hash: 123 } })).toBe(false)
		})

		it("should work as type guard", () => {
			const message: unknown = { checkpoint: { hash: "abc123" }, other: "data" }
			if (hasValidCheckpoint(message)) {
				// TypeScript should know message has checkpoint property
				expect(message.checkpoint.hash).toBe("abc123")
			}
		})
	})

	describe("extractCheckpoint", () => {
		it("should extract valid checkpoint from message", () => {
			const message = { checkpoint: { hash: "abc123" } }
			const result = extractCheckpoint(message)
			expect(result).toEqual({ hash: "abc123" })
		})

		it("should return undefined for message without valid checkpoint", () => {
			expect(extractCheckpoint({})).toBeUndefined()
			expect(extractCheckpoint({ checkpoint: null })).toBeUndefined()
			expect(extractCheckpoint({ checkpoint: { hash: "" } })).toBeUndefined()
			expect(extractCheckpoint(null)).toBeUndefined()
			expect(extractCheckpoint(undefined)).toBeUndefined()
		})

		it("should return the same checkpoint object reference", () => {
			const checkpoint = { hash: "abc123" }
			const message = { checkpoint }
			const result = extractCheckpoint(message)
			expect(result).toBe(checkpoint)
		})
	})
})
