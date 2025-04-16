export class FakeAIHandler {
	ai
	constructor(options) {
		if (!options.fakeAi) {
			throw new Error("Fake AI is not set")
		}
		this.ai = options.fakeAi
	}
	async *createMessage(systemPrompt, messages) {
		yield* this.ai.createMessage(systemPrompt, messages)
	}
	getModel() {
		return this.ai.getModel()
	}
	countTokens(content) {
		return this.ai.countTokens(content)
	}
	completePrompt(prompt) {
		return this.ai.completePrompt(prompt)
	}
}
//# sourceMappingURL=fake-ai.js.map
