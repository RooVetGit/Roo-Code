describe("Slack Webhook Test", () => {
	it("should deliberately fail to test Slack notifications", () => {
		// This test is designed to fail to trigger the Slack webhook.
		expect(true).toBe(false)
	})

	it("should pass to show mixed results", () => {
		expect(1 + 1).toBe(2)
	})
})
