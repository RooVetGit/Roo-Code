
	function U0(e, t) {
		var r = function () {
			return new hn.aes.Algorithm(e, t)
		}
		hn.cipher.registerAlgorithm(e, r)
	}