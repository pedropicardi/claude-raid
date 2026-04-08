---
name: raid-tdd
description: "Use during implementation. Enforces strict RED-GREEN-REFACTOR. No production code without a failing test first. Challengers attack test quality. No subagents."
---

# Raid TDD — Test-Driven Development

Write the test first. Watch it fail. Write minimal code to pass. Then the others try to break it.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of these rules is violating their spirit.**

**TDD is enforced in ALL modes — Full Raid, Skirmish, and Scout. No exceptions.**

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over. No exceptions.

## Red-Green-Refactor

### RED — Write Failing Test
- One test, one behavior. "And" in the name? Split it.
- Clear name describing the behavior
- Real code, no mocks unless absolutely unavoidable

### Verify RED — Watch It Fail (MANDATORY)
Run: test command from `.claude/raid.json`
- Test fails (not errors — fails)
- Failure message matches expectation
- Fails because feature missing, not typos

### GREEN — Minimal Code
- Simplest code to pass. Don't over-engineer.

### Verify GREEN — Watch It Pass (MANDATORY)
Run: test command from `.claude/raid.json`
- New test passes
- ALL existing tests still pass

### REFACTOR — Clean Up (only after green)
- Remove duplication, improve names, extract helpers
- Keep tests green throughout

## Adversarial Test Review

After TDD cycle, challengers attack the TESTS:
1. Does this test prove the behavior, or just confirm the implementation?
2. What input would make this test pass even with a broken implementation?
3. What edge cases are uncovered?
4. Is it testing real code or mock behavior?
5. Would this catch a regression?

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Need to explore first" | Fine. Throw away exploration. Start with TDD. |
| "Test hard = skip it" | Hard to test = hard to use. Fix the design. |
| "TDD slows me down" | TDD is faster than debugging. |

## Verification Checklist

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for the expected reason
- [ ] Wrote minimal code to pass
- [ ] All tests pass (new and existing)
- [ ] Tests use real code
- [ ] Edge cases and error paths covered
