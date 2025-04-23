import { testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { sampleVue } from "./fixtures/sample-vue"
import { vueQuery } from "../queries/vue"

describe("Vue Source Code Definitions Parser", () => {
	const testFilePath = "test.vue"
	const testOptions = {
		language: "vue",
		wasmFile: "tree-sitter-vue.wasm",
		queryString: vueQuery,
		extKey: "vue",
	}

	let parseResult: string | undefined

	beforeAll(async () => {
		parseResult = await testParseSourceCodeDefinitions(testFilePath, sampleVue, testOptions)
		expect(parseResult).toBeDefined()
		if (!parseResult) throw new Error("Failed to parse Vue file")
		debugLog("Vue parse result:", parseResult)
	})

	it("should capture template section", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| <template>/)
	})

	it("should capture script section", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| <script>/)
	})

	it("should capture style section", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| <style>/)
	})
})
