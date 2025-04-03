
var Age = x((Th) => {
	"use strict"
	Object.defineProperty(Th, "__esModule", { value: !0 })
	Th.fallback = gge
	Th.wrap = pge
	var yot = (Th.hasQueueMicrotask = typeof queueMicrotask == "function" && queueMicrotask),
		Cot = (Th.hasSetImmediate = typeof setImmediate == "function" && setImmediate),
		vot = (Th.hasNextTick = typeof process == "object" && typeof process.nextTick == "function")
	function gge(e) {
		setTimeout(e, 0)
	}
	function pge(e) {
		return (t, ...r) => e(() => t(...r))
	}
	var ex
	yot ? (ex = queueMicrotask) : Cot ? (ex = setImmediate) : vot ? (ex = process.nextTick) : (ex = gge)
	Th.default = pge(ex)
})