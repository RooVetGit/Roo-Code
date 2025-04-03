
function jpt() {
	return {
		countObjects() {
			return this._runTask({
				commands: ["count-objects", "--verbose"],
				format: "utf-8",
				parser(e) {
					return Zo(zpt(), [nEe], e)
				},
			})
		},
	}
}