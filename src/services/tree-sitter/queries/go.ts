/*
Go Tree-Sitter Query Patterns
*/
export default `
; Package declarations
(package_clause
  (package_identifier) @name.definition.package)

; Import declarations
(import_declaration
  (import_spec_list
    (import_spec path: (_) @name.definition.import)))

; Const declarations
(const_declaration
  (const_spec name: (identifier) @name.definition.const))

; Var declarations
(var_declaration
  (var_spec name: (identifier) @name.definition.var))

; Interface declarations
(type_declaration
  (type_spec
    name: (type_identifier) @name.definition.interface
    type: (interface_type)))

; Struct declarations
(type_declaration
  (type_spec
    name: (type_identifier) @name.definition.struct
    type: (struct_type)))

; Type declarations
(type_declaration
  (type_spec
    name: (type_identifier) @name.definition.type))

; Function declarations
(function_declaration
  name: (identifier) @name.definition.function)

; Method declarations
(method_declaration
  name: (field_identifier) @name.definition.method)

; Functions containing goroutines (instead of capturing go statements)
(function_declaration
  name: (identifier) @name.definition.function
  body: (block
    (go_statement))) @definition.goroutine_function

; Functions containing defer statements
(function_declaration
  name: (identifier) @name.definition.function
  body: (block
    (defer_statement))) @definition.defer_function

; Functions containing select statements
(function_declaration
  name: (identifier) @name.definition.function
  body: (block
    (select_statement))) @definition.select_function

; Functions with channel parameters or operations
(function_declaration
  name: (identifier) @name.definition.function
  parameters: (parameter_list
    (parameter_declaration
      type: (channel_type)))) @definition.channel_function
`
