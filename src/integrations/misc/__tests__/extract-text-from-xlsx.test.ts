import ExcelJS from "exceljs"
import { extractTextFromXLSX } from "../extract-text-from-xlsx"

describe("extractTextFromXLSX", () => {
	describe("basic functionality", () => {
		it("should extract text with proper formatting", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = "Hello"
			worksheet.getCell("B1").value = "World"
			worksheet.getCell("A2").value = "Test"
			worksheet.getCell("B2").value = 123

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: Sheet1 ---")
			expect(result).toContain("Hello\tWorld")
			expect(result).toContain("Test\t123")
		})

		it("should skip rows with no content", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = "Row 1"
			// Row 2 is completely empty
			worksheet.getCell("A3").value = "Row 3"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Row 1")
			expect(result).toContain("Row 3")
			// Should not contain empty rows
			expect(result).not.toMatch(/\n\t*\n/)
		})
	})

	describe("sheet handling", () => {
		it("should process multiple sheets", async () => {
			const workbook = new ExcelJS.Workbook()

			const sheet1 = workbook.addWorksheet("First Sheet")
			sheet1.getCell("A1").value = "Sheet 1 Data"

			const sheet2 = workbook.addWorksheet("Second Sheet")
			sheet2.getCell("A1").value = "Sheet 2 Data"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: First Sheet ---")
			expect(result).toContain("Sheet 1 Data")
			expect(result).toContain("--- Sheet: Second Sheet ---")
			expect(result).toContain("Sheet 2 Data")
		})

		it("should skip hidden sheets", async () => {
			const workbook = new ExcelJS.Workbook()

			const visibleSheet = workbook.addWorksheet("Visible Sheet")
			visibleSheet.getCell("A1").value = "Visible Data"

			const hiddenSheet = workbook.addWorksheet("Hidden Sheet")
			hiddenSheet.getCell("A1").value = "Hidden Data"
			hiddenSheet.state = "hidden"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: Visible Sheet ---")
			expect(result).toContain("Visible Data")
			expect(result).not.toContain("--- Sheet: Hidden Sheet ---")
			expect(result).not.toContain("Hidden Data")
		})

		it("should skip very hidden sheets", async () => {
			const workbook = new ExcelJS.Workbook()

			const visibleSheet = workbook.addWorksheet("Visible Sheet")
			visibleSheet.getCell("A1").value = "Visible Data"

			const veryHiddenSheet = workbook.addWorksheet("Very Hidden Sheet")
			veryHiddenSheet.getCell("A1").value = "Very Hidden Data"
			veryHiddenSheet.state = "veryHidden"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: Visible Sheet ---")
			expect(result).toContain("Visible Data")
			expect(result).not.toContain("--- Sheet: Very Hidden Sheet ---")
			expect(result).not.toContain("Very Hidden Data")
		})
	})

	describe("formatCellValue logic", () => {
		it("should handle null and undefined values", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = "Before"
			worksheet.getCell("A2").value = null
			worksheet.getCell("A3").value = undefined
			worksheet.getCell("A4").value = "After"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Before")
			expect(result).toContain("After")
			// Should handle null/undefined as empty strings
			const lines = result.split("\n")
			const dataLines = lines.filter((line) => !line.startsWith("---") && line.trim())
			expect(dataLines).toHaveLength(2) // Only 'Before' and 'After' should create content
		})

		it("should format dates correctly", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			const testDate = new Date("2023-12-25")
			worksheet.getCell("A1").value = testDate

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("2023-12-25")
		})

		it("should handle error values", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = { error: "#DIV/0!" }

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("[Error: #DIV/0!]")
		})

		it("should handle rich text", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = {
				richText: [{ text: "Hello " }, { text: "World", font: { bold: true } }],
			}

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Hello World")
		})

		it("should handle hyperlinks", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = {
				text: "Roo Code",
				hyperlink: "https://roocode.com/",
			}

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Roo Code (https://roocode.com/)")
		})

		it("should handle formulas with and without results", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			worksheet.getCell("A1").value = { formula: "A2+A3", result: 30 }
			worksheet.getCell("A2").value = { formula: "SUM(B1:B10)" }

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("30") // Formula with result
			expect(result).toContain("[Formula: SUM(B1:B10)]") // Formula without result
		})
	})

	describe("edge cases", () => {
		it("should handle empty workbook", async () => {
			const workbook = new ExcelJS.Workbook()
			workbook.addWorksheet("Empty Sheet")

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: Empty Sheet ---")
			expect(result.trim()).toBe("--- Sheet: Empty Sheet ---")
		})

		it("should handle workbook with only empty cells", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			// Set cells but leave them empty
			worksheet.getCell("A1").value = ""
			worksheet.getCell("B1").value = ""

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("--- Sheet: Sheet1 ---")
			// Should not contain any data rows since empty strings don't count as content
			const lines = result.split("\n").filter((line) => line.trim() && !line.startsWith("---"))
			expect(lines).toHaveLength(0)
		})
	})

	describe("function overloads", () => {
		it("should work with workbook objects", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Test")
			worksheet.getCell("A1").value = "Test Data"

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Test Data")
		})

		it("should reject invalid file paths", async () => {
			await expect(extractTextFromXLSX("/non/existent/file.xlsx")).rejects.toThrow()
		})
	})

	describe("row limiting", () => {
		it("should respect maxRows option", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			// Add 10 rows of data
			for (let i = 1; i <= 10; i++) {
				worksheet.getCell(`A${i}`).value = `Row ${i}`
				worksheet.getCell(`B${i}`).value = `Data ${i}`
			}

			const result = await extractTextFromXLSX(workbook, { maxRows: 5 })

			expect(result).toContain("Row 1")
			expect(result).toContain("Row 5")
			expect(result).not.toContain("Row 6")
			expect(result).toContain("[... truncated at 5 total rows across all sheets ...]")
		})

		it("should not truncate when maxRows is not exceeded", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			// Add 3 rows of data
			for (let i = 1; i <= 3; i++) {
				worksheet.getCell(`A${i}`).value = `Row ${i}`
			}

			const result = await extractTextFromXLSX(workbook, { maxRows: 5 })

			expect(result).toContain("Row 1")
			expect(result).toContain("Row 3")
			expect(result).not.toContain("truncated")
		})

		it("should handle maxRows across multiple sheets", async () => {
			const workbook = new ExcelJS.Workbook()

			const sheet1 = workbook.addWorksheet("Sheet1")
			for (let i = 1; i <= 3; i++) {
				sheet1.getCell(`A${i}`).value = `Sheet1 Row ${i}`
			}

			const sheet2 = workbook.addWorksheet("Sheet2")
			for (let i = 1; i <= 3; i++) {
				sheet2.getCell(`A${i}`).value = `Sheet2 Row ${i}`
			}

			const result = await extractTextFromXLSX(workbook, { maxRows: 4 })

			expect(result).toContain("Sheet1 Row 1")
			expect(result).toContain("Sheet1 Row 3")
			expect(result).toContain("Sheet2 Row 1")
			expect(result).not.toContain("Sheet2 Row 2")
			expect(result).toContain("[... truncated at 4 total rows across all sheets ...]")
		})

		it("should use default limit when no maxRows specified", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			// Add a few rows
			for (let i = 1; i <= 5; i++) {
				worksheet.getCell(`A${i}`).value = `Row ${i}`
			}

			const result = await extractTextFromXLSX(workbook)

			expect(result).toContain("Row 1")
			expect(result).toContain("Row 5")
			expect(result).not.toContain("truncated")
		})

		it("should handle empty rows correctly when counting towards limit", async () => {
			const workbook = new ExcelJS.Workbook()
			const worksheet = workbook.addWorksheet("Sheet1")

			// Add rows with some empty ones
			worksheet.getCell("A1").value = "Row 1"
			// Row 2 is empty
			worksheet.getCell("A3").value = "Row 3"
			worksheet.getCell("A4").value = "Row 4"
			worksheet.getCell("A5").value = "Row 5"

			const result = await extractTextFromXLSX(workbook, { maxRows: 3 })

			expect(result).toContain("Row 1")
			expect(result).toContain("Row 3")
			expect(result).toContain("Row 4")
			expect(result).not.toContain("Row 5")
			expect(result).toContain("[... truncated at 3 total rows across all sheets ...]")
		})
	})
})
