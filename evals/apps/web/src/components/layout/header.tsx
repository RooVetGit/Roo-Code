"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { HoppingLogo } from "./logo"
import { Button } from "@/components/ui"

export const Header = () => {
	const { theme, setTheme } = useTheme()

	return (
		<div className="flex items-center justify-between border-b px-12 py-6">
			<div className="flex items-center gap-4">
				<HoppingLogo />
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
					className="ml-4">
					{theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
				</Button>
			</div>
			{/* Right side of header kept empty to avoid overlapping with the rocket button */}
			<div></div>
		</div>
	)
}
