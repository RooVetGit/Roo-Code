import { MarketplaceItem } from "../../../../../src/services/marketplace/types"

export interface GroupedItems {
	[type: string]: {
		type: string
		items: Array<{
			name: string
			description?: string
			metadata?: any
			path?: string
			matchInfo?: {
				matched: boolean
				matchReason?: Record<string, boolean>
			}
		}>
	}
}

/**
 * Groups package items by their type
 * @param items Array of items to group
 * @returns Object with items grouped by type
 */
// Cache for group objects to avoid recreating them
const groupCache = new Map<string, { type: string; items: any[] }>()

export function groupItemsByType(items: MarketplaceItem["items"] = []): GroupedItems {
	if (!items?.length) {
		return {}
	}

	// Clear old items from groups but keep the group objects
	groupCache.forEach((group) => (group.items.length = 0))

	const groups: GroupedItems = {}

	for (const item of items) {
		if (!item.type) continue

		let group = groupCache.get(item.type)
		if (!group) {
			group = {
				type: item.type,
				items: [],
			}
			groupCache.set(item.type, group)
		}

		if (!groups[item.type]) {
			groups[item.type] = group
		}

		group.items.push({
			name: item.metadata?.name || "Unnamed item",
			description: item.metadata?.description,
			metadata: item.metadata,
			path: item.path,
			matchInfo: item.matchInfo,
		})
	}

	return groups
}

/**
 * Gets a formatted string representation of an item
 * @param item The item to format
 * @returns Formatted string with name and description
 */
// Reuse string buffer for formatting
const formatBuffer = {
	result: "",
	maxLength: 100,
}

export function formatItemText(item: { name: string; description?: string }): string {
	if (!item.description) {
		return item.name
	}

	// Reuse the same string buffer
	formatBuffer.result = item.name
	formatBuffer.result += " - "
	formatBuffer.result +=
		item.description.length > formatBuffer.maxLength
			? item.description.substring(0, formatBuffer.maxLength) + "..."
			: item.description

	return formatBuffer.result
}

/**
 * Gets the total number of items across all groups
 * @param groups Grouped items object
 * @returns Total number of items
 */
// Cache array of group values
let groupValuesCache: Array<{ items: any[] }> = []

export function getTotalItemCount(groups: GroupedItems): number {
	groupValuesCache = Object.values(groups)
	return groupValuesCache.reduce((total, group) => total + group.items.length, 0)
}

/**
 * Gets an array of unique types from the grouped items
 * @param groups Grouped items object
 * @returns Array of type strings
 */
// Cache array of types
let typesCache: string[] = []

export function getUniqueTypes(groups: GroupedItems): string[] {
	typesCache = Object.keys(groups)
	typesCache.sort()
	return typesCache
}
