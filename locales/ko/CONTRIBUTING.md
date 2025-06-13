[English](../../CONTRIBUTING.md) • [Català](../ca/CONTRIBUTING.md) • [Deutsch](../de/CONTRIBUTING.md) • [Español](../es/CONTRIBUTING.md) • [Français](../fr/CONTRIBUTING.md) • [हिंदी](../hi/CONTRIBUTING.md) • [Italiano](../it/CONTRIBUTING.md) • [Nederlands](../nl/CONTRIBUTING.md) • [Русский](../ru/CONTRIBUTING.md)

[日本語](../ja/CONTRIBUTING.md) • <b>한국어</b> • [Polski](../pl/CONTRIBUTING.md) • [Português (BR)](../pt-BR/CONTRIBUTING.md) • [Türkçe](../tr/CONTRIBUTING.md) • [Tiếng Việt](../vi/CONTRIBUTING.md) • [简体中文](../zh-CN/CONTRIBUTING.md) • [繁體中文](../zh-TW/CONTRIBUTING.md)

# Roo Code 기여 가이드

Roo Code는 커뮤니티 주도의 프로젝트이며, 모든 기여를 소중하게 생각합니다. 협업을 간소화하기 위해 [Issue-First](#issue-first-접근법) 원칙을 적용하고 있으며, 이는 모든 [Pull Request (PR)](#pull-request-제출)가 먼저 GitHub Issue와 연결되어야 함을 의미합니다. 이 가이드를 주의 깊게 검토해 주세요.

## 목차

- [기여 전 준비](#기여-전-준비)
- [기여 내용 찾기 및 계획 세우기](#기여-내용-찾기-및-계획-세우기)
    - [기능 요청 vs. 상세 기능 제안](#기능-요청-vs-상세-기능-제안)
- [개발 및 제출 프로세스](#개발-및-제출-프로세스)
- [법적 안내](#법적-안내)

## 기여 전 준비

### 1. 행동 강령

모든 기여자는 [행동 강령](./CODE_OF_CONDUCT.md)을 준수해야 합니다.

### 2. 프로젝트 로드맵

로드맵은 프로젝트 방향을 안내합니다. 기여를 다음 핵심 목표에 맞추세요:

### 신뢰성 우선

- diff 편집과 명령 실행의 일관된 신뢰성 보장
- 정기적 사용을 방해하는 마찰점 감소
- 모든 언어 환경과 플랫폼에서의 원활한 작동 보장
- 다양한 AI 제공업체 및 모델에 대한 강력한 지원 확대

### 향상된 사용자 경험

- 명확성과 직관성을 위한 UI/UX 간소화
- 개발자들이 일상적으로 사용하는 도구에 기대하는 높은 기준을 충족하기 위한 지속적인 워크플로우 개선

### 에이전트 성능 선도

- 실제 생산성을 측정하는 포괄적인 평가 기준(evals) 수립
- 누구나 이러한 평가를 쉽게 실행하고 해석할 수 있도록 지원
- 평가 점수의 명확한 향상을 보여주는 개선 제공

PR에서 이러한 영역과의 연관성을 언급하세요.

### 3. Roo Code 커뮤니티 참여

- **주요 방법:** [Discord](https://discord.gg/roocode)에 가입하고 **Hannes Rudolph (`hrudolph`)**에게 DM을 보내세요.
- **대안:** 경험 많은 기여자는 [GitHub Projects](https://github.com/orgs/RooCodeInc/projects/1)를 통해 직접 참여할 수 있습니다.

## 기여 내용 찾기 및 계획 세우기

### 기여 유형

- **버그 수정:** 코드 문제 해결.
- **새 기능:** 기능 추가.
- **문서화:** 가이드 개선 및 명확성 향상.

### Issue-First 접근법

모든 기여는 GitHub Issue에서 시작해야 합니다.

- **기존 Issue 확인:** [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)를 검색하세요.
- **Issue 생성:** 적절한 템플릿 사용:
    - **버그:** "Bug Report" 템플릿.
    - **기능:** "Detailed Feature Proposal" 템플릿. 시작 전 승인 필요. (아래 [기능 요청 vs. 상세 기능 제안](#기능-요청-vs-상세-기능-제안) 참조)
- **Issue 담당:** 댓글을 달고 공식 할당을 기다리세요.

**승인된 Issue 없는 PR은 닫힐 수 있습니다.**

### 작업 선택하기

- 할당되지 않은 "Good First Issues"를 [GitHub 프로젝트](https://github.com/orgs/RooCodeInc/projects/1)에서 확인하세요.
- 문서 관련은 [Roo Code Docs](https://github.com/RooCodeInc/Roo-Code-Docs)를 참조하세요.

### 버그 신고

- 먼저 기존 신고를 확인하세요.
- ["Bug Report" 템플릿](https://github.com/RooCodeInc/Roo-Code/issues/new/choose)을 사용하여 새 버그를 신고하세요.
- **보안 문제:** [security advisories](https://github.com/RooCodeInc/Roo-Code/security/advisories/new)를 통해 비공개로 신고하세요.

### 기능 요청 vs. 상세 기능 제안

이 두 제출 유형의 차이를 이해하는 것은 올바른 접근 방식을 선택하는 데 중요합니다:

#### 기능 요청 (GitHub Discussions)

**목적**: 상세한 계획 없이 일반적인 아이디어나 제안을 공유합니다.

**제출 방법**:

- [GitHub Discussions - Feature Requests](https://github.com/RooCodeInc/Roo-Code/discussions/categories/feature-requests)로 이동
- 또는 issues 섹션에서 "New Issue" 버튼을 누를 때 "Feature Request" 링크를 클릭

**사용 시기**:

- 아이디어가 아직 완전히 개발되지 않았을 때
- 커뮤니티의 의견이나 피드백을 원할 때
- 개인적으로 구현할 계획 없이 아이디어를 제안할 때

#### 상세 기능 제안 (GitHub Issues)

**목적**: 승인 후 즉시 구현을 위한 명확하게 개요가 작성된 기능입니다.

**제출 방법**:

- [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)로 이동
- "New Issue"를 클릭하고 "Detailed Feature Proposal" 템플릿을 선택

**사용 시기**:

- 기능이 완전히 계획되고 승인 준비가 되었을 때
- 본인이나 다른 사람이 곧 기능을 구현할 의도가 있을 때
- 개발 시작 전에 공식 승인이 필요할 때

**참고**: 상세 기능 제안은 위의 [Issue-First 접근법](#issue-first-접근법) 섹션에서 언급한 대로 구현을 시작하기 전에 메인테이너의 승인과 할당이 필요합니다.

![Issue 템플릿 선택](placeholder-for-issue-template-selection-image)

**중요**: 잘못된 템플릿을 선택하면 제출이 리디렉션되거나 닫힐 수 있습니다. 기능 아이디어에 버그 리포트를 사용하지 마세요.

## 개발 및 제출 프로세스

### 개발 환경 설정

1. **Fork & Clone:**

```
git clone https://github.com/당신의_아이디/Roo-Code.git
```

2. **의존성 설치:**

```
npm run install:all
```

3. **디버깅:** VS Code에서 `F5`를 눌러 실행하세요.

### 코드 작성 가이드라인

- 하나의 기능 또는 수정당 하나의 집중된 PR.
- ESLint와 TypeScript 모범 사례를 따르세요.
- Issue를 참조하는 명확한 커밋 메시지를 작성하세요(예: `Fixes #123`).
- 철저한 테스트를 제공하세요(`npm test`).
- 제출 전 최신 `main` 브랜치에 리베이스하세요.

### Pull Request 제출

- 초기 피드백을 원한다면 **드래프트 PR**로 시작하세요.
- Pull Request 템플릿에 따라 변경 사항을 명확히 설명하세요.
- UI 변경에 대한 스크린샷/동영상을 제공하세요.
- 문서 업데이트가 필요한지 표시하세요.

### Pull Request 정책

- 사전 승인 및 할당된 Issue를 참조해야 합니다.
- 정책을 준수하지 않는 PR은 닫힐 수 있습니다.
- PR은 CI 테스트를 통과하고, 로드맵에 부합하며, 명확한 문서를 갖추어야 합니다.

### 리뷰 프로세스

- **일일 분류:** 메인테이너의 빠른 검토.
- **주간 심층 리뷰:** 종합적인 평가.
- **피드백에 따라 신속히 반복**하세요.

## 법적 안내

기여함으로써, 귀하의 기여가 Roo Code의 라이선스와 일치하는 Apache 2.0 라이선스 하에 제공됨에 동의합니다.
