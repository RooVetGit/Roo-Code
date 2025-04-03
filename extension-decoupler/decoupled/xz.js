
	var XZ = ZZ(),
		dVe = Tf(),
		eX = Object.prototype,
		fVe = eX.hasOwnProperty,
		hVe = eX.propertyIsEnumerable,
		gVe = XZ(
			(function () {
				return arguments
			})(),
		)
			? XZ
			: function (e) {
					return dVe(e) && fVe.call(e, "callee") && !hVe.call(e, "callee")
				}