import { removeLeadingNonAlphanumeric } from "../CodeAccordian"

describe("removeLeadingNonAlphanumeric", () => {
	it("should return the original string if it's empty", () => {
		// Arrange
		const input = ""

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("")
	})

	it("should return the original string if it starts with an alphanumeric character", () => {
		// Arrange
		const input = "abc"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("abc")
	})

	it("should return the original string if it starts with a Unicode character", () => {
		// Arrange
		const input = "你好world"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("你好world")
	})

	it("should remove all leading non-alphanumeric characters", () => {
		// Arrange
		const input = "~!@#$abc"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("abc")
	})

	it("should handle a string with only non-alphanumeric characters", () => {
		// Arrange
		const input = "~!@#$"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("")
	})

	it("should handle a long string with leading non-alphanumeric characters", () => {
		// Arrange
		const input = "~!@#$%^&*()_+=-`abcde12345"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("abcde12345")
	})

	it("should handle a string with only Unicode characters", () => {
		// Arrange
		const input = "你好"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("你好")
	})

	it("should handle a string with Unicode and alphanumeric characters", () => {
		// Arrange
		const input = "你好abc"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("你好abc")
	})

	it("should handle a string with Unicode and special characters", () => {
		// Arrange
		const input = "~!@#你好"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("你好")
	})

	it("should handle a string with mixed Unicode, alphanumeric, and special characters", () => {
		// Arrange
		const input = "~!@#你好abc"

		// Act
		const result = removeLeadingNonAlphanumeric(input)

		// Assert
		expect(result).toBe("你好abc")
	})

	it("should not modify a string that already starts with an alphanumeric character after special characters", () => {
		const input = "你好123"
		const result = removeLeadingNonAlphanumeric(input)
		expect(result).toBe("你好123")
	})
})
