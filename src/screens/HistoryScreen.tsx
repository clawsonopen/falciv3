e ctor/dtor,
// and SetUp()/TearDown() work correctly in type-parameterized tests.

template <typename T>
class DerivedTest : public CommonTest<T> {};

TYPED_TEST_SUITE_P(DerivedTest);

TYPED_TEST_P(DerivedTest, ValuesAreCorrect) {
  // Static members of the fixture class template can be visited via
  // the TestFixture:: prefix.
  EXPECT_EQ(5, *TestFixture::shared_);

  // Non-static members of the fixture class must be visited via
  // 'this', as required by C++ for class templates.
  EXPECT_EQ(2, this->value_);
}

// The second test makes sure shared_ is not deleted after the first
// test.
TYPED_TEST_P(DerivedTest, ValuesAreStillCorrect) {
  // Static members of the fixture class template can also be visited
  // via 'this'.
  ASSERT_TRUE(this->shared_ != nullptr);
  EXPECT_EQ(5, *this->shared_);
  EXPECT_EQ(2, this->value_);
}

REGISTER_TYPED_TEST_SUITE_P(DerivedTest, ValuesAreCorrect,
                            ValuesAreStillCorrect);

typedef Types<short, long> MyTwoTypes;
INSTANTIATE_TYPED_TEST_SUITE_P(My, DerivedTest, MyTwoTypes);

// Tests that custom names work with type parametrized tests. We reuse the
// TwoTypes from above here.
template <typename T>
class TypeParametrizedTestWithNames : public Test {};

TYPED_TEST_SUITE_P(TypeParametrizedTestWithNames);

TYPED_TEST_P(TypeParametrizedTestWithNames, TestSuiteName) {
  if (std::is_same<TypeParam, char>::value) {
    EXPECT_STREQ(::testing::UnitTest::GetInstance()
                     ->current_test_info()
                     ->test_suite_name(),
                 "CustomName/TypeParametrizedTestWithNames/parChar0");
  }
  if (std::is_same<TypeParam, int>::value) {
    EXPECT_STREQ(::testing::UnitTest::GetInstance()
                     ->current_test_info()
                     ->test_suite_name(),
                 "CustomName/TypeParametrizedTestWithNames/parInt1");
  }
}

REGISTER_TYPED_TEST_SUITE_P(TypeParametrizedTestWithNames, TestSuiteName);

class TypeParametrizedTestNames {
 public:
  template <typename T>
  static std::string GetName(int i) {
    if (std::is_same<T, char>::value) {
      return std::string("parChar") + ::testing::PrintToString(i);
    }
    if (std::is_same<T, int>::value) {
      return std::string("parInt") + ::testing::PrintToString(i);
    }
  }
};

INSTANTIATE_TYPED_TEST_SUITE_P(CustomName, TypeParametrizedTestWithNames,
                               TwoTypes, TypeParametrizedTestNames);

// Tests that multiple TYPED_TEST_SUITE_P's can be defined in the same
// translation unit.

template <typename T>
class TypedTestP1 : public Test {};

TYPED_TEST_SUITE_P(TypedTestP1);

// For testing that the code between TYPED_TEST_SUITE_P() and
// TYPED_TEST_P() is not enclosed in a namespace.
using IntAfterTypedTestSuiteP = int;

TYPED_TEST_P(TypedTestP1, A) {}
TYPED_TEST_P(TypedTestP1, B) {}

// For testing that the code between TYPED_TEST_P() and
// REGISTER_TYPED_TEST_SUITE_P() is not enclosed in a namespace.
using IntBeforeRegisterTypedTestSuiteP = int;

REGISTER_TYPED_TEST_SUITE_P(TypedTestP1, A, B);

template <typename T>
class TypedTestP2 : public Test {};

TYPED_TEST_SUITE_P(TypedTestP2);

// This also verifies that tests from different type-parameterized
// test cases can share the same name.
TYPED_TEST_P(TypedTestP2, A) {}

REGISTER_TYPED_TEST_SUITE_P(TypedTestP2, A);

// Verifies that the code between TYPED_TEST_SUITE_P() and
// REGISTER_TYPED_TEST_SUITE_P() is not enclosed in a namespace.
IntAfterTypedTestSuiteP after = 0;
IntBeforeRegisterTypedTestSuiteP before = 0;

// Verifies that the last argument of INSTANTIATE_TYPED_TEST_SUITE_P()
// can be either a single type or a Types<...> type list.
INSTANTIATE_TYPED_TEST_SUITE_P(Int, TypedTestP1, int);
INSTANTIATE_TYPED_TEST_SUITE_P(Int, TypedTestP2, Types<int>);

// Tests that the same type-parameterized test case can be
// instantiated more than once in the same translation unit.
INSTANTIATE_TYPED_TEST_SUITE_P(Double, TypedTestP2, Types<double>);

// Tests that the same type-parameterized test case can be
// instantiated in different translation units linked together.
// (ContainerTest is also instantiated in gtest-typed-test_test.cc.)
typedef Types<std::vector<double>, std::set<char> > MyContainers;
INSTANTIATE_TYPED_TEST_SUITE_P(My, ContainerTest, MyContainers);

// Tests that a type-parameterized test case can be defined and
// instantiated in a namespace.

namespace library2 {

template <typename T>
class NumericTest : public Test {};

TYPED_TEST_SUITE_P(NumericTest);

TYPED_TEST_P(NumericTest, DefaultIsZero) { EXPECT_EQ(0, TypeParam()); }

TYPED_TEST_P(NumericTest, ZeroIsLessThanOne) {
  EXPECT_LT(TypeParam(0), TypeParam(1));
}

REGISTER_TYPED_TEST_SUITE_P(NumericTest, DefaultIsZero, ZeroIsLessThanOn