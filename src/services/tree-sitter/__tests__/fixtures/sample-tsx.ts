// Sample TSX content for testing tree-sitter parsing
export default String.raw`
interface VSCodeCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export const VSCodeCheckbox: React.FC<VSCodeCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled
}) => {
  return <div>Checkbox</div>
}

interface TemperatureControlProps {
  isCustomTemperature: boolean
  setIsCustomTemperature: (value: boolean) => void
  inputValue: number | null
  setInputValue: (value: number | null) => void
  value?: number
  maxValue: number
}

const TemperatureControl = ({
  isCustomTemperature,
  setIsCustomTemperature,
  inputValue,
  setInputValue,
  value,
  maxValue
}: TemperatureControlProps) => {
  return (
    <>
      <VSCodeCheckbox
        checked={isCustomTemperature}
        onChange={(e) => {
          setIsCustomTemperature(e.target.checked)
          if (!e.target.checked) {
            setInputValue(null)
          } else {
            setInputValue(value ?? 0)
          }
        }}>
        <label>Use Custom Temperature</label>
      </VSCodeCheckbox>

      <Slider
        min={0}
        max={maxValue}
        value={[inputValue ?? 0]}
        onValueChange={([value]) => setInputValue(value)}
      />
    </>
  )
}
`
