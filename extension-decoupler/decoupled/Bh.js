
var LT = class extends Error {
		constructor() {
			super("No models available")
		}
	},
	bh = class extends Error {
		constructor(t = "Skipping inline completion.") {
			super(t)
		}
	}