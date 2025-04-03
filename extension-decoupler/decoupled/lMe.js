
function Lme(e, t, { getFn: r = Dt.getFn, fieldNormWeight: n = Dt.fieldNormWeight } = {}) {
	let i = new Tx({ getFn: r, fieldNormWeight: n })
	return i.setKeys(e.map(Pme)), i.setSources(t), i.create(), i
}