
var Ob = class extends Error {
	constructor(r) {
		super(`Configured model "${r}" is not available`)
		this.modelName = r
	}
}