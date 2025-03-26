/**
 * Tree-sitter Query for TSX Files
 *
 * This query captures various TypeScript and React component definitions in TSX files.
 *
 * TSX COMPONENT STRUCTURE:
 *
 * 1. React Function Component (Function Declaration):
 *    ```tsx
 *    function MyComponent(): JSX.Element {
 *      return <div>...</div>;
 *    }
 *    ```
 *    Tree Structure:
 *    - function_declaration
 *      - name: identifier ("MyComponent")
 *      - return_type: type_annotation
 *        - type_identifier ("JSX.Element") or generic_type
 *      - body: statement_block
 *
 * 2. React Function Component (Arrow Function):
 *    ```tsx
 *    const MyComponent = (): JSX.Element => {
 *      return <div>...</div>;
 *    }
 *    ```
 *    Tree Structure:
 *    - variable_declaration
 *      - variable_declarator
 *        - name: identifier ("MyComponent")
 *        - value: arrow_function
 *          - return_type: type_annotation
 *            - type_identifier or generic_type
 *
 * 3. React Function Component (Exported Arrow Function):
 *    ```tsx
 *    export const MyComponent = ({ prop1, prop2 }) => {
 *      return <div>...</div>;
 *    }
 *    ```
 *    Tree Structure:
 *    - export_statement
 *      - variable_declaration
 *        - variable_declarator
 *          - name: identifier ("MyComponent")
 *          - value: arrow_function
 *
 * 4. React Class Component:
 *    ```tsx
 *    class MyComponent extends React.Component {
 *      render() {
 *        return <div>...</div>;
 *      }
 *    }
 *    ```
 *    Tree Structure:
 *    - class_declaration
 *      - name: type_identifier ("MyComponent")
 *      - class_heritage
 *        - extends_clause
 *          - member_expression ("React.Component")
 *
 * IMPORTANT NOTES:
 * - Field names like "superclass" or "extends" don't exist in the TSX grammar
 * - Use direct node matching instead of field names when possible
 * - Simpler patterns are more robust and less prone to errors
 */
export default `
; React Function Components
(function_declaration
  name: (identifier) @name.definition.function
  return_type: (type_annotation)
  body: (statement_block)) @definition.react_component

(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: (arrow_function))) @definition.react_component

; React Class Components - matching tree structure from debug output
(class_declaration
  name: (type_identifier) @name.definition.class
  (class_heritage
    (extends_clause
      (member_expression) @react_base))) @definition.react_component
  (#match? @react_base "^React\\.Component$")

; Functions and Methods
(arrow_function) @definition.lambda

(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Tests
(call_expression
  function: (identifier) @func_name
  arguments: (arguments
    (string) @name
    [(arrow_function) (function_expression)]) @definition.test)
  (#match? @func_name "^(describe|test|it)$")

(assignment_expression
  left: (member_expression
    object: (identifier) @obj
    property: (property_identifier) @prop)
  right: [(arrow_function) (function_expression)]) @definition.test
  (#eq? @obj "exports")
  (#eq? @prop "test")

; JSX Widget Definitions - captures complete widget components
(jsx_element
  (jsx_opening_element
    name: (identifier) @_widget_name)
  (_)*  ; Match any content between tags
  (jsx_closing_element)) @definition.widget
  ; Only capture widget components (start with capital letter)
  (#match? @_widget_name "^[A-Z]")
`
