import { groupItemsByType, formatItemText, getTotalItemCount, getUniqueTypes } from "../grouping"
import { MarketplaceItem } from "../../../../../../src/services/marketplace/types"

describe("grouping utilities", () => {
	const mockItems = [
		{
			type: "mcp server",
			path: "servers/test-server",
			metadata: {
				name: "Test Server",
				description: "A test server",
				version: "1.0.0",
			},
		},
		{
			type: "mode",
			path: "modes/test-mode",
			metadata: {
				name: "Test Mode",
				description: "A test mode",
				version: "2.0.0",
			},
		},
		{
			type: "mcp server",
			path: "servers/another-server",
			metadata: {
				name: "Another Server",
				description: "Another test server",
				version: "1.1.0",
			},
		},
	] as MarketplaceItem["items"]

	describe("groupItemsByType", () => {
		it("should group items by type correctly", () => {
			const result = groupItemsByType(mockItems)

			expect(Object.keys(result)).toHaveLength(2)
			expect(result["mcp server"].items).toHaveLength(2)
			expect(result["mode"].items).toHaveLength(1)

			expect(result["mcp server"].items[0].name).toBe("Test Server")
			expect(result["mode"].items[0].name).toBe("Test Mode")
		})

		it("should handle empty items array", () => {
			expect(groupItemsByType([])).toEqual({})
			expect(groupItemsByType(undefined)).toEqual({})
		})

		it("should handle items with missing metadata", () => {
			const itemsWithMissingData = [
				{
					type: "mcp server",
					path: "test/path",
				},
			] as MarketplaceItem["items"]

			const result = groupItemsByType(itemsWithMissingData)
			expect(result["mcp server"].items[0].name).toBe("Unnamed item")
		})

		it("should preserve item order within groups", () => {
			const result = groupItemsByType(mockItems)
			const servers = result["mcp server"].items

			expect(servers[0].name).toBe("Test Server")
			expect(servers[1].name).toBe("Another Server")
		})

		it("should skip items without type", () => {
			const itemsWithoutType = [
				{
					path: "test/path",
					metadata: { name: "Test" },
				},
			] as MarketplaceItem["items"]

			const result = groupItemsByType(itemsWithoutType)
			expect(Object.keys(result)).toHaveLength(0)
		})
	})

	describe("formatItemText", () => {
		it("should format item with name and description", () => {
			const item = { name: "Test", description: "Description" }
			expect(formatItemText(item)).toBe("Test - Description")
		})

		it("should handle items without description", () => {
			const item = { name: "Test" }
			expect(formatItemText(item)).toBe("Test")
		})
	})

	describe("getTotalItemCount", () => {
		it("should count total items across all groups", () => {
			const groups = groupItemsByType(mockItems)
			expect(getTotalItemCount(groups)).toBe(3)
		})

		it("should handle empty groups", () => {
			expect(getTotalItemCount({})).toBe(0)
		})
	})

	describe("getUniqueTypes", () => {
		it("should return sorted array of unique types", () => {
			const groups = groupItemsByType(mockItems)
			const types = getUniqueTypes(groups)

			expect(types).toEqual(["mcp server", "mode"])
		})

		it("should handle empty groups", () => {
			expect(getUniqueTypes({})).toEqual([])
		})
	})
})
