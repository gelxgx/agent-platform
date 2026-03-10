---
name: code-review
description: Systematic code review focusing on quality, security, and maintainability
allowed-tools: [read_file]
---

## Code Review Checklist

1. **Correctness** — Does the code do what it's supposed to?
2. **Error handling** — Are edge cases and errors handled properly?
3. **Security** — Any injection, XSS, or data exposure risks?
4. **Performance** — Any obvious bottlenecks or unnecessary operations?
5. **Readability** — Is the code clear and well-structured?
6. **DRY/YAGNI** — Any duplication or unnecessary complexity?

## Output Format

For each issue found:
- Severity: critical / warning / suggestion
- Location: file and line
- Description: what's wrong and why
- Fix: concrete recommendation
