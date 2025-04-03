
	var Cet = Wf(),
		vet = (function () {
			try {
				var e = Cet(Object, "defineProperty")
				return e({}, "", {}), e
			} catch {}
		})()