
	function Ogt() {
		if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
			return !0
		if (
			typeof navigator < "u" &&
			navigator.userAgent &&
			navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
		)
			return !1
		let e
		return (
			(typeof document < "u" &&
				document.documentElement &&
				document.documentElement.style &&
				document.documentElement.style.WebkitAppearance) ||
			(typeof window < "u" &&
				window.console &&
				(window.console.firebug || (window.console.exception && window.console.table))) ||
			(typeof navigator < "u" &&
				navigator.userAgent &&
				(e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
				parseInt(e[1], 10) >= 31) ||
			(typeof navigator < "u" &&
				navigator.userAgent &&
				navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
		)
	}