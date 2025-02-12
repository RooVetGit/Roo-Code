import { ChatHandler, SuggestedQuestionsData } from "../types"

type SuggestedQuestionsProps = {
	questions: SuggestedQuestionsData
	append: ChatHandler["append"]
}

export function SuggestedQuestions({ questions, append }: SuggestedQuestionsProps) {
	return questions.length > 0 ? (
		<div className="flex flex-col space-y-2">
			{questions.map((question, index) => (
				// eslint-disable-next-line jsx-a11y/anchor-is-valid
				<a
					key={index}
					onClick={() => {
						append({ role: "user", content: question })
					}}
					className="cursor-pointer text-sm italic hover:underline">
					{"->"} {question}
				</a>
			))}
		</div>
	) : null
}
