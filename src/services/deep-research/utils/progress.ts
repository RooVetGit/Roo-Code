// Calculate total expected queries across all depth levels.
// At each level, the breadth is halved, so level 1 has full breadth,
// level 2 has breadth/2, level 3 has breadth/4, etc.
// For breadth = 4, depth = 2, the expected queries are:
// D2: 2^2 * 1 = 4
// D1: 2^1 * 2 = 4
// D0: 2^0 * 4 = 4
// Total: 12
export const getTreeSize = ({ breadth, depth }: { breadth: number; depth: number }) => {
	let value = 0

	for (let i = depth; i >= 0; i--) {
		value = value + Math.pow(2, i) * Math.ceil(breadth / Math.pow(2, i))
	}

	return value
}
