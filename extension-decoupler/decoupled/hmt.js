
function Hmt(e) {
	return e
		? [
				{
					type: "spawn.before",
					action(n, i) {
						e.aborted && i.kill(new Xd(void 0, "abort", "Abort already signaled"))
					},
				},
				{
					type: "spawn.after",
					action(n, i) {
						function s() {
							i.kill(new Xd(void 0, "abort", "Abort signal received"))
						}
						e.addEventListener("abort", s), i.spawned.on("close", () => e.removeEventListener("abort", s))
					},
				},
			]
		: void 0
}