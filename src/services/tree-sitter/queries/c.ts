/*
C Language Constructs Supported by Tree-Sitter Parser:

1. Class-like Constructs:
- struct definitions
- union definitions (not fully functional)
- enum definitions

2. Function-related Constructs:
- function definitions
- function declarations

3. Type Definitions:
- typedef declarations (struct only)

4. Preprocessor Constructs:
- complex macro definitions (not simple macros)

5. C11 Features:
- anonymous union structs
- alignas structs
*/
export default `
; Struct definitions
(struct_specifier name: (type_identifier) @name.definition.class body:(_)) @definition.class

; Union definitions
(declaration type: (union_specifier name: (type_identifier) @name.definition.class)) @definition.class

; Function definitions
(function_definition
  type: (_)
  declarator: (function_declarator declarator: (identifier) @name.definition.function)) @definition.function

; Function declarations
(function_declarator declarator: (identifier) @name.definition.function) @definition.function

; Typedef declarations
(type_definition declarator: (type_identifier) @name.definition.type) @definition.type

; Enum definitions
(enum_specifier name: (type_identifier) @name.definition.enum) @definition.enum

; Field declarations in structs
(field_declaration
  type: (_)
  declarator: (field_identifier) @name.definition.field) @definition.field
`
