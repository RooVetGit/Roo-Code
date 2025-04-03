
var Ik = { AND: "$and", OR: "$or" },
	QW = { PATH: "$path", PATTERN: "$val" },
	NW = (e) => !!(e[Ik.AND] || e[Ik.OR]),
	Gut = (e) => !!e[QW.PATH],
	$ut = (e) => !Jd(e) && Qme(e) && !NW(e),
	Mme = (e) => ({ [Ik.AND]: Object.keys(e).map((t) => ({ [t]: e[t] })) })