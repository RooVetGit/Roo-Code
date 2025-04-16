// __tests__/MockTransport.ts
import { CompactTransport } from "../CompactTransport"
const TEST_CONFIG = {
	level: "fatal",
	fileOutput: {
		enabled: false,
		path: "",
	},
}
export class MockTransport extends CompactTransport {
	entries = []
	closed = false
	constructor() {
		super(TEST_CONFIG)
	}
	async write(entry) {
		this.entries.push(entry)
	}
	async close() {
		this.closed = true
		await super.close()
	}
	clear() {
		this.entries = []
		this.closed = false
	}
}
//# sourceMappingURL=MockTransport.js.map
