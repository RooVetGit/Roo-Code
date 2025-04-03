
var Dy = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date,
	Hme = new Set(),
	PW = typeof process == "object" && process ? process : {},
	Wme = (e, t, r, n) => {
		typeof PW.emitWarning == "function" ? PW.emitWarning(e, t, r, n) : console.error(`[${r}] ${t}: ${e}`)
	},
	Bk = globalThis.AbortController,
	Vme = globalThis.AbortSignal