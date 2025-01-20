// VSCode WebView UI Toolkitのモックコンポーネント
export const VSCodeButton = 'vscode-button'
export const VSCodeTextArea = 'vscode-textarea'
export const VSCodeDropdown = 'vscode-dropdown'
export const VSCodeOption = 'vscode-option'
export const VSCodeTextField = 'vscode-textfield'
export const VSCodeRadioGroup = 'vscode-radio-group'
export const VSCodeRadio = 'vscode-radio'
export const VSCodeCheckbox = 'vscode-checkbox'
export const VSCodeLink = 'vscode-link'

// カスタム要素のインターフェース
interface VSCodeCustomElement extends HTMLElement {
  checked: boolean
  value: string
  disabled: boolean
}

// カスタム要素として登録
if (typeof window !== 'undefined') {
  const components = {
    VSCodeButton,
    VSCodeTextArea,
    VSCodeDropdown,
    VSCodeOption,
    VSCodeTextField,
    VSCodeRadioGroup,
    VSCodeRadio,
    VSCodeCheckbox,
    VSCodeLink,
  }

  Object.entries(components).forEach(([_name, tag]) => {
    if (!customElements.get(tag)) {
      class VSCodeElement extends HTMLElement implements VSCodeCustomElement {
        private shadow: ShadowRoot

        constructor() {
          super()
          this.shadow = this.attachShadow({ mode: 'open' })
        }

        static get observedAttributes(): string[] {
          return ['checked', 'value', 'disabled']
        }

        get checked(): boolean {
          return this.hasAttribute('checked')
        }

        set checked(value: boolean) {
          if (value) {
            this.setAttribute('checked', '')
          } else {
            this.removeAttribute('checked')
          }
        }

        get value(): string {
          return this.getAttribute('value') || ''
        }

        set value(value: string) {
          this.setAttribute('value', value)
        }

        get disabled(): boolean {
          return this.hasAttribute('disabled')
        }

        set disabled(value: boolean) {
          if (value) {
            this.setAttribute('disabled', '')
          } else {
            this.removeAttribute('disabled')
          }
        }

        connectedCallback(): void {
          if (this.shadow) {
            this.shadow.innerHTML = `<slot></slot>`
          }
        }

        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
          if (oldValue !== newValue) {
            this.dispatchEvent(new CustomEvent('change'))
          }
        }
      }

      customElements.define(tag, VSCodeElement)
    }
  })
}

// テスト用のヘルパー関数
export function createMockVSCodeElement(tag: string): VSCodeCustomElement {
  if (typeof window !== 'undefined') {
    return document.createElement(tag) as VSCodeCustomElement
  }
  throw new Error('Cannot create mock element outside of browser environment')
}