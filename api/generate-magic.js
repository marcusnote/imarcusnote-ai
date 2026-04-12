4.4.1.7b RULE CARD FRAMEWORK PATCH

목표:
- 4.4.1.7의 실행 안정성 구조는 그대로 유지한다.
- validator / repair / handler / MP 흐름은 건드리지 않는다.
- buildSystemPrompt 조립부에만 Core + Chapter + Mode Rule Card 레이어를 추가한다.
- 규칙은 너무 강하게 조이지 않고, SaaS 스타일로 "일정하지만 자연스러운 출력"을 목표로 한다.

적용 원칙:
- 기존 buildGrammarRuleBlock / buildTargetCoverageRuleBlock / buildStabilityLockRuleBlock / buildLearningVariationRuleBlock 는 유지
- 새 rule card는 "우선 방향을 잡는 안내 레이어"로만 사용
- 하드 금지보다 soft steering 중심

==================================================
[A] buildRuleCardBlock 계열 함수 추가
==================================================
아래 블록을 buildLearningVariationRuleBlock 아래, buildSystemPrompt 위에 추가하세요.

function buildCoreRuleCardBlock(input) {
  const isEn = input.language === "en";
  return isEn ? `
[Core Rule Card: Premium Guided Writing Workbook]
Identity:
- Keep the worksheet writing-training centered.
- Keep the worksheet classroom-ready, academy-ready, and workbook-like.
- The result should feel consistent across runs, but not mechanically repetitive.

Output expectations:
- Maintain [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] structure.
- Keep questions and answers clearly separated.
- Keep numbering stable and close to the requested item count.
- Every final answer should be a complete, natural, teachable sentence.

Clue and item rules:
- Use generous but non-copying clues.
- Prefer fragment clues over full-sentence clues.
- Mix productive item types naturally across the set.
- Keep the worksheet guided, not trap-based.

Soft consistency rules:
- Keep a recognizable Marcus Magic identity across runs.
- Do not make every item identical in shape.
- Prefer stable quality over flashy variation.
- When the source prompt is awkward, smooth it into a natural learning sentence.
`.trim() : `
[Core Rule Card: 프리미엄 Guided Writing Workbook]
정체성:
- 워크북은 영작훈련 중심으로 유지한다.
- 결과물은 수업용·학원용·워크북형으로 바로 사용할 수 있어야 한다.
- 출력은 매번 어느 정도 일정해야 하지만, 기계적 반복처럼 보이지는 않아야 한다.

출력 기대치:
- [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지한다.
- 문제와 정답은 분명히 분리한다.
- 번호와 문항 수는 요청값에 최대한 가깝게 유지한다.
- 최종 정답 문장은 완전하고 자연스럽고 가르칠 수 있는 문장이어야 한다.

clue / 문항 규칙:
- clue는 충분히 주되, 베껴쓰기처럼 만들지 않는다.
- 완성문장 clue보다 조각형 clue를 우선한다.
- 세트 전체에 생산형 문항 유형을 자연스럽게 섞는다.
- 함정형이 아니라 guided training형 워크북처럼 보이게 한다.

느슨한 일관성 규칙:
- 매번 결과가 달라도 Marcus Magic의 공통 인상은 유지한다.
- 모든 문항을 똑같은 틀로 반복하지 않는다.
- 과한 변주보다 안정된 품질을 우선한다.
- 원문이 어색하면 목표 문법은 유지하되 자연스러운 학습 문장으로 다듬는다.
`.trim();
}

function buildChapterRuleCardBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus(
    [input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" ")
  );
  const isEn = input.language === "en";

  const cards = {
    relative_pronoun_non_restrictive: isEn ? `
[Chapter Rule Card: Non-Restrictive Relative Clauses]
Target identity:
- The worksheet should mainly feel like practice of extra-information relative clauses.
- The noun should usually be already identified, and the clause should add information.

Preferred tendencies:
- Prefer comma + who / which / whom / whose.
- Prefer complete main clause + inserted extra-information clause.
- Allow some variety in meaning, but keep the chapter identity visible.

Avoid drift:
- Do not rely mainly on restrictive relative clauses.
- Do not rely on safe fallback patterns like "the one that".
- Do not let comma-free relative clauses dominate the whole set.
- Do not use that as the main solution pattern here.
`.trim() : `
[Chapter Rule Card: 관계대명사의 계속적 용법]
목표 정체성:
- 학습지는 부가정보를 덧붙이는 계속적 용법 연습처럼 보여야 한다.
- 선행사는 대체로 이미 특정되어 있고, 관계절은 추가 설명을 덧붙이는 역할이어야 한다.

선호 경향:
- comma + who / which / whom / whose를 우선한다.
- 완전한 주절 + 삽입형 부가설명 구조를 우선한다.
- 의미는 다양화하되, 챕터 정체성은 분명히 보이게 한다.

이탈 방지:
- 제한적 용법 중심으로 흘러가지 않는다.
- "the one that" 같은 안전한 제한적 대체 패턴에 주로 의존하지 않는다.
- 쉼표 없는 관계절이 세트 전체를 지배하지 않게 한다.
- 이 챕터에서는 that을 주된 해법으로 쓰지 않는다.
`.trim(),

    relative_pronoun_objective: isEn ? `
[Chapter Rule Card: Objective Relative Pronouns]
- Keep the object role visible in many items.
- Prefer natural object relative clauses.
- Do not let only subject-relative patterns dominate the whole set.
- Keep sentences teachable and natural rather than overly formal.
`.trim() : `
[Chapter Rule Card: 목적격 관계대명사]
- 목적격 역할이 여러 문항에서 실제로 드러나게 한다.
- 자연스러운 목적격 관계절을 우선한다.
- 주격 관계절만 세트 전체를 지배하지 않게 한다.
- 지나치게 딱딱한 문장보다 수업용으로 자연스러운 문장을 우선한다.
`.trim(),

    relative_pronoun_restrictive: isEn ? `
[Chapter Rule Card: Restrictive Relative Clauses]
- Keep the relative clause essential to identifying the noun.
- Prefer clear noun-identifying practice.
- Do not force commas unless really needed.
`.trim() : `
[Chapter Rule Card: 관계대명사의 제한적 용법]
- 관계절이 선행사를 한정하는 필수 정보가 되게 한다.
- 대상을 분명히 특정하는 연습이 되게 한다.
- 필요하지 않은 쉼표를 억지로 넣지 않는다.
`.trim(),

    participial_modifier: isEn ? `
[Chapter Rule Card: Attributive Participles]
Target identity:
- The worksheet should mainly feel like noun-modifying participle practice.

Preferred tendencies:
- Prefer patterns like "the boy running fast" and "the book written in English".
- Let present and past participles directly modify nouns in visible ways.
- Allow some mixed sentence types, but keep participial modification central.

Avoid drift:
- Do not turn the whole set into ordinary relative clause practice.
- Do not let plain non-target statements dominate.
`.trim() : `
[Chapter Rule Card: 분사의 한정적 용법]
목표 정체성:
- 학습지는 분사가 명사를 수식하는 연습처럼 보여야 한다.

선호 경향:
- "빠르게 달리는 소년", "영어로 쓰인 책" 같은 구조를 우선한다.
- 현재분사와 과거분사가 명사를 직접 수식하는 모습이 여러 문항에서 보이게 한다.
- 일부 혼합형은 허용하되, 중심은 분사 수식으로 유지한다.

이탈 방지:
- 세트 전체가 일반 관계절 연습으로 바뀌지 않게 한다.
- 목표 문법과 무관한 평범한 진술문이 다수를 차지하지 않게 한다.
`.trim(),

    causative: isEn ? `
[Chapter Rule Card: Causative Verbs]
- Keep real causative meaning visible.
- Prefer make / let / have / help / get in natural classroom sentences.
- Do not paraphrase causatives away into ordinary statements.
`.trim() : `
[Chapter Rule Card: 사역동사]
- 실제 사역 의미가 문장에 보이게 한다.
- make / let / have / help / get 을 자연스러운 수업용 문장 안에서 활용한다.
- 사역 구조를 일반 평서문으로 바꿔서 흐리지 않는다.
`.trim(),

    so_that_purpose: isEn ? `
[Chapter Rule Card: so that Purpose]
- Keep purpose meaning visible.
- Prefer complete so that + subject + can/could/will/would structures.
- Allow natural variation in tense and subject, but keep the purpose clause complete.
- Do not leave the sentence hanging after so that.
`.trim() : `
[Chapter Rule Card: so that 구문 (목적)]
- 목적 의미가 문장에 분명히 보이게 한다.
- 완전한 so that + 주어 + can/could/will/would 구조를 우선한다.
- 시제와 주어는 자연스럽게 변주하되, 목적절은 완전하게 유지한다.
- so that 뒤를 미완성으로 끝내지 않는다.
`.trim(),

    to_infinitive: isEn ? `
[Chapter Rule Card: To-Infinitive]
- Keep to + base verb visible.
- Allow natural uses such as purpose, noun modifier, or complement if classroom-relevant.
- Do not drift so heavily into gerunds that the chapter identity becomes unclear.
`.trim() : `
[Chapter Rule Card: to부정사]
- to + 동사원형 구조가 여러 문항에서 분명히 보이게 한다.
- 목적, 보어, 명사수식 등 수업 맥락상 자연스러운 쓰임을 허용한다.
- 동명사 쪽으로 너무 많이 흘러 챕터 정체성이 흐려지지 않게 한다.
`.trim(),

    gerund: isEn ? `
[Chapter Rule Card: Gerund]
- Keep the -ing form functioning as a noun visible.
- Prefer common classroom patterns such as enjoy ~ing, like ~ing, finish ~ing.
- Do not drift too heavily into infinitive-only practice.
`.trim() : `
[Chapter Rule Card: 동명사]
- -ing가 명사 역할을 하는 구조가 분명히 보이게 한다.
- enjoy ~ing, like ~ing, finish ~ing 같은 학교 친화적 패턴을 우선한다.
- to부정사 연습으로 과도하게 흘러가지 않게 한다.
`.trim(),

    passive: isEn ? `
[Chapter Rule Card: Passive Voice]
- Keep be + past participle visible.
- Prefer natural passive sentences used in classroom English.
- Do not replace most passives with active paraphrases.
`.trim() : `
[Chapter Rule Card: 수동태]
- be + 과거분사 구조가 분명히 보이게 한다.
- 학교 영어에서 자연스러운 수동 문장을 우선한다.
- 대부분의 문항을 능동 재진술로 바꾸지 않는다.
`.trim(),

    present_perfect: isEn ? `
[Chapter Rule Card: Present Perfect]
- Keep have/has + past participle visible.
- Prefer unfinished-time or experience meanings that fit classroom use.
- Avoid finished past-time conflicts.
`.trim() : `
[Chapter Rule Card: 현재완료]
- have/has + 과거분사 구조가 분명히 보이게 한다.
- 경험, 계속, 결과 등 수업용으로 자연스러운 의미를 우선한다.
- finished past-time 표현과 충돌하지 않게 한다.
`.trim(),

    comparative: isEn ? `
[Chapter Rule Card: Comparatives]
- Keep comparative meaning visible.
- Prefer full, natural comparative sentences rather than clipped fragments.
`.trim() : `
[Chapter Rule Card: 비교급]
- 비교 의미가 분명히 드러나게 한다.
- 잘린 조각보다 완전하고 자연스러운 비교급 문장을 우선한다.
`.trim(),

    superlative: isEn ? `
[Chapter Rule Card: Superlatives]
- Keep superlative meaning clearly visible.
- Prefer full noun phrases and natural comparison frames.
- Do not drift into plain descriptive sentences.
`.trim() : `
[Chapter Rule Card: 최상급]
- 최상급 의미가 분명히 드러나게 한다.
- 완전한 명사구와 자연스러운 비교 범위를 우선한다.
- 단순 묘사문으로 흐르지 않는다.
`.trim(),

    general: isEn ? `
[Chapter Rule Card: General Grammar Workbook]
- Keep the requested grammar visible.
- Prefer school-friendly, teachable sentence patterns.
- Keep the worksheet natural and stable across runs.
`.trim() : `
[Chapter Rule Card: 일반 문법 워크북]
- 요청된 문법 포인트가 문항에 분명히 보이게 한다.
- 학교·학원 수업에 바로 쓸 수 있는 문장 패턴을 우선한다.
- 매번 출력이 지나치게 흔들리지 않게 안정적으로 유지한다.
`.trim(),
  };

  return cards[focus.chapterKey] || cards.general;
}

