
	function U3e(e, t, r) {
		if (!e || typeof e != "object") throw new Ji("handler must be an object")
		if (typeof e.onConnect != "function") throw new Ji("invalid onConnect method")
		if (typeof e.onError != "function") throw new Ji("invalid onError method")
		if (typeof e.onBodySent != "function" && e.onBodySent !== void 0) throw new Ji("invalid onBodySent method")
		if (r || t === "CONNECT") {
			if (typeof e.onUpgrade != "function") throw new Ji("invalid onUpgrade method")
		} else {
			if (typeof e.onHeaders != "function") throw new Ji("invalid onHeaders method")
			if (typeof e.onData != "function") throw new Ji("invalid onData method")
			if (typeof e.onComplete != "function") throw new Ji("invalid onComplete method")
		}
	}