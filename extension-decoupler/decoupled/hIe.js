
	function Hie(e) {
		if (!e || typeof e.dispatch != "function") throw new v$e("Argument agent must implement Agent")
		Object.defineProperty(globalThis, Vie, {
			value: e,
			writable: !0,
			enumerable: !1,
			configurable: !1,
		})
	}