function buildModeRuleCardBlock(input) {
  const isEn = input.language === "en";

  const cards = {
    writing: isEn ? `
[Mode Rule Card: Writing Lab]
- Keep guided composition central.
- Use generous clues and visible structure support.
- Let learners build full sentences, not just identify answers.
- Keep the worksheet premium, teacher-friendly, and productive.
`.trim() : `
[Mode Rule Card: Writing Lab]
- guided composition 중심을 유지한다.
- clue와 구조 힌트를 충분히 제공한다.
- 학습자가 정답을 고르는 것이 아니라 전체 문장을 만들어내게 한다.
- 결과물은 프리미엄, 교사 친화적, 생산형 워크북처럼 보여야 한다.
`.trim(),

    "magic-card": isEn ? `
[Mode Rule Card: Magic Card]
- Keep the worksheet compact, sharp, and quick to train with.
- Shorter clues are allowed, but the structure must remain teachable.
- Keep the grammar target visibly central.
`.trim() : `
[Mode Rule Card: 마커스매직카드]
- 워크북은 압축적이고 선명하며 빠르게 훈련할 수 있게 유지한다.
- clue는 조금 더 짧아도 되지만, 구조 학습성은 유지한다.
- 목표 문법이 문항 중심에 분명히 보이게 한다.
`.trim(),

    abcstarter: isEn ? `
[Mode Rule Card: ABC Starter]
- Keep sentences shorter and lighter.
- Use very gentle scaffolding.
- Prefer simple, school-friendly vocabulary.
- Keep answers especially natural and easy to read aloud.
`.trim() : `
[Mode Rule Card: ABC Starter]
- 문장을 더 짧고 가볍게 유지한다.
- scaffolding을 매우 친절하게 제공한다.
- 기초적이고 학교 친화적인 어휘를 우선한다.
- 정답 문장은 특히 소리 내어 읽기 쉬울 정도로 자연스럽게 만든다.
`.trim(),

    "textbook-grammar": isEn ? `
[Mode Rule Card: Textbook Grammar]
- Keep the worksheet aligned with school grammar expectations.
- Prefer familiar topics, classroom situations, and teachable vocabulary.
- Keep it guided rather than tricky.
`.trim() : `
[Mode Rule Card: 교과서 문법]
- 학교 문법 기대치와 정렬된 워크북처럼 보이게 한다.
- 익숙한 주제, 수업 상황, 지도 가능한 어휘를 우선한다.
- 함정형보다 안내형으로 유지한다.
`.trim(),

    "chapter-grammar": isEn ? `
[Mode Rule Card: Chapter Grammar]
- Keep the chapter target highly visible across the set.
- Allow repetition for mastery, but vary sentence meaning and surface form.
- Keep the worksheet stable and teacher-usable.
`.trim() : `
[Mode Rule Card: 챕터 문법]
- 챕터 목표 문법이 세트 전체에서 뚜렷하게 보이게 한다.
- 숙달을 위한 반복은 허용하되, 의미와 겉문형은 적절히 다양화한다.
- 결과물은 안정적이고 교사 사용성이 높아야 한다.
`.trim(),

    magic: isEn ? `
[Mode Rule Card: Marcus Magic Standard]
- Keep the classic Marcus Magic balance: guided, productive, stable, and premium.
- Do not become too exam-like or too explanation-heavy.
`.trim() : `
[Mode Rule Card: Marcus Magic Standard]
- guided, productive, stable, premium의 균형을 유지하는 기본 Marcus Magic 스타일로 간다.
- 시험지처럼 과도하게 변형되거나 설명지처럼 무거워지지 않는다.
`.trim(),
  };

  return cards[input.mode] || cards.magic;
}

