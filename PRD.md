# PRD.md

## 1. 배경

- 원본 **Roo Code**는 외부 LLM·텔레메트리 의존 → 사내망 배포 불가.
- 목표: **100% 오프라인** 편집·에이전트 기능 제공 + **vLLM** 내부 서버 연동 및 VSIX 패키징 지원.

## 2. 목표(Goals)

| ID  | Goal                                          | Priority |
| --- | --------------------------------------------- | -------- |
| G1  | 모든 외부 HTTP/S 호출 제거·토글화             | P0       |
| G2  | 로컬 LLM 엔드포인트(vLLM, Ollama) 기본 지원   | P0       |
| G3  | VSIX 패키징 및 설치 자동화                    | P1       |
| G4  | VS Code 1.77 – 1.89 호환 유지                 | P1       |
| G5  | SaaS 기능(모드 마켓플레이스 등) 선택적 활성화 | P2       |

## 3. 범위

### In-scope

- Telemetry/API 호출 코드 식별·옵션화
- vLLM 및 Ollama 엔드포인트 설정 UI·CLI
- VSIX 패키징 워크플로 및 문서화
- 사내 CI/CD(예: GitLab CI) 템플릿 제공

### Out-of-scope

- 에디터 UI 전면 개편
- 클라우드 기반 협업(멀티유저) 기능

## 4. 요구사항

### 4.1 기능(Functional)

1. `ON_PREM=true` 시 모든 외부 네트워크 요청 차단.
2. `settings.json`에서 vLLM URL·Key 또는 Ollama 모델명 입력만으로 동작.
3. `npm run package:vsix`로 VSIX 파일 생성 가능.
4. 기존 Custom Mode YAML 완전 호환.

### 4.2 비기능(Non-Functional)

- 보안: 오프라인 상황에서 동작 확인용 e2e test 포함.
- 성능: 원본 대비 응답 속도 ±20% 이내 (vLLM/Ollama 모두 측정).
- 호환성: Mac/Windows/Linux VSCode 및 vscodium 지원.

## 5. 가정·제약

- 회사 방화벽 outbound 80/443 차단.
- 내부 vLLM 서버(gpu-srv:1234)와 Ollama 서버 가용.

## 6. 수용 기준(Acceptance Criteria)

1. `npm run test:onprem` 통과.
2. `npm run package:vsix` 실행 시 오류 없이 `.vsix` 파일 생성.
3. e2e 프록시 로그에서 외부 호출 0건.
4. README > “Quick Start(On-Prem)” 절차에 vLLM 설정 및 VSIX 설치 포함, 5분 내 설치 가능.

## 7. 위험 & 완화

| Risk           | Impact      | Mitigation                                    |
| -------------- | ----------- | --------------------------------------------- |
| 외부 호출 누락 | 데이터 유출 | 정적 URL 스캐너 + 동적 e2e 프록시 로그        |
| vLLM 성능 미달 | UX 저하     | 모델 캐시, GPU 배치 파라미터 최적화           |
| 패키징 실패    | 배포 지연   | CI 단계에서 `vsce package` 검증 스테이지 추가 |

## 8. 일정(High-level)

| Phase | Duration | Deliverables                                     |
| ----- | -------- | ------------------------------------------------ |
| 분석  | W1       | 호출 목록 CSV + vLLM API 스펙 매핑               |
| 구현  | W2-W3    | 코드 수정·유닛 테스트 + VSIX 패키징 구현         |
| 검증  | W4       | e2e on-prem suite (vLLM/Ollama) + `.vsix` 테스트 |
| GA    | W5       | v0.1-onprem Tag + Docs + VSIX 배포               |

## 9. 이해관계자

- Eng Lead (종덕)
- Security Team
- Infra Team
- OSS Compliance
