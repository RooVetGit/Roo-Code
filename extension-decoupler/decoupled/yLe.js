
	function Yle(e) {
		return (
			typeof dl.globalScope < "u" &&
			typeof dl.globalScope.msCrypto == "object" &&
			typeof dl.globalScope.msCrypto.subtle == "object" &&
			typeof dl.globalScope.msCrypto.subtle[e] == "function"
		)
	}