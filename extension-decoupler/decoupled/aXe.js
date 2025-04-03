
var v_ = require("vscode"),
	cxe = new v_.EventEmitter(),
	uxe = new v_.EventEmitter(),
	dxe = new v_.EventEmitter(),
	fxe = new v_.EventEmitter(),
	Mc = (e) => cxe.event(e),
	mA = (e) => dxe.event(e),
	hxe = (e) => uxe.event(e),
	gxe = (e) => cxe.fire(e),
	pxe = () => dxe.fire(),
	YG = (e) => uxe.fire(e),
	Axe = (e) => fxe.event(e),
	uf = (e) => fxe.fire(e)