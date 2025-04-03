
function ave(e) {
	return {
		type: "task.error",
		action(t, r) {
			let n = e(t.error, {
				stdErr: r.stdErr,
				stdOut: r.stdOut,
				exitCode: r.exitCode,
			})
			return Buffer.isBuffer(n) ? { error: new ef(void 0, n.toString("utf-8")) } : { error: n }
		},
	}
}