/*
Swift Tree-Sitter Query Patterns

This file contains query patterns for Swift language constructs:
- class declarations - Captures class definitions
- protocol declarations - Captures protocol definitions
- method declarations - Captures methods in classes/structs/enums/extensions
- initializers - Captures init methods
- deinitializers - Captures deinit methods
- subscript declarations - Captures subscript methods
- property declarations - Captures properties in classes/structs/enums/extensions
- standalone function declarations - Captures top-level functions
- enum entries - Captures enum cases

Each query pattern is mapped to a specific test in parseSourceCodeDefinitions.swift.test.ts
*/
export default `
; Class declarations
(class_declaration
  name: (type_identifier) @name) @definition.class

; Protocol declarations
(protocol_declaration
  name: (type_identifier) @name) @definition.interface

; Method declarations in classes/structs/enums/extensions
(class_declaration
  (class_body
    (function_declaration
      name: (simple_identifier) @name)
  )
) @definition.method

; Initializers
(init_declaration
  "init" @name) @definition.initializer

; Deinitializers
(deinit_declaration
  "deinit" @name) @definition.deinitializer

; Subscript declarations
(subscript_declaration
  (parameter (simple_identifier) @name)) @definition.subscript

; Property declarations in classes/structs/enums/extensions
(class_declaration
  (class_body
    (property_declaration
      (pattern (simple_identifier) @name))
  )
) @definition.property

; Standalone property declarations
(property_declaration
  (pattern (simple_identifier) @name)) @definition.property

; Standalone function declarations
(function_declaration
  name: (simple_identifier) @name) @definition.function

; Type aliases are not supported by the current grammar

; Enum entries
(enum_class_body
  (enum_entry
    name: (simple_identifier) @name)) @definition.enum_entry
`
