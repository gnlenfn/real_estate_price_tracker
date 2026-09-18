<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architecture Decision Records

중요한 구조·데이터·외부 연동 결정은 `docs/adr/`에 ADR로 기록한다.

- 파일명은 `NNNN-short-title.md` 형식을 사용한다.
- 단순 UI 수정, 버그 수정, 포맷팅에는 ADR을 만들지 않는다.
- 한 ADR에는 하나의 결정만 기록한다.
- 결정이 바뀌면 기존 ADR을 삭제하지 않고 `Superseded` 상태로 표시한다.
- 상세 형식과 템플릿은 [`docs/adr/README.md`](docs/adr/README.md)를 따른다.
