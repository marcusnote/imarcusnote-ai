4.4.1.7c CHAPTER RULECARD MINIMAL PATCH

목표:
- 4.4.1.7 전체 구조는 유지
- 실행 안정성을 해치지 않음
- prompt 앞단에 챕터 정체성 고정용 rule card만 추가
- validator / repair / regen / handler 흐름은 이번 단계에서 건드리지 않음
- review-output 연동은 다음 단계(4.4.1.7d)로 미룸

왜 이 단계가 필요한가:
- 현재 4.4.1.7은 실행 안정성은 괜찮지만, "관계대명사의 계속적인 용법"처럼 챕터 정체성이 drift 되는 문제가 있음.
- 실제 출력물에서 계속적 용법이 아니라 restrictive / that / where 위주로 생성되었음.
- 따라서 지금은 뒤에서 세게 잡는 validator보다, 생성 전에 챕터 규칙을 더 분명히 주는 것이 맞음.

적용 원칙:
- 함수 추가 2개
- buildSystemPrompt 내부 2줄 추가
- 그 외 기존 코드 유지

==================================================
[A] buildChapterRuleCard 추가
   위치: buildLearningVariationRuleBlock 함수 아래, buildSystemPrompt 함수 위
==================================================

function buildChapterRuleCard(input) {
  const focus = input.grammarFocus || detectGrammarFocus(
    [input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" ")
  );
  const isEn = input.language === "en";

  if (focus.isRelativePronoun && focus.isNonRestrictive) {
    return isEn ? `
[Chapter Rule Card: Non-Restrictive Relative Clauses]
- This chapter is specifically about non-restrictive relative clauses.
- Prefer comma + who / which / whom / whose.
- Use the relative clause as extra information about an already identified noun.
- Avoid drifting into restrictive-only patterns.
- Do not rely mainly on safe fallback patterns such as "the one that".
- Do not use that as the main relative pronoun in this chapter.
- Keep all final answers as complete, natural sentences.
` : `
[챕터 Rule Card: 관계대명사의 계속적 용법]
- 이 챕터는 관계대명사의 계속적 용법을 위한 학습지이다.
- 쉼표 + who / which / whom / whose 구조를 우선한다.
- 관계절은 이미 특정된 선행사에 부가 정보를 더하는 방식으로 쓴다.
- 제한적 용법 위주 패턴으로 흐르지 않는다.
- "the one that" 같은 안전한 제한적 도피 패턴에 주로 의존하지 않는다.
- 이 챕터에서는 that을 중심 관계대명사로 쓰지 않는다.
- 최종 정답은 모두 완전하고 자연스러운 문장이어야 한다.
`;
  }

  if (focus.isRelativePronoun && focus.isObjectiveRelativePronoun) {
    return isEn ? `
[Chapter Rule Card: Objective Relative Pronouns]
- Keep the object role visible.
- Do not collapse the chapter into only subject relative clauses.
- Prefer natural object-relative sentence patterns.
- Keep every final answer complete and teachable.
` : `
[챕터 Rule Card: 목적격 관계대명사]
- 목적격 역할이 실제 문장에 드러나야 한다.
- 주격 관계절만 반복하는 방향으로 무너지지 않는다.
- 자연스러운 목적격 관계절 문장을 우선한다.
- 모든 최종 정답은 완전하고 수업용으로 자연스러워야 한다.
`;
  }

  if (focus.isParticipleModifier) {
    return isEn ? `
[Chapter Rule Card: Attributive Participles]
- Prefer participles directly modifying nouns.
- Use patterns like "the boy running fast" and "the book written in English" naturally.
- Do not rewrite most items into ordinary relative clauses.
- Keep answers natural and classroom-usable.
` : `
[챕터 Rule Card: 분사의 한정적 용법]
- 분사가 명사를 직접 수식하는 구조를 우선한다.
- "빠르게 달리는 소년", "영어로 쓰인 책" 같은 구조를 자연스럽게 사용한다.
- 대부분의 문항을 관계절로 바꿔 쓰지 않는다.
- 정답은 자연스럽고 수업에 바로 쓸 수 있어야 한다.
`;
  }

  if (focus.isCausative) {
    return isEn ? `
[Chapter Rule Card: Causative Verbs]
- Keep real causative structures visible.
- Use make / let / have / help / get when appropriate.
- Do not paraphrase most items into ordinary non-causative sentences.
` : `
[챕터 Rule Card: 사역동사]
- 실제 사역 구조가 문장에 드러나야 한다.
- make / let / have / help / get 구조를 적절히 사용한다.
- 대부분의 문항을 일반 평서문으로 바꿔버리지 않는다.
`;
  }

  if (focus.isSoThatPurpose) {
    return isEn ? `
[Chapter Rule Card: so that Purpose]
- Keep complete so that + subject + can/could/will/would structures.
- Never leave the clause unfinished after so that.
- Keep the purpose meaning clearly visible.
` : `
[챕터 Rule Card: so that 구문 (목적)]
- 완전한 so that + 주어 + can/could/will/would 구조를 유지한다.
- so that 뒤를 미완성으로 남기지 않는다.
- 목적 의미가 분명하게 드러나야 한다.
`;
  }

  if (focus.isToInfinitive) {
    return isEn ? `
[Chapter Rule Card: To-Infinitive]
- Keep to + base verb clearly visible.
- Do not drift mainly into gerunds.
` : `
[챕터 Rule Card: to부정사]
- to + 동사원형 구조를 분명하게 유지한다.
- 동명사 중심으로 흐르지 않는다.
`;
  }

  if (focus.isGerund) {
    return isEn ? `
[Chapter Rule Card: Gerund]
- Keep -ing forms used as nouns clearly visible.
- Do not replace most target answers with to-infinitive sentences.
` : `
[챕터 Rule Card: 동명사]
- -ing가 명사 역할로 쓰이는 구조를 분명하게 유지한다.
- 대부분의 문항을 to부정사로 바꾸지 않는다.
`;
  }

  if (focus.isPassive) {
    return isEn ? `
[Chapter Rule Card: Passive Voice]
- Keep be + past participle visible.
- Maintain natural passive sentences instead of active paraphrases.
` : `
[챕터 Rule Card: 수동태]
- be + 과거분사 구조를 분명하게 유지한다.
- 대부분의 문항을 능동태 바꿔쓰기로 처리하지 않는다.
`;
  }

  if (focus.isPresentPerfect) {
    return isEn ? `
[Chapter Rule Card: Present Perfect]
- Keep have/has + past participle visible.
- Avoid finished past-time expressions that clash with present perfect.
` : `
[챕터 Rule Card: 현재완료]
- have/has + 과거분사 구조를 유지한다.
- 현재완료와 충돌하는 finished past-time expression을 피한다.
`;
  }

  if (focus.isComparative) {
    return isEn ? `
[Chapter Rule Card: Comparative]
- Keep comparative structures visibly present.
- Do not blur the target into generic descriptive sentences.
` : `
[챕터 Rule Card: 비교급]
- 비교급 구조가 실제 문장에 드러나야 한다.
- 막연한 일반 서술문으로 흐리지 않는다.
`;
  }

  if (focus.isSuperlative) {
    return isEn ? `
[Chapter Rule Card: Superlative]
- Keep superlative structures clearly visible.
- Prefer full natural noun phrases rather than bare endings.
` : `
[챕터 Rule Card: 최상급]
- 최상급 구조가 분명하게 드러나야 한다.
- 어색한 맨끝 마감 대신 자연스러운 완전한 명사구를 우선한다.
`;
  }

  return "";
}

