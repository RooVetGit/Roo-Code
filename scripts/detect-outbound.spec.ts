import { describe, it, expect } from "vitest"
import { detectOutboundCalls, OutboundCall } from "./detect-outbound"

describe("detect-outbound", () => {
	it("should find HTTP/HTTPS URLs in code files", async () => {
		const results = await detectOutboundCalls("src")

		expect(results).toContainEqual(
			expect.objectContaining({
				url: "https://openrouter.ai/api/v1/models",
				file: expect.stringContaining("use-open-router-models.ts"),
				type: "external_api",
			}),
		)

		expect(results).toContainEqual(
			expect.objectContaining({
				url: "https://api.github.com/repos/RooCodeInc/Roo-Code",
				file: expect.stringContaining("stats.ts"),
				type: "external_api",
			}),
		)
	})

	it("should categorize local URLs as internal", async () => {
		const results = await detectOutboundCalls("src")

		const localCall = results.find((call) => call.url.includes("localhost"))
		expect(localCall?.type).toBe("local")
	})

	it("should identify telemetry calls", async () => {
		const results = await detectOutboundCalls("packages/cloud")

		const telemetryCall = results.find((call) => call.file.includes("TelemetryClient") && call.url.includes("api/"))
		expect(telemetryCall?.type).toBe("telemetry")
	})

	it("should generate CSV output", async () => {
		const results = await detectOutboundCalls("src")
		const csv = generateCSV(results)

		expect(csv).toContain("url,file,type,line")
		expect(csv).toContain("https://")
		expect(csv.split("\n").length).toBeGreaterThan(1)
	})

	it("should exclude schema URLs and documentation links", async () => {
		const results = await detectOutboundCalls("src")

		const schemaUrls = results.filter(
			(call) => call.url.includes("schema.json") || call.url.includes("go.microsoft.com"),
		)
		expect(schemaUrls).toHaveLength(0)
	})
})

function generateCSV(calls: OutboundCall[]): string {
	const header = "url,file,type,line\n"
	const rows = calls.map((call) => `"${call.url}","${call.file}","${call.type}",${call.line}`).join("\n")
	return header + rows
}
