
	function $le(e) {
		return (
			typeof dl.globalScope < "u" &&
			typeof dl.globalScope.crypto == "object" &&
			typeof dl.globalScope.crypto.subtle == "object" &&
			typeof dl.globalScope.crypto.subtle[e] == "function"
		)
	}