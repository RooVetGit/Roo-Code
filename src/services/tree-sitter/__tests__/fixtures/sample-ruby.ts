export default String.raw`
# Testing class definition with inheritance
class TestClassDefinition < ApplicationRecord
  # Testing class variables
  @@test_class_variable = 0
  
  # Testing constant definitions
  TEST_CONSTANT_ONE = 'test_constant_1'
  TEST_CONSTANT_TWO = 'test_constant_2'

  # Testing method definitions
  def test_method
    puts "test method"
  end

  # Testing method definitions with parameters
  # Testing instance method with parameters
  def test_instance_method(test_param1, test_param2 = nil)
    @test_instance_variable = test_param1
    test_param2 ||= "default"
    test_rest_params.each { |param| puts param }
  end

  # Testing class method definition
  def self.test_class_method
    @@test_class_variable += 1
  end

  private

  def test_private_helper
    puts "Private helper called"
    generate_random_token
    handle_data_processing
  end
end

# Testing module with included/extended hooks
module TestModuleDefinition
  def self.included(test_base)
    test_base.extend(TestClassMethods)
  end

  def self.extended(test_base)
    test_base.include(TestInstanceMethods)
  end

  module TestClassMethods
    def test_extended_method
      'extended'
    end
  end

  module TestInstanceMethods
    def test_included_method
      'included'
    end
  end
end

# Testing singleton class pattern
class TestSingletonClass
  @@test_singleton_instance = nil
  private_class_method :new

  def self.instance
    @@test_singleton_instance ||= new
  end

  def test_singleton_operation
    'singleton operation'
  end

  private

  def handle_singleton_task
    'handle task'
  end
end

# Testing mixin module
module TestMixinModule
  def test_mixin_method(message)
    "Mixin method: #{message}"
  end
end

# Testing include
class TestIncludeClass
  include TestMixinModule

  def initialize(name)
    @name = name
  end
end

# Testing extend
class TestExtendClass
  extend TestMixinModule

  def self.test_extend_method
    'Extended method'
  end
end

# Testing prepend
class TestPrependClass
  prepend TestMixinModule

  def test_mixin_method(message)
    "Overridden method: #{message}"
  end
end

# Testing blocks and procs
def test_block_method(data)
  yield(data) if block_given?
end

test_lambda = ->(x, y) {
  x + y
}

test_proc = Proc.new do |x|
  x * 2
end

# Testing splat operator
def test_splat_method(*numbers)
  numbers.sum
end

# Testing hash syntax
test_hash = {
  key1: 'value1',
  key2: 'value2',
  'key3' => 'value3',
  :key4 => 'value4'
}

# Testing string interpolation
test_string = "Value is #{test_hash[:key1]}"

# Testing regular expressions
test_pattern = /^test_\w+$/
test_match = "test_pattern" =~ test_pattern

# Testing exception handling
begin
  raise "Test error"
rescue StandardError => e
  puts e.message
ensure
  puts "Cleanup"
end

# Testing attribute accessors class
class TestAttributeAccessorsClass
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor

  def initialize(title, content)
    @test_attr_reader = title
    @test_attr_writer = content
  end
end

# Testing keyword arguments
def test_keyword_args_method(host:, port: 80, protocol: 'http')
  "#{protocol}://#{host}:#{port}"
end

# Testing class macros (Rails-like)
class TestClassMacroClass < ApplicationRecord
  has_many :test_associations
  belongs_to :test_parent
end

# Testing metaprogramming
class TestMetaprogrammingClass
  [:test_meta_save, :test_meta_update, :test_meta_delete].each do |method_name|
    define_method(method_name) do |*args|
      "#{method_name} called with #{args}"
    end
  end

  def method_missing(method_name, *args, &block)
    "Method #{method_name} not found"
  end
end

# Testing Ruby 3.0+ pattern matching
case test_pattern_data
in [Integer => x, String => y]
  "Found #{x} and #{y}"
in { id: Integer => id }
  "Found id #{id}"
in String => str
  "Found string #{str}"
else
  "No match"
end

# Testing Ruby 3.1+ pin operator
case test_pin_input
in ^test_pattern
  "Matched pattern"
in String => str
  "Found string #{str}"
end
# Testing module with included/extended hooks
module TestModuleDefinition
  def self.included(test_base)
    test_base.extend(TestClassMethods)
  end

  def self.extended(test_base)
    test_base.include(TestInstanceMethods)
  end

  module TestClassMethods
    def test_extended_method
      'extended'
    end
  end

  module TestInstanceMethods
    def test_included_method
      'included'
    end
  end
end

# Testing singleton class pattern
class TestSingletonClass
  @@test_singleton_instance = nil
  private_class_method :new

  def self.instance
    @@test_singleton_instance ||= new
  end

  def test_singleton_operation
    'singleton operation'
  end

  private

  def handle_singleton_task
    'handle task'
  end
end

# Testing mixin module
module TestMixinModule
  def test_mixin_method(message)
    "Mixin method: #{message}"
  end
end

# Testing include
class TestIncludeClass
  include TestMixinModule

  def initialize(name)
    @name = name
  end
end

# Testing extend
class TestExtendClass
  extend TestMixinModule

  def self.test_extend_method
    'Extended method'
  end
end

# Testing prepend
class TestPrependClass
  prepend TestMixinModule

  def test_mixin_method(message)
    "Overridden method: #{message}"
  end
end

# Testing blocks and procs
def test_block_method(data)
  yield(data) if block_given?
end

test_lambda = ->(x, y) {
  x + y
}

test_proc = Proc.new do |x|
  x * 2
end

# Testing splat operator
def test_splat_method(*numbers)
  numbers.sum
end

# Testing hash syntax
test_hash = {
  key1: 'value1',
  key2: 'value2',
  'key3' => 'value3',
  :key4 => 'value4'
}

# Testing string interpolation
test_string = "Value is #{test_hash[:key1]}"

# Testing regular expressions
test_pattern = /^test_\w+$/
test_match = "test_pattern" =~ test_pattern

# Testing exception handling
begin
  raise "Test error"
rescue StandardError => e
  puts e.message
ensure
  puts "Cleanup"
end

# Testing attribute accessors class
# Testing attribute accessors
class TestAttributeAccessorsClass
  # Define attribute accessors in order: reader, writer, accessor
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor

  def initialize(title, content)
    @test_attr_reader = title
    @test_attr_writer = content
    @test_attr_accessor = nil
  end

  # Additional methods to demonstrate usage
  def test_method
    @test_attr_writer = "new value"
    @test_attr_accessor = "accessed"
  end

  # Ensure all accessors are defined
  def test_accessors
    puts test_attr_reader
    self.test_attr_writer = "write"
    self.test_attr_accessor = "access"
  end
end

# Testing attribute accessors with single line definitions
class TestAttributeAccessorsClass2
  # Define all three types of accessors
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor

  def initialize
    @test_attr_reader = "read"
    @test_attr_writer = "write"
    @test_attr_accessor = "access"
  end
end

# Testing attribute accessors with minimal definitions
class TestAttributeAccessorsClass3
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor
end

# Testing attribute accessors with single line definitions
class TestAttributeAccessorsClass4
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor
end

# Testing attribute accessors with single line definitions
class TestAttributeAccessorsClass5
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor
end

# Testing keyword arguments
def test_keyword_args_method(host:, port: 80, protocol: 'http')
  "#{protocol}://#{host}:#{port}"
end

# Testing class macros (Rails-like)
class TestClassMacroClass < ApplicationRecord
  has_many :test_associations
  belongs_to :test_parent
end

# Testing metaprogramming
class TestMetaprogrammingClass
  [:test_meta_save, :test_meta_update, :test_meta_delete].each do |method_name|
    define_method(method_name) do |*args|
      "#{method_name} called with #{args}"
    end
  end

  def method_missing(method_name, *args, &block)
    "Method #{method_name} not found"
  end
end

# Testing Ruby 3.0+ pattern matching
case test_pattern_data
in [Integer => x, String => y]
  "Found #{x} and #{y}"
in { id: Integer => id }
  "Found id #{id}"
in String => str
  "Found string #{str}"
else
  "No match"
end

# Testing Ruby 3.1+ pin operator
case test_pin_input
in ^test_pattern
  "Matched pattern"
in String => str
  "Found string #{str}"
end
# Testing module definition with methods
module TestModuleDefinition
  def test_module_method
    TEST_CONSTANT_ONE
  end

  def test_module_method_with_block(&test_block)
    test_block.call if test_block
  end
end

# Testing singleton class definition
class TestSingletonClass
  private_class_method :new
  @@test_instance = nil

  def self.test_instance
    @@test_instance ||= new
  end

  def test_singleton_method
    'singleton operation'
  end

  private

  private

  def test_private_method
    'private method'
  end
end

# Testing mixin module definition
module TestMixinModule
  def test_mixin_method
    'mixin method'
  end
end

# Testing class with mixin
class TestMixinClass
  include TestMixinModule
    @name = name
  end
end

# Testing extend
class TestExtendClass
  extend TestMixinModule

  def self.test_extend_method
    'Extended method'
  end
end

# Testing prepend
class TestPrependClass
  prepend TestMixinModule

  def test_mixin_method(message)
    "Overridden method: #{message}"
  end
end

# Testing blocks and procs
def test_block_method(data)
  yield(data) if block_given?
end

test_lambda = ->(x, y) {
  x + y
}

test_proc = Proc.new do |x|
  x * 2
end

# Testing splat operator
def test_splat_method(*numbers)
  numbers.sum
end

# Testing hash syntax
test_hash = {
  key1: 'value1',
  key2: 'value2',
  'key3' => 'value3',
  :key4 => 'value4'
}

# Testing string interpolation
test_string = "Value is #{test_hash[:key1]}"

# Testing regular expressions
test_pattern = /^test_\w+$/
test_match = "test_pattern" =~ test_pattern

# Testing exception handling
begin
  raise "Test error"
rescue StandardError => e
  puts e.message
ensure
  puts "Cleanup"
end

# Testing attribute accessors class
class TestAttributeAccessorsClass
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor

  def initialize(title, content)
    @test_attr_reader = title
    @test_attr_writer = content
  end
end

# Testing keyword arguments
def test_keyword_args_method(host:, port: 80, protocol: 'http')
  "#{protocol}://#{host}:#{port}"
end

# Testing class macros (Rails-like)
class TestClassMacroClass < ApplicationRecord
  has_many :test_associations
  belongs_to :test_parent
end

# Testing metaprogramming
class TestMetaprogrammingClass
  [:test_meta_save, :test_meta_update, :test_meta_delete].each do |method_name|
    define_method(method_name) do |*args|
      "#{method_name} called with #{args}"
    end
  end

  def method_missing(method_name, *args, &block)
    "Method #{method_name} not found"
  end
end

# Testing Ruby 3.0+ pattern matching
case test_pattern_data
in [Integer => x, String => y]
  "Found #{x} and #{y}"
in { id: Integer => id }
  "Found id #{id}"
in String => str
  "Found string #{str}"
else
  "No match"
end

# Testing Ruby 3.1+ pin operator
case test_pin_input
in ^test_pattern
  "Matched pattern"
in String => str
  "Found string #{str}"
end
# Testing singleton class pattern
class TestSingletonClass
  @@test_singleton_instance = nil
  private_class_method :new

  def self.instance
    @@test_singleton_instance ||= new
  end
end

# Testing module with included/extended hooks
module TestModuleDefinition
  def self.included(test_base)
    test_base.extend(TestClassMethods)
  end

  def self.extended(test_base)
    test_base.include(TestInstanceMethods)
  end

  module TestClassMethods
    def test_extended_method
      'extended'
    end
  end

  module TestInstanceMethods
    def test_included_method
      'included'
    end
  end
end

# Testing module with included/extended hooks
module TestModule
  def self.included(test_base)
    test_base.extend(TestClassMethods)
  end

  def self.extended(test_base)
    test_base.include(TestInstanceMethods)
  end

  # Testing module constants and methods
  TEST_MODULE_CONSTANT = '1.0.0'
  TEST_MODULE_VERSION = '2.0.0'

  def self.test_module_method
    puts "Module method called"
    TEST_MODULE_VERSION
  end

  # Testing nested modules
  module TestClassMethods
    def test_extended_method
      puts "Extended method called"
      'extended'
    end
  end

  module TestInstanceMethods
    def test_included_method
      puts "Included method called"
      'included'
    end
  end
end

# Testing singleton class pattern
class TestSingletonClass
  @@test_singleton_instance = nil
  private_class_method :new

  # Testing class methods and instance management
  def self.instance
    @@test_singleton_instance ||= new
    @@test_singleton_instance
  end

  def test_singleton_operation
    puts "Singleton operation called"
    handle_singleton_task
    true
  end

  private

  def handle_singleton_task
    puts "Processing singleton task"
    generate_task_result
  end
end
end

# MIXIN MODULE - testing mixins
# This section tests the parser's ability to capture mixins
module TestMixinModule
  def test_mixin_method(message)
    puts "[#{self.class}] #{message}"
    return true
  end
end

# INCLUDE MIXIN - testing include
# This section tests the parser's ability to capture include statements
class TestIncludeClass
  include TestMixinModule
  
  def initialize(name)
    @test_include_var = name
    test_mixin_method("Include test #{name}")
  end
end

# EXTEND MIXIN - testing extend
# This section tests the parser's ability to capture extend statements
class TestExtendClass
  extend TestMixinModule
  
  def self.test_extend_method
    test_mixin_method("Extend test")
    return true
  end
end

# PREPEND MIXIN - testing prepend
# This section tests the parser's ability to capture prepend statements
class TestPrependClass
  prepend TestMixinModule
  
  def test_mixin_method(message)
    puts "Original method: #{message}"
    return false
  end
end

# BLOCKS - testing blocks
# This section tests the parser's ability to capture blocks
def test_block_method(data)
  yield(data) if block_given?
  puts "Block executed"
  return data
end

# Lambda expression - testing lambda
test_lambda = ->(x, y) {
  result = x * y
  puts "Lambda result: #{result}"
  return result
}

# Proc object - testing proc
test_proc = Proc.new do |x|
  puts x
  puts "Proc executed"
  return x
end

# SPLAT OPERATOR - testing splat
# This section tests the parser's ability to capture splat operators
def test_splat_method(*numbers)
  sum = numbers.sum
  puts "Sum: #{sum}"
  return sum
end

# HASH SYNTAX - testing hash syntax
# This section tests the parser's ability to capture different hash syntaxes
test_hash = {
  test_symbol_key: '12345',
  'test_string_key' => 'api.example.com',
  :test_old_symbol_key => 443
}

# STRING INTERPOLATION - testing string interpolation
# This section tests the parser's ability to capture string interpolation
test_string_var = "world"
test_string_interpolation = "Hello, #{test_string_var}!"
puts test_string_interpolation
puts "Another #{test_string_var} example"

# REGULAR EXPRESSION - testing regex
# This section tests the parser's ability to capture regular expressions
test_regex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$/
test_email = "test@example.com"
if test_email =~ test_regex
  puts "Valid email"
end

# EXCEPTION HANDLING - testing begin/rescue/ensure
# This section tests the parser's ability to capture exception handling
begin
  # Some code that might raise an exception
  test_exception_result = 10 / 0
rescue ZeroDivisionError => e
  puts "Error: #{e.message}"
ensure
  puts "This always runs"
end

# ATTRIBUTE ACCESSORS - testing attribute accessors
# This section tests the parser's ability to capture attribute accessors
class TestAttributeAccessorsClass
  attr_reader :test_attr_reader
  attr_writer :test_attr_writer
  attr_accessor :test_attr_accessor
  
  def initialize(title, content)
    @test_attr_reader = title
    @test_attr_writer = content
    @test_attr_accessor = false
  end
end

# KEYWORD ARGUMENTS - testing keyword arguments
# This section tests the parser's ability to capture keyword arguments
def test_keyword_args_method(host:, port: 80, protocol: 'http')
  url = "#{protocol}://#{host}:#{port}"
  puts "URL: #{url}"
  return url
end

# CLASS MACROS - testing class macros
# This section tests the parser's ability to capture Rails-like class macros
class TestClassMacroClass < ApplicationRecord
  belongs_to :test_belongs_to
  has_many :test_has_many
  validates :test_validates, presence: true
  scope :test_scope, -> { where(active: true) }
end

# METAPROGRAMMING - testing metaprogramming
# This section tests the parser's ability to capture metaprogramming constructs
class TestMetaprogrammingClass
  [:test_meta_save, :test_meta_update, :test_meta_delete].each do |method_name|
    define_method(method_name) do |*args|
      puts "Called #{method_name} with #{args.inspect}"
      return true
    end
  end
  
  def method_missing(method_name, *args, &block)
    puts "Called undefined method #{method_name}"
    return nil
  end
end

# PATTERN MATCHING - testing pattern matching
# This section tests the parser's ability to capture Ruby 2.7+ pattern matching
test_pattern_data = {name: "TestPatternName", age: 25}
case test_pattern_data
in {name: "TestPatternName", age: age} if age > 18
  puts "Adult TestPatternName"
  result = "adult"
in {name: "TestPatternName2", age: age}
  puts "TestPatternName2 is #{age}"
  result = "other"
else
  puts "Unknown pattern"
  result = "unknown"
end

# ENDLESS METHOD - testing endless methods
# This section tests the parser's ability to capture Ruby 3.0+ endless methods
def test_endless_method(x) = x * x

# PIN OPERATOR - testing pin operator
# This section tests the parser's ability to capture Ruby 3.1+ pin operator
test_pin_pattern = 42
case test_pin_input
in ^test_pin_pattern
  puts "Matches 42"
  result = "match"
else
  puts "No match"
  result = "no_match"
end

# SHORTHAND HASH - testing shorthand hash
# This section tests the parser's ability to capture Ruby 3.1+ shorthand hash syntax
def test_shorthand_hash(user:)
  {user:}
end`
