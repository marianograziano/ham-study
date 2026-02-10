---
description: Recall memory - Display ADR records and verify compliance
---

# /recall - 回顾记忆 / Memory Recall

Trigger the Adaptive Memory Recall Protocol (Level 3).

## Steps

// turbo

1. Read `context/memory.md` completely
2. Output the Memory Checkpoint summary to user:

```
🧠 记忆检查点 / Memory Checkpoint

📋 当前 ADR 记录 / Current ADR Records:
[List all ADRs from context/memory.md]

✅ 已确认与 ADR 保持一致 / ADR compliance confirmed.
```

1. Verify current work aligns with ADRs

## Usage

Type `/recall` when:

- Starting complex architectural work
- Before making security-sensitive changes
- AI seems to violate previous decisions
- After a long conversation (50+ turns)

## Expected Output

AI should display the Memory Checkpoint and confirm ADR compliance.
