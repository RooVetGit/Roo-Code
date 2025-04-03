
	var W2e = /^[_:A-Za-z][-.:\w]+$/,
		G2e = /^([_A-Za-z][-.\w]+|[_A-Za-z][-.\w]+:[_A-Za-z][-.\w]+)$/,
		Kv =
			"_A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD",
		Jv =
			"-._A-Za-z0-9\xB7\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0300-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD",
		Jg = "[" + Kv + "][" + Jv + "]*",
		dL = Kv + ":",
		fL = Jv + ":",
		$2e = new RegExp("^[" + dL + "][" + fL + "]*$"),
		Y2e = new RegExp("^(" + Jg + "|" + Jg + ":" + Jg + ")$"),
		bJ = /[\uD800-\uDB7F\uDC00-\uDFFF]/,
		xJ = /[\uD800-\uDB7F\uDC00-\uDFFF]/g,
		_J = /[\uD800-\uDB7F][\uDC00-\uDFFF]/g