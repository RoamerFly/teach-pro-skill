# Repository workflow

- Work serially. Do not start parallel sub-agents.
- After each completed update, run relevant checks, record changes and validation evidence, commit, and push to `origin/main`. The user has authorized this workflow; report the resulting commit and any failed push.
- Preserve ordinary commit history for traceability and rollback. Do not force-push, squash past releases, or rewrite history without a new explicit request. Use a revert commit for an authorized rollback.
- Review the diff and staged paths before committing. Keep learner answers, chats, model configuration, keys and local caches out of Git; preserve unrelated user changes.
- Keep reusable changes in `teach-pro/`; use `example/` for the course showcase and `evals/` for reproducible evidence. Do not treat hand-edited examples or static checks as proof of new Agent behavior or learning outcomes.
- TeleAgent behavioral testing uses the 智鉴 Agent course as the main case. Preserve original submissions and use isolated copies for synthetic browser tests.
