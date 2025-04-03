
var MAe = x((An) => {
	"use strict"
	var kAe = O3(),
		{ warn: gx } = q3()
	An.version = che().version
	An.transports = aAe()
	An.config = VR()
	An.addColors = kAe.levels
	An.format = kAe.format
	An.createLogger = zH()
	An.Logger = KR()
	An.ExceptionHandler = GH()
	An.RejectionHandler = YH()
	An.Container = RAe()
	An.Transport = Dh()
	An.loggers = new An.Container()
	var Gd = An.createLogger()
	Object.keys(An.config.npm.levels)
		.concat([
			"log",
			"query",
			"stream",
			"add",
			"remove",
			"clear",
			"profile",
			"startTimer",
			"handleExceptions",
			"unhandleExceptions",
			"handleRejections",
			"unhandleRejections",
			"configure",
			"child",
		])
		.forEach((e) => (An[e] = (...t) => Gd[e](...t)))
	Object.defineProperty(An, "level", {
		get() {
			return Gd.level
		},
		set(e) {
			Gd.level = e
		},
	})
	Object.defineProperty(An, "exceptions", {
		get() {
			return Gd.exceptions
		},
	})
	;["exitOnError"].forEach((e) => {
		Object.defineProperty(An, e, {
			get() {
				return Gd[e]
			},
			set(t) {
				Gd[e] = t
			},
		})
	})
	Object.defineProperty(An, "default", {
		get() {
			return {
				exceptionHandlers: Gd.exceptionHandlers,
				rejectionHandlers: Gd.rejectionHandlers,
				transports: Gd.transports,
			}
		},
	})
	gx.deprecated(An, "setLevels")
	gx.forFunctions(An, "useFormat", ["cli"])
	gx.forProperties(An, "useFormat", ["padLevels", "stripColors"])
	gx.forFunctions(An, "deprecated", ["addRewriter", "addFilter", "clone", "extend"])
	gx.forProperties(An, "deprecated", ["emitErrs", "levelLength"])
})