==================================================
[B] buildSystemPrompt 내부 1줄 교체
==================================================
기존 buildSystemPrompt 안에서 아래 부분을 찾으세요.

${buildGrammarRuleBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

이 4줄을 아래 7줄로 교체하세요.

${buildCoreRuleCardBlock(input)}
${buildChapterRuleCardBlock(input)}
${buildModeRuleCardBlock(input)}
${buildGrammarRuleBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

==================================================
[C] 선택적 미세 보정 1줄
==================================================
만약 buildSystemPrompt 안의 Quality control / 품질 관리 블록에
"Do not output broken, incomplete, or awkward sentences." 또는
"부자연스럽거나 미완성인 문장을 출력하지 말 것." 이 이미 있다면 유지하세요.

추가로 아래 한 줄만 덧붙이면 좋습니다.

EN:
- When chapter identity and surface variety conflict, preserve chapter identity first.

KO:
- 챕터 정체성과 표면적 다양성이 충돌하면, 표면적 다양성보다 챕터 정체성을 우선한다.

==================================================
[D] 이번 단계에서 하지 않는 것
==================================================
- validator 강화 안 함
- repair 추가 안 함
- regeneration 추가 안 함
- handler 수정 안 함
- MP 로직 수정 안 함
- formatMagicResponse 수정 안 함

==================================================
[E] 이번 단계의 기대 효과
==================================================
- 출력물의 Marcus Magic 공통 인상이 더 일정해짐
- 챕터별 정체성이 앞단에서 더 잘 고정됨
- 관계대명사 계속적 용법 / 분사의 한정적 용법 / so that / 사역동사 같은 챕터에서 drift 감소 기대
- 너무 강한 하드락이 아니라, 느슨하지만 분명한 steering 구조가 됨

