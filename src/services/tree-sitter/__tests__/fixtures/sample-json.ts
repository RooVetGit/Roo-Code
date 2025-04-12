export default String.raw`{
  "test_object_with_primitives": {
    "test_string": "test value",
    "test_number": 42,
    "test_boolean": true,
    "test_null": null
  },
  "test_nested_objects": {
    "test_object": {
      "test_nested_string": "nested value",
      "test_nested_number": 123,
      "test_nested_boolean": false
    }
  },
  "test_deep_object": {
    "level1": {
      "level2": {
        "test_deep_value": "deep nested value"
      }
    }
  },
  "test_arrays": {
    "test_primitive_array": [1, 2, 3, 4, 5],
    "test_object_array": [
      {
        "id": 1,
        "name": "First Item",
        "active": true
      },
      {
        "id": 2,
        "name": "Second Item",
        "active": false
      }
    ],
    "test_mixed_array": [
      42,
      "string value",
      {"key": "value"},
      [1, 2, 3],
      null,
      true
    ]
  }
}`