==================================================
[B] buildModeRuleCard 추가
   위치: [A] 바로 아래
==================================================

function buildModeRuleCard(input) {
  const isEn = input.language === "en";

  if (input.mode === "writing") {
    return isEn ? `
[Mode Rule Card: Writing Lab]
- Keep the worksheet strongly production-oriented.
- Use generous but fragment-based clues.
- Mix guided composition, rearrangement, partial completion, and transformation naturally.
- The worksheet should feel like premium guided writing practice, not a trap-based test.
` : `
[모드 Rule Card: Writing Lab]
- 학습자가 직접 영어를 생산하는 영작훈련 워크북 정체성을 유지한다.
- clue는 충분히 주되, 완성문장 복붙형이 아니라 조각형으로 준다.
- guided composition, 재배열, 부분완성, 변환형을 자연스럽게 섞는다.
- 함정형 시험지가 아니라 프리미엄 guided writing 훈련지처럼 보여야 한다.
`;
  }

  if (input.mode === "magic-card") {
    return isEn ? `
[Mode Rule Card: Magic Card]
- Keep items compact, sharp, and drill-friendly.
- Preserve production identity even when the set is concise.
` : `
[모드 Rule Card: Magic Card]
- 문항은 압축적이고 선명해야 한다.
- 짧아도 생산형 훈련 정체성을 유지한다.
`;
  }

  if (input.mode === "abcstarter") {
    return isEn ? `
[Mode Rule Card: ABC Starter]
- Keep sentences shorter and cognitively lighter.
- Prefer very clear clues and beginner-friendly wording.
` : `
[모드 Rule Card: ABC Starter]
- 문장은 더 짧고 부담이 적어야 한다.
- clue와 표현은 매우 친절하고 입문 친화적이어야 한다.
`;
  }

  return "";
}

==================================================
[C] buildSystemPrompt 내부에 2줄 추가
   위치: 기존 buildSystemPrompt의 Magic 본문에서
   ${buildGrammarRuleBlock(input)}
   ${buildTargetCoverageRuleBlock(input)}
   사이 또는 바로 아래
==================================================

한국어 prompt 쪽과 영어 prompt 쪽 모두 아래 2줄을 추가:

${buildChapterRuleCard(input)}
${buildModeRuleCard(input)}

예시:

제목: ${title}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
요구사항: ${taskGuide}
${buildGrammarRuleBlock(input)}
${buildChapterRuleCard(input)}
${buildModeRuleCard(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

영문 prompt도 같은 위치에 추가:

Requirement: ${taskGuide}
${buildGrammarRuleBlock(input)}
${buildChapterRuleCard(input)}
${buildModeRuleCard(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

==================================================
[D] 이번 단계에서 하지 않는 것
==================================================
- handler 수정 없음
- callOpenAI 수정 없음
- formatMagicResponse 수정 없음
- validator / repair / regen 추가 없음
- review-output 직접 연동 없음

==================================================
[E] 이번 단계 배포 후 테스트 우선순위
==================================================
1. 관계대명사의 계속적 용법
2. 분사의 한정적 용법
3. so that 구문 (목적)
4. 사역동사

체크 포인트:
- 챕터 정체성이 맞게 보이는가
- [혼합형]/(부분완성)/(초과단어 포함) 흐름이 유지되는가
- 정답지가 완전한 문장인가
- that / where / restrictive drift가 줄었는가

==================================================
[F] 다음 단계 예고
==================================================
다음 4.4.1.7d에서는 review-output-4.7.1-rule-card-stable을 별도 후처리 레이어로 연결한다.
즉,
1차: generate-magic (4.4.1.7c)
2차: review-output
구조로 가볍게 정리하는 SaaS형 2-pass 구조로 간다.
