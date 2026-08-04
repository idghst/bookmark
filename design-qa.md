# Sidebar folder action menu QA

## Comparison target

- Source visual truth: `/var/folders/d_/nkcw51h14gs0t728pnkh39nc0000gn/T/codex-clipboard-6349ce38-ab41-4675-bff8-785956dff482.png` (384 × 602 px). 이 이미지는 기존의 인라인 드래그·하위 폴더 추가·편집·삭제 액션이 과도하게 노출된 상태를 보여 주는 변경 대상이다.
- Rendered implementation: `/tmp/bookmark-sidebar-actions-menu-final.jpg` (1150 × 992 px). `http://localhost:3000/`의 데스크톱 화면에서 `BNK 메뉴`를 연 상태를 캡처했다.
- Browser viewport: 1150 × 992 CSS px, browser `devicePixelRatio: 2`. 브라우저 캡처 API는 1150 × 992 px로 CSS 크기에 맞춰 반환했다.
- Source CSS 크기와 밀도는 제공되지 않았고, 원본은 사이드바 일부를 자른 이미지다. 따라서 전체 프레임을 픽셀 단위로 맞추지 않고, 같은 검토 입력에서 원본과 구현 캡처를 함께 열어 사이드바 액션 영역을 집중 비교했다.

## Evidence and state

- State: 데스크톱, `BNK`와 `AI` 하위 트리 펼침, `BNK 메뉴` 열림.
- Full-view comparison: 원본과 구현 캡처를 같은 비교 입력에서 함께 확인했다. 구현은 원본의 액션 4개를 각 행의 `…` 버튼 하나로 교체했고, 폴더명·개수·트리 들여쓰기와 기존 밝은 표면/보더 토큰은 유지한다.
- Focused-region comparison: 사이드바 오른쪽 액션 열을 확인했다. `…` 버튼을 클릭하면 포털 메뉴에 `하위 폴더 추가`, `편집`, 구분선, 위험 색상의 `삭제`가 노출되며 사이드바 스크롤 영역에 잘리지 않는다.
- Interaction evidence: 실제 브라우저에서 `BNK 메뉴`를 클릭해 세 항목을 확인했다. `하위 폴더 추가`를 클릭하면 상위 폴더가 `BNK`로 미리 선택된 `새 폴더` 대화상자가 열리고, 취소로 원상복구했다. 브라우저 console error는 없었다.
- Automated evidence: `PATH=/opt/homebrew/bin:$PATH pnpm verify` 통과 — typecheck, 68 tests, production build.

**Findings**

- No actionable P0/P1/P2 findings.
- Intentional delta: 원본의 인라인 액션 나열은 사용자가 제거를 요청한 상태다. 구현의 단일 `…` 버튼과 드롭다운은 이 변경 의도를 충족한다.

## Required fidelity surfaces

- Fonts and typography: 폴더명·개수의 기존 크기, 굵기, 잘림 규칙을 유지했다. 메뉴 항목은 기존 사이드바와 같은 작은 UI 텍스트 밀도를 유지한다.
- Spacing and layout rhythm: 4개 아이콘이 차지하던 가로폭을 32px 트리거 하나로 축소했다. 행 높이, 트리 들여쓰기, 폴더 수 정렬은 변하지 않는다.
- Colors and visual tokens: 기본 아이콘은 muted/brand hover 토큰, 삭제는 기존 destructive/red 토큰을 사용한다. 메뉴 표면·보더·그림자는 기존 흰 카드 스타일과 조화된다.
- Image quality and asset fidelity: 이미지 자산을 추가하거나 교체하지 않았다. 기존 Lucide 아이콘만 사용했다.
- Copy and content: 메뉴 문구는 `하위 폴더 추가`, `편집`, `삭제`로 기존 기능의 한국어 의미를 그대로 유지한다.
- Accessibility and responsiveness: 트리거와 메뉴는 각각 `${folder.name} 메뉴` 접근성 이름을 갖고, 메뉴 항목은 키보드로 열고 선택할 수 있다. 메뉴는 포털로 렌더링되어 스크롤 컨테이너 밖에서도 보인다.

**Open Questions**

- None.

**Implementation Checklist**

1. 폴더 행의 `…` 버튼을 유지한다.
2. 메뉴에서 하위 폴더 추가·편집·삭제를 제공한다.
3. 폴더 행 자체의 드래그 정렬 계약은 유지한다.

**Follow-up Polish**

- None required for this scope.

## Comparison history

1. Source state showed four persistent inline controls per folder row. The implementation replaces that density with a single ellipsis trigger and an opened action menu; the focused visual and interaction comparison found no P0/P1/P2 mismatch.

final result: passed
