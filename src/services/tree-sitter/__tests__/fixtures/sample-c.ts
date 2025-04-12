export default String.raw`
// ===== STRUCT DEFINITIONS =====

// Testing basic struct with fields
struct TestBasicStruct {
    int test_field_int;
    char test_field_char[20];
    float test_field_float;
    double test_field_double;
};

// Testing nested struct definition
struct TestNestedStruct {
    char test_outer_name[50];
    int test_outer_id;
    struct {
        char test_inner_street[100];
        char test_inner_city[50];
        int test_inner_zip;
        float test_inner_coords[2];
    } test_address;
};

// Testing struct with bit fields
struct TestBitFieldStruct {
    unsigned int test_flag1 : 1;
    unsigned int test_flag2 : 1;
    unsigned int test_value : 6;
    unsigned int test_reserved : 24;
};

// Testing struct with function pointer
struct TestCallbackStruct {
    void (*test_callback)(const char* message);
    int test_priority;
    char test_name[32];
    void (*test_error_handler)(int code);
};

// ===== FUNCTION DEFINITIONS =====

// Testing basic function definition
int test_basic_function(
    int test_param1,
    char* test_param2,
    float test_param3,
    double test_param4
) {
    int result = test_param1;
    return result;
}

// Testing function with array parameters
void test_array_function(
    int test_numbers[],
    char test_chars[50],
    float test_matrix[4][4],
    int test_size
) {
    for (int i = 0; i < test_size; i++) {
        test_numbers[i] *= 2;
    }
}

// Testing function with pointer parameters
void test_pointer_function(
    int* test_ptr1,
    char** test_ptr2,
    struct TestBasicStruct* test_ptr3,
    void (*test_callback)(void*)
) {
    if (test_ptr1 && test_ptr3) {
        test_ptr3->test_field_int = *test_ptr1;
    }
}

// Testing variadic function
#include <stdarg.h>
int test_variadic_function(
    int test_count,
    const char* test_format,
    ...
) {
    va_list args;
    va_start(args, test_format);
    int sum = 0;
    for (int i = 0; i < test_count; i++) {
        sum += va_arg(args, int);
    }
    va_end(args);
    return sum;
}

// ===== ENUM DEFINITIONS =====

// Testing basic enum definition
enum TestBasicEnum {
    TEST_ENUM_FIRST,
    TEST_ENUM_SECOND,
    TEST_ENUM_THIRD,
    TEST_ENUM_FOURTH
};

// Testing enum with explicit values
enum TestValuedEnum {
    TEST_VALUED_ONE = 1,
    TEST_VALUED_TEN = 10,
    TEST_VALUED_HUNDRED = 100,
    TEST_VALUED_THOUSAND = 1000
};

// ===== TYPEDEF DECLARATIONS =====

// Testing typedef for struct
typedef struct {
    double test_x;
    double test_y;
    double test_z;
    char test_label[32];
} TestTypedefStruct;

// Testing typedef for function pointer
typedef void (*TestTypedefCallback)(
    int test_code,
    const char* test_message,
    void* test_data
);

// ===== C11 FEATURES =====

// Testing anonymous union in struct
struct TestAnonymousUnion {
    int test_id;
    struct {
        union {
            struct {
                unsigned char test_blue;
                unsigned char test_green;
                unsigned char test_red;
                unsigned char test_alpha;
            };
            unsigned int test_color;
        };
    };
};

// Testing struct with alignment
struct TestAlignedStruct {
    char test_char;
    _Alignas(8) int test_aligned_int;
    double test_double;
    _Alignas(16) float test_aligned_float;
};`
