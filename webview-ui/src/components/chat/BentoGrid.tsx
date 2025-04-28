import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useState, useEffect } from "react"
import { Trans as _Trans } from "react-i18next"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import RooHero from "@src/components/welcome/RooHero"
// Unused import but needed for UI rendering
import TelemetryBanner from "../common/TelemetryBanner"

interface TaskItem {
	id: string
	title: string
	date: string
	tokensIn: string
	tokensOut: string
	cost: string
}

interface BentoGridProps {
	tasks: any[]
	isExpanded: boolean
	toggleExpanded: () => void
	telemetrySetting: string
}

const BentoGrid = ({ telemetrySetting }: BentoGridProps) => {
	const _t = useAppTranslation()

	// Dummy tasks for demonstration
	const dummyTasks: TaskItem[] = [
		{
			title: "Please create a red fish game.",
			date: "Apr 26, 6:09 PM",
			tokensIn: "3.4k",
			tokensOut: "33.7k",
			cost: "$0.54",
			id: "dummy1",
		},
		{
			title: "Refactor the authentication module.",
			date: "Apr 26, 5:30 PM",
			tokensIn: "10.2k",
			tokensOut: "55.1k",
			cost: "$1.15",
			id: "dummy2",
		},
		{
			title: "Write unit tests for the API client.",
			date: "Apr 25, 11:15 AM",
			tokensIn: "5.8k",
			tokensOut: "21.9k",
			cost: "$0.38",
			id: "dummy3",
		},
	]

	// Feature cards with title and subtitle
	const featureCards = [
		{
			title: "Customizable Modes",
			subtitle: "Specialized personas with their own behaviors and assigned models",
			id: "feature1",
		},
		{
			title: "Smart Context",
			subtitle: "Automatically includes relevant files and code for better assistance",
			id: "feature2",
		},
		{
			title: "Integrated Tools",
			subtitle: "Access to file operations, terminal commands, and browser interactions",
			id: "feature3",
		},
	]

	// Agent quick start options
	const agents = [
		{
			name: "Code",
			emoji: "💻",
			description: "Write, edit, and improve your code",
			id: "agent1",
		},
		{
			name: "Debug",
			emoji: "🪲",
			description: "Find and fix issues in your code",
			id: "agent2",
		},
		{
			name: "Architect",
			emoji: "🏗️",
			description: "Design systems and plan implementations",
			id: "agent3",
		},
		{
			name: "Ask",
			emoji: "❓",
			description: "Get answers to your technical questions",
			id: "agent4",
		},
		{
			name: "Orchestrator",
			emoji: "🪃",
			description: "Coordinate complex tasks across modes",
			id: "agent5",
		},
	]

	return (
		<div className="flex-1 min-h-0 overflow-y-auto p-5">
			{/* Modern Bento Grid Layout */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Box 1: Logo Card */}
				<div className="col-span-full md:col-span-1 row-span-1 bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
					<div className="p-5 flex flex-col items-center justify-center h-full">
						<div className="flex items-center justify-center w-full">
							<RooHero />
						</div>
					</div>
				</div>

				{/* Box 2: Intro Text Card */}
				<div className="col-span-full md:col-span-2 row-span-1 bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
					<div className="p-5 flex flex-col items-start text-left h-full justify-center">
						<h2 className="text-lg font-bold mb-3 text-vscode-editor-foreground">About</h2>
						<p className="text-vscode-editor-foreground leading-relaxed text-sm mb-3">
							Your AI coding assistant with powerful tools and specialized modes.
						</p>
						<VSCodeButton
							onClick={() => window.open("https://docs.roocode.com/", "_blank", "noopener,noreferrer")}
							className="mt-2">
							Docs
						</VSCodeButton>
					</div>
				</div>

				{/* Box 3: Agents Quick Start Card */}
				<div className="col-span-full md:col-span-2 row-span-2 bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
					<div className="p-5 flex flex-col h-full">
						<h2 className="text-xs font-bold mb-4 text-vscode-descriptionForeground tracking-widest uppercase">
							Agents
						</h2>
						<p className="text-base mb-4 text-vscode-editor-foreground">Start a conversation with:</p>

						<div className="flex-1 overflow-y-auto">
							<div className="grid grid-cols-2 gap-2">
								{agents.map((agent) => (
									<div
										key={agent.id}
										className="flex items-center p-2 hover:bg-[var(--vscode-list-hoverBackground)] rounded cursor-pointer transition-colors duration-200">
										<span className="text-lg mr-2">{agent.emoji}</span>
										<div className="overflow-hidden">
											<h3 className="text-sm font-bold text-vscode-editor-foreground truncate">
												{agent.name}
											</h3>
											<p className="text-xs text-vscode-descriptionForeground truncate">
												{agent.description}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Box 4: Feature Carousel Card */}
				<div className="col-span-full md:col-span-1 row-span-1 bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
					<FeatureCarousel features={featureCards} />
				</div>

				{/* Box 6: Telemetry Banner (Conditional) */}
				{telemetrySetting === "unset" && (
					<div className="col-span-full bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
						<TelemetryBanner />
					</div>
				)}

				{/* Task Cards */}
				{dummyTasks.map((task) => (
					<TaskCard key={task.id} task={task} />
				))}
			</div>
		</div>
	)
}

// Helper component for task cards
const TaskCard = ({ task }: { task: TaskItem }) => {
	const [showCopySuccess, setShowCopySuccess] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard(1000)

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation()
		copyWithFeedback(task.title).then((success: boolean) => {
			if (success) {
				setShowCopySuccess(true)
				setTimeout(() => setShowCopySuccess(false), 1000)
			}
		})
	}

	return (
		<div className="col-span-full md:col-span-1 bg-[var(--vscode-editorWidget-background)] rounded-2xl overflow-hidden">
			<div className="p-5 relative flex flex-col justify-between h-full min-h-[140px]">
				{/* Copy Button */}
				<VSCodeButton
					appearance="icon"
					onClick={handleCopy}
					title="Copy Task"
					className="absolute top-3 right-3 text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors duration-200">
					<span className={`codicon ${showCopySuccess ? "codicon-check" : "codicon-copy"}`}></span>
				</VSCodeButton>

				{/* Content */}
				<div>
					<h3 className="text-xs font-bold mb-3 text-vscode-descriptionForeground tracking-widest uppercase">
						Recent Task
					</h3>
					<p className="text-base font-bold mb-2 text-vscode-editor-foreground leading-tight">{task.title}</p>
				</div>

				{/* Footer */}
				<div className="flex justify-between items-center text-xs text-vscode-descriptionForeground mt-auto pt-3 border-t border-[var(--vscode-panel-border)]">
					<span>{task.date}</span>
					<div className="flex gap-3">
						<span className="flex items-center">
							<span className="codicon codicon-arrow-up text-xs mr-1"></span>
							{task.tokensIn}
						</span>
						<span className="flex items-center">
							<span className="codicon codicon-arrow-down text-xs mr-1"></span>
							{task.tokensOut}
						</span>
						<span className="font-medium">{task.cost}</span>
					</div>
				</div>
			</div>
		</div>
	)
}

// Carousel component for features
const FeatureCarousel = ({ features }: { features: { title: string; subtitle: string; id: string }[] }) => {
	const [currentIndex, setCurrentIndex] = useState(0)

	// Auto-advance the carousel every 5 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % features.length)
		}, 5000)

		return () => clearInterval(interval)
	}, [features.length])

	const nextSlide = () => {
		setCurrentIndex((prevIndex) => (prevIndex + 1) % features.length)
	}

	const prevSlide = () => {
		setCurrentIndex((prevIndex) => (prevIndex - 1 + features.length) % features.length)
	}

	return (
		<div className="p-5 flex flex-col h-full relative">
			<h2 className="text-xs font-bold mb-4 text-vscode-descriptionForeground tracking-widest uppercase">
				Features
			</h2>

			<div className="flex-1 flex flex-col justify-center">
				<div className="transition-opacity duration-300 min-h-[100px]">
					<h3 className="text-lg font-bold mb-2 text-vscode-editor-foreground">
						{features[currentIndex].title}
					</h3>
					<p className="text-sm text-vscode-descriptionForeground">{features[currentIndex].subtitle}</p>
				</div>
			</div>

			<div className="flex justify-between mt-4">
				<button
					onClick={prevSlide}
					className="text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors duration-200">
					<span className="codicon codicon-chevron-left"></span>
				</button>

				<div className="flex gap-2">
					{features.map((_, index) => (
						<span
							key={index}
							className={`h-1.5 w-1.5 rounded-full ${index === currentIndex ? "bg-vscode-foreground" : "bg-vscode-descriptionForeground opacity-50"}`}></span>
					))}
				</div>

				<button
					onClick={nextSlide}
					className="text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors duration-200">
					<span className="codicon codicon-chevron-right"></span>
				</button>
			</div>
		</div>
	)
}

export default BentoGrid
