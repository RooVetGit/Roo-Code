/*
- class declarations (regular, data, abstract, sealed, enum, annotation)
- interface declarations
- function declarations (regular, suspend)
- object declarations (including companion objects)
*/
export default `
; Regular class declarations
(class_declaration
  (type_identifier) @name.definition.class
) @definition.class

; Data class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "data"))
  (type_identifier) @name.definition.data_class
) @definition.data_class

; Abstract class declarations
(class_declaration
  (modifiers
    (inheritance_modifier) @_modifier (#eq? @_modifier "abstract"))
  (type_identifier) @name.definition.abstract_class
) @definition.abstract_class

; Sealed class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "sealed"))
  (type_identifier) @name.definition.sealed_class
) @definition.sealed_class

; Enum class declarations
(class_declaration
  (type_identifier)
  (enum_class_body)
) @definition.enum_class

; Interface declarations
(class_declaration
  (type_identifier) @name.definition.interface
) @definition.interface

; Regular function declarations
(function_declaration
  (simple_identifier) @name.definition.function
) @definition.function


; Suspend function declarations
(function_declaration
  (modifiers
    (function_modifier) @_modifier (#eq? @_modifier "suspend"))
  (simple_identifier) @name.definition.suspend_function
) @definition.suspend_function

; Object declarations
(object_declaration
  (type_identifier) @name.definition.object
) @definition.object

; Companion object declarations
(companion_object) @definition.companion_object



; Annotation class declarations
(class_declaration
  (modifiers
    (class_modifier) @_modifier (#eq? @_modifier "annotation"))
  (type_identifier) @name.definition.annotation_class
) @definition.annotation_class
`
