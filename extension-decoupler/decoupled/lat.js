
function LAt() {
	return {
		version() {
			return this._runTask({
				commands: ["--version"],
				format: "utf-8",
				parser: UAt,
				onError(e, t, r, n) {
					if (e.exitCode === -2) return r(Buffer.from(bG))
					n(t)
				},
			})
		},
	}
}