import { useState } from "react"

const RooHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<div className="flex flex-col items-center justify-center py-6">
			<div
				style={{
					backgroundColor: "var(--vscode-foreground)",
					WebkitMaskImage: `url('${imagesBaseUri}/roo-logo.svg')`,
					WebkitMaskRepeat: "no-repeat",
					WebkitMaskSize: "contain",
					maskImage: `url('${imagesBaseUri}/roo-logo.svg')`,
					maskRepeat: "no-repeat",
					maskSize: "contain",
					transition: "transform 0.2s ease-in-out",
				}}
				className="mx-auto hover:scale-105 transition-transform">
				<img src={imagesBaseUri + "/roo-logo.svg"} alt="Roo logo" className="h-10 opacity-0" />
			</div>
			<div className="mt-2 text-xs text-muted-foreground font-medium tracking-wide">ROO CODE</div>
		</div>
	)
}

export default RooHero
