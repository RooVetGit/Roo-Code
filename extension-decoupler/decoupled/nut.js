
function Nut(e, { getFn: t = Dt.getFn, fieldNormWeight: r = Dt.fieldNormWeight } = {}) {
	let { keys: n, records: i } = e,
		s = new Tx({ getFn: t, fieldNormWeight: r })
	return s.setKeys(n), s.setIndexRecords(i), s
}