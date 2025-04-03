
var EM,
	yCe,
	w4,
	Yn,
	vM,
	xgt,
	_gt,
	B4 = oke(() => {
		"use strict"
		;(EM = W(require("process"))), (yCe = W(require("os"))), (w4 = W(require("tty")))
		;({ env: Yn } = EM.default)
		xl("no-color") || xl("no-colors") || xl("color=false") || xl("color=never")
			? (vM = 0)
			: (xl("color") || xl("colors") || xl("color=true") || xl("color=always")) && (vM = 1)
		;(xgt = {
			stdout: I4({ isTTY: w4.default.isatty(1) }),
			stderr: I4({ isTTY: w4.default.isatty(2) }),
		}),
			(_gt = xgt)
	})