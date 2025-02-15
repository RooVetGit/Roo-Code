// npx jest src/services/deep-research/__tests__/utils/progress.test.ts

import { getTreeSize } from "../../utils/progress"

describe("getTreeSize", () => {
	it("should calculate the correct number of expected queries", () => {
		// Typical cases.
		expect(getTreeSize({ breadth: 2, depth: 0 })).toBe(2)
		expect(getTreeSize({ breadth: 3, depth: 1 })).toBe(7)
		expect(getTreeSize({ breadth: 4, depth: 2 })).toBe(12)
		expect(getTreeSize({ breadth: 5, depth: 3 })).toBe(27)

		// Try each minimum and maximum for breadth and depth.
		expect(getTreeSize({ breadth: 1, depth: 0 })).toBe(1)
		expect(getTreeSize({ breadth: 10, depth: 0 })).toBe(10)
		expect(getTreeSize({ breadth: 1, depth: 9 })).toBe(1023)
		expect(getTreeSize({ breadth: 10, depth: 9 })).toBe(1056)
	})
})
