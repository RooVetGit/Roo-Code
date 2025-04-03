
	var Yoe = typeof process.versions.icu == "string",
		Voe = Yoe ? new TextDecoder("utf-8", { fatal: !0 }) : void 0,
		Koe = Yoe
			? Voe.decode.bind(Voe)
			: function (e) {
					if (wJe(e)) return e.toString("utf-8")
					throw new TypeError("Invalid utf-8 received.")
				}