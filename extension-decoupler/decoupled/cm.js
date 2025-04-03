
var aM = class extends Error {
		constructor() {
			super("Invalid source folder uri")
		}
	},
	lM = class extends Error {
		constructor(t) {
			super(`cannot access source folder: ${t}`)
		}
	},
	cM = class extends Error {
		constructor() {
			super("source folder is not a directory")
		}
	},
	uM = class extends Error {
		constructor() {
			super("source folder already exists")
		}
	},
	dM = class extends Error {
		constructor() {
			super("source folder is home directory")
		}
	},
	fM = class extends Error {
		constructor() {
			super("source folder is not an external source folder")
		}
	},
	hM = class extends Error {
		constructor() {
			super("source folder does not exist in workspace")
		}
	}