
	function ge(e, t, r) {
		;(this.data = []),
			e != null &&
				(typeof e == "number"
					? this.fromNumber(e, t, r)
					: t == null && typeof e != "string"
						? this.fromString(e, 256)
						: this.fromString(e, t))
	}