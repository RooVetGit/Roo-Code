
	function Z2e(e) {
		var t
		typeof e.default == "function"
			? (t = e.default)
			: typeof e.default == "number"
				? (t = function () {
						return e.default
					})
				: (t = function () {
						wJ.assert(!1, typeof e.default)
					})
		var r = e.type === "unsigned long",
			n = e.type === "long",
			i = e.type === "limited unsigned long with fallback",
			s = e.min,
			o = e.max,
			a = e.setmin
		return (
			s === void 0 && (r && (s = 0), n && (s = -2147483648), i && (s = 1)),
			o === void 0 && (r || n || i) && (o = 2147483647),
			{
				get: function () {
					var l = this._getattr(e.name),
						c = e.float ? parseFloat(l) : parseInt(l, 10)
					if (l === null || !isFinite(c) || (s !== void 0 && c < s) || (o !== void 0 && c > o))
						return t.call(this)
					if (r || n || i) {
						if (!/^[ \t\n\f\r]*[-+]?[0-9]/.test(l)) return t.call(this)
						c = c | 0
					}
					return c
				},
				set: function (l) {
					e.float || (l = Math.floor(l)),
						a !== void 0 && l < a && wJ.IndexSizeError(e.name + " set to " + l),
						r
							? (l = l < 0 || l > 2147483647 ? t.call(this) : l | 0)
							: i
								? (l = l < 1 || l > 2147483647 ? t.call(this) : l | 0)
								: n && (l = l < -2147483648 || l > 2147483647 ? t.call(this) : l | 0),
						this._setattr(e.name, String(l))
				},
			}
		)
	}