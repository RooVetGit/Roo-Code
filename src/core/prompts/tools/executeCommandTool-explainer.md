| Symbol    | Explanation                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| `S`       | Represents the complete system state, including all files, processes, and configurations.                    |
| `c`       | Represents the command operation being executed.                                                             |
| `s`       | Represents an individual state within the complete system state `S`.                                         |
| `∀`       | Universal quantifier, meaning "for all". For example, `∀s ∈ S` means "for all states `s` in set `S`".        |
| `∈`       | Element of, meaning "is a member of". For example, `s ∈ S` means "state `s` is a member of set `S`".         |
| `=`       | Equals, meaning the system state remains unchanged.                                                          |
| `∃`       | Existential quantifier, meaning "there exists". For example, `∃c⁻¹` means "there exists an inverse command". |
| `c⁻¹`     | Inverse of the command operation `c`, which undoes the changes made by `c`.                                  |
| `≠`       | Not equal, meaning the state has changed.                                                                    |
| `∧`       | Logical AND, meaning both conditions must be true.                                                           |
| `∨`       | Logical OR, meaning at least one of the conditions must be true.                                             |
| `t`       | Represents time.                                                                                             |
| `A(s, t)` | Availability function, where `A(s, t) = 0` means a service is unavailable for state `s` at time `t`.         |
| `d`       | Represents data or information being removed from the system.                                                |
| `D`       | Represents the set of all data or information in the system.                                                 |
| `⊂`       | Proper subset, meaning `d(s)` is a subset of `s` but not equal to `s`.                                       |
| `¬`       | Negation, meaning "not". For example, `¬∃f` means "there does not exist a function `f`".                     |
| `f`       | Represents a recovery function attempting to restore the original state.                                     |

_Originally posted by @adamhill in https://github.com/RooVetGit/Roo-Code/issues/2670#issuecomment-2808206285_
