
function Rct() {
	if (px) return px
	let e = FAe.window.createOutputChannel("Augment", { log: !0 }),
		t = [new jH(e)]
	return (
		process.env.CONSOLE_LOG_LEVEL && t.push(new kh.transports.Console({ level: process.env.CONSOLE_LOG_LEVEL })),
		(px = (0, kh.createLogger)({
			level: "debug",
			exitOnError: !1,
			format: kh.format.combine(
				kh.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
				kh.format.printf((r) => `${r.timestamp} [${r.level}] '${r.prefix}': ${r.message}`),
			),
			transports: t,
		})),
		g$(px),
		px
	)
}