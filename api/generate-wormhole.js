// api/generate-wormhole.js

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
const DEFAULT_TRIAL_MP = Number(process.env.MEMBERSTACK_TRIAL_MP || 15);

// --- 핵심 데이터: TEXTBOOK_GRAMMAR_MAP (중1~중3 전체 확장 및 Special 제외) ---
const TEXTBOOK_GRAMMAR_MAP = {
  middle: {
    "천재소영순": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행 시제", "조동사 will", "조동사 can"],
        3: ["의문사 의문문", "to부정사의 명사적 용법"],
        4: ["과거시제", "동명사"],
        5: ["비교급", "최상급"],
        6: ["to부정사의 부사적 용법", "접속사 that"],
        7: ["수여동사", "접속사 when"]
      },
      "중2": {
        1: ["접속사 if", "의문사 to부정사"],
        2: ["to부정사의 형용사적 용법", "주격 관계대명사"],
        3: ["수동태", "접속사 although"],
        4: ["현재완료", "so ~ that 구문"],
        5: ["5형식 문장(make/keep 목적어 형용사)", "간접의문문"],
        6: ["지각동사", "준사역동사"],
        7: ["사역동사", "it ~ to부정사 구문"],
        8: ["something 형용사", "목적격 관계대명사"]
      }
    },
    "천재이상기": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행 시제", "의문문"],
        3: ["명령문", "조동사 can", "조동사 will"],
        4: ["과거시제", "감탄문"],
        5: ["there is(are) 구문", "동명사"],
        6: ["접속사 that", "to부정사의 명사적 용법"],
        7: ["감각동사", "비교급"],
        8: ["접속사 when", "to부정사의 부사적 용법"]
      },
      "중2": {
        1: ["수여동사", "something 형용사"],
        2: ["접속사 because", "의문사 to부정사"],
        3: ["현재완료", "to부정사의 형용사적 용법"],
        4: ["최상급", "준사역동사"],
        5: ["주격 관계대명사", "지각동사"],
        6: ["수동태", "so ~ that 구문"],
        7: ["목적격 관계대명사", "수량형용사"],
        8: ["접속사 if", "it ~ to부정사 구문"]
      }
    },
    "지학사송미정": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행 시제", "there is(are) 구문"],
        3: ["조동사 can", "감각동사"],
        4: ["과거시제", "조동사 will"],
        5: ["비교급", "최상급", "접속사 that"],
        6: ["to부정사의 명사적 용법", "동명사"],
        7: ["to부정사의 부사적 용법", "접속사 when"],
        8: ["접속사 because", "조동사 have to"]
      },
      "중2": {
        1: ["5형식 문장", "to부정사의 형용사적 용법"],
        2: ["접속사 if", "주격 관계대명사"],
        3: ["현재완료", "수여동사"],
        4: ["사역동사", "so ~ that 구문"],
        5: ["지각동사", "목적격 관계대명사"],
        6: ["수동태", "준사역동사"],
        7: ["접속사 while", "not only A but also B"],
        8: ["접속사 since", "간접의문문"]
      }
    },
    "비상황종배": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["there is(are) 구문", "현재진행 시제"],
        3: ["과거시제"],
        4: ["수여동사", "조동사 will", "조동사 can"],
        5: ["동명사", "감각동사"],
        6: ["접속사 when", "비교급"],
        7: ["to부정사의 명사적 용법", "감탄문"],
        8: ["to부정사의 부사적 용법", "접속사 that"]
      },
      "중2": {
        1: ["최상급", "5형식 문장(keep)"],
        2: ["주격 관계대명사", "준사역동사"],
        3: ["현재완료", "수동태"],
        4: ["사역동사(make)", "to부정사의 형용사적 용법"],
        5: ["as ~ as 원급비교", "목적격 관계대명사"],
        6: ["if 조건절", "지각동사"],
        7: ["so ~ that 구문", "it ~ to 구문"],
        8: ["not only ~ but also", "간접의문문"]
      }
    },
    "미래엔문영인": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행형", "there is(are) 구문"],
        3: ["과거시제", "조동사 can"],
        4: ["동명사", "조동사 will"],
        5: ["수여동사", "조동사 should"],
        6: ["to부정사의 명사적 용법", "접속사 when"],
        7: ["비교급", "최상급"]
      },
      "중2": {
        1: ["주격 관계대명사", "something 형용사"],
        2: ["목적격 관계대명사", "to부정사의 부사적 용법"],
        3: ["수동태", "접속사 if"],
        4: ["준사역동사", "it ~ to부정사 구문"],
        5: ["to부정사의 형용사적 용법", "현재완료"],
        6: ["지각동사", "사역동사"],
        7: ["so ~ that 구문", "분사의 용법"],
        8: ["간접의문문", "의문사 to부정사"]
      }
    },
    "동아이병민": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["의문문", "명령문"],
        3: ["조동사 can", "조동사 will", "현재진행시제"],
        4: ["과거시제", "there is(are) 구문"],
        5: ["want to부정사", "비인칭주어 it"],
        6: ["감각동사", "동명사를 취하는 동사"],
        7: ["비교급", "접속사 when"],
        8: ["수여동사", "접속사 that"]
      },
      "중2": {
        1: ["to부정사의 형용사적 용법", "최상급"],
        2: ["접속사 if", "수동태"],
        3: ["주격 관계대명사", "5형식 문장(keep, make)"],
        4: ["현재완료", "준사역동사"],
        5: ["it ~ to 구문", "the 비교급, the 비교급"],
        6: ["수의 일치", "지각동사"],
        7: ["목적격 관계대명사", "접속사 although"],
        8: ["의문사 to부정사", "so ~ that 구문"]
      },
      "중3": {
        1: ["to부정사의 의미상의 주어", "관계대명사 what"],
        2: ["주어동사 수일치", "조동사의 수동태"],
        3: ["사역동사", "It ~ that 강조구문"],
        4: ["the 비교급, the 비교급", "접속사 since"],
        5: ["가정법 과거", "의문사 to부정사"],
        6: ["too ~ to 구문", "형용사 + enough 구문", "so that 구문"],
        7: ["접속사 as", "접속사 while", "접속사 since", "소유격 관계대명사"],
        8: ["분사구문", "과거완료"]
      }
    },
    "동아윤정미": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행시제", "조동사 can", "조동사 will"],
        3: ["과거시제", "명령문"],
        4: ["동명사를 취하는 동사", "be going to"],
        5: ["비교급", "최상급", "there is(are)"],
        6: ["want to부정사", "접속사 that"],
        7: ["to부정사의 부사적 용법", "접속사 when"],
        8: ["수여동사", "비인칭주어 it"]
      },
      "중2": {
        1: ["to부정사의 형용사적 용법", "5형식의 문장(make)"],
        2: ["목적격 관계대명사", "준사역동사"],
        3: ["수동태", "조동사 have to"],
        4: ["주격 관계대명사", "접속사 if"],
        5: ["접속사 that", "조동사 used to"],
        6: ["지각동사", "so ~ that 구문"],
        7: ["it ~ to 구문", "5형식의 문장(call)"],
        8: ["현재완료", "something 형용사"]
      },
      "중3": {
        1: ["접속사 whether", "접속사 if", "to부정사의 형용사적 용법"],
        2: ["사역동사", "so that 구문"],
        3: ["관계대명사의 계속적 용법", "It ~ that 강조구문", "가주어 진주어 구문"],
        4: ["현재완료 진행형", "의문사 + to부정사"],
        5: ["분사의 한정적 용법", "원급비교"],
        6: ["과거완료", "관계대명사 what"],
        7: ["분사구문", "접속사 as"],
        8: ["to부정사의 의미상의 주어", "가정법 과거"]
      }
    },
    "능률김기택": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행 시제", "동명사"],
        3: ["과거시제", "접속사 when"],
        4: ["to부정사의 명사적 용법", "조동사 should", "조동사 will"],
        5: ["재귀대명사", "to부정사의 부사적 용법"],
        6: ["감각동사", "접속사 because"],
        7: ["5형식의 문장", "접속사 that"],
        8: ["감탄문", "something 형용사"]
      },
      "중2": {
        1: ["4형식 문장", "주격 관계대명사"],
        2: ["현재완료", "비교급", "최상급"],
        3: ["to부정사의 형용사적 용법", "접속사 if"],
        4: ["so ~ that 구문", "수동태"],
        5: ["준사역동사", "목적격 관계대명사"],
        6: ["지각동사", "관계부사 how"],
        7: ["사역동사", "원급 비교구문"],
        8: ["it ~ to 구문", "의문사 + to부정사"]
      }
    },
    "YBM김은형": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["be동사 의문문", "일반동사 의문문", "현재진행 시제"],
        3: ["과거시제", "조동사 will"],
        4: ["동명사", "there is(are) 구문"],
        5: ["to부정사의 명사적 용법", "재귀대명사"],
        6: ["접속사 when", "조동사 should"],
        7: ["비교급", "최상급"],
        8: ["수여동사", "to부정사의 부사적 용법"]
      },
      "중2": {
        1: ["접속사 that", "to부정사의 형용사적 용법"],
        2: ["현재완료", "비교급 수식"],
        3: ["주격 관계대명사", "need to"],
        4: ["접속사 after", "접속사 before", "수동태"],
        5: ["사역동사", "목적격 관계대명사"],
        6: ["접속사 if", "it ~ to 구문"],
        7: ["분사", "분사구문", "how to부정사"],
        8: ["간접의문문", "지각동사"]
      }
    },
    "YBM박준언": {
      "중1": {
        1: ["be동사", "일반동사"],
        2: ["현재진행 시제", "조동사 will", "조동사 can"],
        3: ["과거시제", "명령문"],
        4: ["to부정사의 명사적 용법", "접속사 when"],
        5: ["비교급", "감각동사"],
        6: ["동명사", "수여동사"],
        7: ["접속사 that", "감탄문"],
        8: ["재귀대명사", "to부정사의 부사적 용법"]
      },
      "중2": {
        1: ["최상급", "to부정사의 형용사적 용법"],
        2: ["접속사 if", "사역동사"],
        3: ["주격 관계대명사", "의문사 + to부정사"],
        4: ["비교급 수식어", "수동태"],
        5: ["it ~ to 구문", "명령문 and(or)"],
        6: ["현재완료", "접속사 although"],
        7: ["준사역동사", "목적격 관계대명사"],
        8: ["원급비교", "so ~ that 구문"]
      },
      "중3": {
        1: ["강조의 do", "관계대명사 what"],
        2: ["현재완료진행형", "분사의 한정적 용법"],
        3: ["it ~ that 강조구문", "have + 사물 + p.p."],
        4: ["to부정사의 의미상의 주어", "가정법 과거"],
        5: ["과거완료", "so ~ that 구문", "so that 구문"],
        6: ["관계대명사의 계속적 용법", "to부정사의 부사적 용법"],
        7: ["the 비교급, the 비교급", "관계부사"],
        8: ["분사구문", "동명사의 관용표현"],
        9: ["I wish 가정법", "간접의문문 whether"]
      }
    },
    "천재정사열": {
      "중3": {
        1: ["간접의문문", "관계대명사의 계속적 용법"],
        2: ["과거완료", "비교급 강조"],
        3: ["enough to", "not only A but also B"],
        4: ["분사구문", "관계대명사 what"],
        5: ["가정법 과거", "관계대명사 whose"],
        6: ["the 비교급, the 비교급", "It is ~ that 강조"],
        7: ["간접화법", "명사절 if"],
        8: ["부정대명사", "준사역동사"]
      }
    },
    "천재이재영": {
      "중3": {
        1: ["관계대명사 what", "지각동사"],
        2: ["분사의 후치수식", "접속사 since", "접속사 though"],
        3: ["현재완료진행", "so ~ that 구문"],
        4: ["관계부사", "접속사 if", "접속사 whether"],
        5: ["과거완료", "It is ~ that 강조"],
        6: ["to부정사의 의미상의 주어", "가정법 과거"],
        7: ["분사구문", "조동사가 포함된 수동태"],
        8: ["조동사 have p.p.", "관계대명사의 계속적 용법"]
      }
    },
    "지학사민찬규": {
      "중3": {
        1: ["관계대명사 what", "지각동사"],
        2: ["가주어 it의 의미상의 주어", "분사의 한정적 용법"],
        3: ["not only A but also B", "간접의문문"],
        4: ["과거완료", "to부정사의 부사적 용법"],
        5: ["대명사 one", "분사구문"],
        6: ["It is ~ that 강조", "however"],
        7: ["가정법 과거", "5형식 문장"],
        8: ["too ~ to 구문", "no one 구문"]
      }
    },
    "비상김진완": {
      "중3": {
        1: ["관계대명사 what", "관계부사"],
        2: ["to부정사의 의미상의 주어", "현재완료진행형"],
        3: ["접속사 whether", "접속사 if", "과거완료"],
        4: ["분사의 한정적 용법", "가목적어 it"],
        5: ["분사구문", "so that 구문"],
        6: ["it ~ that 강조구문", "have + 사물 + p.p."],
        7: ["접속사 as", "수의 일치"],
        8: ["가정법 과거", "with + 목적어 + 분사"]
      }
    },
    "미래엔최연희": {
      "중3": {
        1: ["관계대명사 what", "접속사 although"],
        2: ["it ~ that 강조구문", "관계대명사의 계속적 용법"],
        3: ["분사의 한정적 용법", "강조의 do"],
        4: ["간접의문문", "과거완료"],
        5: ["분사구문", "not only A but also B"],
        6: ["관계부사", "접속부사 however", "thus"],
        7: ["소유격 관계대명사", "가정법 과거"]
      }
    },
    "능률양현권": {
      "중3": {
        1: ["가주어 it의 의미상의 주어", "관계대명사의 계속적 용법"],
        2: ["it ~ that 강조구문", "5형식 문장"],
        3: ["관계대명사 what", "사역동사"],
        4: ["분사구문", "과거완료"],
        5: ["의문사 + to부정사", "the 비교급, the 비교급"],
        6: ["간접화법", "지각동사"],
        7: ["가정법 과거", "so ~ that 구문"]
      }
    },
    "능률김성곤": {
      "중3": {
        1: ["현재완료 진행형", "관계대명사 what"],
        2: ["관계대명사의 계속적 용법", "분사의 한정적 용법"],
        3: ["접속사 since", "과거완료"],
        4: ["접속사 whether", "접속사 if", "조동사의 수동태"],
        5: ["to부정사의 의미상의 주어", "관계부사 where"],
        6: ["the 비교급, the 비교급", "분사구문"],
        7: ["가정법 과거", "so that 구문"]
      }
    },
    "금성최인철": {
      "중3": {
        1: ["사역동사", "동명사의 관용적 표현"],
        2: ["the 비교급, the 비교급", "to부정사의 의미상의 주어"],
        3: ["not only A but also B", "I wish 가정법"],
        4: ["과거완료", "as ~ as 원급비교"],
        5: ["so ~ that 구문", "지각동사"],
        6: ["it ~ that 강조구문", "분사구문"],
        7: ["형용사 + to부정사", "so 동사 주어"],
        8: ["접속사 whether", "It's time 가정법"]
      }
    },
    "YBM송미정": {
      "중3": {
        1: ["too ~ to 구문", "to부정사의 부정표현"],
        2: ["분사구문", "명사절 if"],
        3: ["the 비교급, the 비교급", "it ~ that 강조구문"],
        4: ["접속사 although", "it seems to 구문"],
        5: ["관계대명사 what", "현재완료 진행"],
        6: ["원급비교", "과거완료"],
        7: ["가정법 과거", "so that 구문"],
        8: ["접속사 while", "not only A but also B"]
      }
    }
  }
};

// --- 유틸리티 함수 ---

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function sanitizeCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 25;
  return clamp(Math.round(num), 5, 30);
}

function sanitizeMp(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 0, 999999);
}

function inferLanguage(text = "") {
  const t = String(text || "");
  const koreanMatches = t.match(/[가-힣]/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();
  if (/초등|초[1-6]|abc\s*starter|elementary/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|모의고사|high/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";
  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/최고난도|고난도|극상|advanced|extreme/.test(t)) return "advanced";
  if (/변형|transform|rewrite|재구성/.test(t)) return "transform";
  if (/내신|학교시험|중간고사|기말고사|school/.test(t)) return "school-exam";
  return "grammar";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";
  return "high";
}

function inferTopic(text = "") {
  const t = String(text || "");
  const topicPatterns = [
    "현재완료", "현재진행형", "과거완료", "수동태", "관계대명사", "관계부사",
    "동명사", "to부정사", "가정법", "비교급", "최상급", "수일치", "조동사",
    "시제", "접속사", "분사", "분사구문", "부정대명사", "대명사", "명사절",
    "형용사절", "부사절", "전치사", "도치", "강조구문"
  ];
  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }
  const lower = t.toLowerCase();
  if (/present perfect/.test(lower)) return "현재완료";
  if (/passive/.test(lower)) return "수동태";
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/gerund/.test(lower)) return "동명사";
  if (/infinitive|to-infinitive/.test(lower)) return "to부정사";
  if (/subjunctive/.test(lower)) return "가정법";
  if (/tense/.test(lower)) return "시제";
  return "문법 종합";
}

function inferGradeLabel(text = "", level = "middle") {
  const t = String(text || "");
  if (/초1/.test(t)) return "초1";
  if (/초2/.test(t)) return "초2";
  if (/초3/.test(t)) return "초3";
  if (/초4/.test(t)) return "초4";
  if (/초5/.test(t)) return "초5";
  if (/초6/.test(t)) return "초6";
  if (/중1/.test(t)) return "중1";
  if (/중2/.test(t)) return "중2";
  if (/중3/.test(t)) return "중3";
  if (/고1/.test(t)) return "고1";
  if (/고2/.test(t)) return "고2";
  if (/고3/.test(t)) return "고3";
  if (level === "elementary") return "초등";
  if (level === "high") return "고등";
  return "중등";
}

// --- 보정 추가: normalizeGrammarLabel ---
function normalizeGrammarLabel(label = "") {
  const t = String(label || "").trim();
  const replacements = {
    "현재진행형": "현재진행 시제",
    "현재진행시제": "현재진행 시제",
    "to부정사의 명사적용법": "to부정사의 명사적 용법",
    "to부정사의 부사적용법": "to부정사의 부사적 용법",
    "to부정사의 형용사적용법": "to부정사의 형용사적 용법",
    "want to부정사(명사적)": "want to부정사",
    "조동사 will(미래시제)": "조동사 will",
    "4형식 문장": "수여동사",
    "5형식 문장": "5형식의 문장",
    "it ~ to 구문": "it ~ to부정사 구문",
    "it ~to 가주어, 진주어 구문": "it ~ to부정사 구문",
    "가주어,진주어": "가주어 진주어 구문",
    "현재완료진행": "현재완료 진행형",
    "현재완료 진행": "현재완료 진행형",
    "It is ~ that 강조": "It ~ that 강조구문",
    "It is – that 강조": "It ~ that 강조구문",
    "It – that 강조": "It ~ that 강조구문",
    "it – that 강조": "it ~ that 강조구문",
    "the 비교급, the 비교급": "the 비교급, the 비교급",
    "원급 비교구문": "원급비교",
    "as ~ as 원급비교": "원급비교",
    "분사의 후치수식": "분사의 한정적 용법",
    "분사(수식형)": "분사",
    "동명사의 관용적 표현": "동명사의 관용표현",
  };
  return replacements[t] || t;
}

// --- 보정 추가: normalizePublisherName (별칭 감지 강화) ---
function normalizePublisherName(text = "") {
  const t = String(text || "").replace(/\s+/g, "");
  const aliasMap = {
    "천재소영순": ["천재소영순", "천재소", "소영순"],
    "천재이상기": ["천재이상기", "이상기"],
    "지학사송미정": ["지학사송미정", "송미정지학", "지학송", "송미정"],
    "비상황종배": ["비상황종배", "비상황", "황종배"],
    "미래엔문영인": ["미래엔문영인", "문영인"],
    "동아이병민": ["동아이병민", "이병민"],
    "동아윤정미": ["동아윤정미", "동아윤", "윤정미"],
    "능률김기택": ["능률김기택", "김기택"],
    "YBM김은형": ["YBM김은형", "ybm김은형", "김은형"],
    "YBM박준언": ["YBM박준언", "ybm박준언", "박준언"],
    "천재정사열": ["천재정사열", "정사열"],
    "천재이재영": ["천재이재영", "이재영"],
    "지학사민찬규": ["지학사민찬규", "민찬규"],
    "비상김진완": ["비상김진완", "김진완"],
    "미래엔최연희": ["미래엔최연희", "최연희"],
    "능률양현권": ["능률양현권", "양현권"],
    "능률김성곤": ["능률김성곤", "김성곤"],
    "금성최인철": ["금성최인철", "최인철"],
    "YBM송미정": ["YBM송미정", "ybm송미정", "송미정ybm"]
  };
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    if (aliases.some(alias => t.includes(alias.replace(/\s+/g, "")))) {
      return canonical;
    }
  }
  return "";
}

// --- 보정 추가: detectTextbookRequest (입력 감지 강화) ---
function detectTextbookRequest(text = "") {
  const source = String(text || "").replace(/\s+/g, "");
  const gradeMatch = source.match(/중([123])/);
  const publisher = normalizePublisherName(source);
  const lessonMatch =
    source.match(/([1-9]|10)과/) ||
    source.match(/([1-9]|10)단원/) ||
    source.match(/lesson([1-9]|10)/i) ||
    source.match(/lesson\s*([1-9]|10)/i);

  if (!gradeMatch || !lessonMatch || !publisher) return null;

  return {
    level: "middle",
    gradeLabel: `중${gradeMatch[1]}`,
    publisher,
    lesson: Number(lessonMatch[1])
  };
}

// --- 보정 추가: resolveTextbookGrammar (표준화 반영) ---
function resolveTextbookGrammar(textbookInfo) {
  if (!textbookInfo) return null;
  const levelMap = TEXTBOOK_GRAMMAR_MAP[textbookInfo.level];
  const publisherMap = levelMap?.[textbookInfo.publisher];
  const gradeMap = publisherMap?.[textbookInfo.gradeLabel];
  const rawGrammarList = gradeMap?.[textbookInfo.lesson];
  if (!rawGrammarList || !rawGrammarList.length) return null;
  const grammarList = rawGrammarList
    .map(normalizeGrammarLabel)
    .filter(Boolean);

  if (!grammarList.length) return null;
  return {
    ...textbookInfo,
    grammarList,
    combinedTopic: grammarList.join(" + "),
    isCombined: grammarList.length >= 2
  };
}

function normalizeInput(body = {}) {
  const userPrompt = sanitizeString(body.userPrompt || body.prompt || "");
  const mergedText = [
    userPrompt,
    sanitizeString(body.topic || ""),
    sanitizeString(body.mode || ""),
    sanitizeString(body.level || ""),
    sanitizeString(body.difficulty || ""),
    sanitizeString(body.examType || ""),
    sanitizeString(body.worksheetTitle || "")
  ].filter(Boolean).join(" ");
  const textbookRequest = detectTextbookRequest(mergedText);
  const textbookResolved = resolveTextbookGrammar(textbookRequest);

  const level = ["elementary", "middle", "high"].includes(body.level)
    ? body.level
    : (textbookResolved?.level || inferLevel(mergedText));

  const mode = ["grammar", "transform", "school-exam", "advanced", "textbook-chapter"].includes(body.mode)
    ? body.mode
    : (textbookResolved ? "textbook-chapter" : inferMode(mergedText));

  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);

  const language = ["ko", "en"].includes(body.language)
    ? body.language
    : inferLanguage(mergedText);

  const topic =
    sanitizeString(body.topic || "") ||
    textbookResolved?.combinedTopic ||
    inferTopic(mergedText);

  const examType =
    sanitizeString(body.examType || "") ||
    (textbookResolved ? "textbook-school" : "school");

  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const engine = "wormhole";
  const gradeLabel = textbookResolved?.gradeLabel || inferGradeLabel(mergedText, level);

  return {
    engine,
    level,
    mode,
    topic,
    examType,
    difficulty,
    count,
    language,
    worksheetTitle,
    academyName,
    userPrompt,
    gradeLabel,
    textbook: textbookResolved || null
  };
}

function getDifficultyLabel(difficulty, language = "ko") {
  if (language === "en") {
    if (difficulty === "extreme") return "Extreme Difficulty";
    if (difficulty === "high") return "High Difficulty";
    if (difficulty === "standard") return "Standard Difficulty";
    return "Basic Difficulty";
  }
  if (difficulty === "extreme") return "최고난도";
  if (difficulty === "high") return "고난도";
  if (difficulty === "standard") return "표준난도";
  return "기본난도";
}

// --- 보정 추가: 제목 축약 로직 ---
function shortenTopicForTitle(topic = "") {
  const parts = String(topic).split("+").map(v => v.trim()).filter(Boolean);
  if (parts.length <= 2) return topic;
  return `${parts[0]} + ${parts[1]} 외`;
}

function buildWormholeTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const displayTopic = shortenTopicForTitle(input.topic);
  
  if (input.textbook) {
    if (input.language === "en") {
      return `${input.textbook.gradeLabel} ${input.textbook.publisher} Lesson ${input.textbook.lesson} ${displayTopic} Wormhole ${difficultyLabel} ${input.count} Questions`;
    }
    return `${input.textbook.gradeLabel} ${input.textbook.publisher} ${input.textbook.lesson}과 ${displayTopic} 마커스웜홀 ${difficultyLabel} ${input.count}문항`;
  }
  if (input.language === "en") {
    return `${input.gradeLabel} ${displayTopic} Wormhole ${difficultyLabel} ${input.count} Questions`;
  }
  return `${input.gradeLabel} ${displayTopic} 마커스웜홀 ${difficultyLabel} ${input.count}문항`;
}

// --- 보정 추가: buildGrammarSystemPrompt (결합형 강화) ---
function buildGrammarSystemPrompt(input) {
  const textbookBlock = input.textbook
    ? `
[교과서 단원형 규칙]
- 이 문제 세트는 ${input.textbook.gradeLabel} ${input.textbook.publisher} ${input.textbook.lesson}과 기반이다.
- 해당 단원의 문법 요소는 다음과 같다: ${input.textbook.grammarList.join(", ")}
- 반드시 위 문법 요소들을 고르게 반영할 것.
- 전체 문항의 최소 30%는 두 문법 요소를 동시에 판단하게 하는 결합형 문제로 만들 것.
- 나머지 문항은 각 문법 요소를 균형 있게 단독 평가하되, 어느 한쪽 문법만 과도하게 반복하지 말 것.
- 전체 문항이 실제 중등 내신형 문법 시험처럼 보이게 할 것.
`
    : "";
  return `당신은 영어 교육자이자 전문 문항 출제 위원입니다.
학생들의 변별력을 높이기 위한 정교한 영어 문법 문제를 제작합니다.
${textbookBlock}

[문항 설계 기준]
반드시 아래 유형을 골고루 포함할 것:
- 어색한 문장 찾기
- 올바른 문장의 개수
- 어색한 문장의 개수
- 같은 문법 구조 찾기
- 밑줄 어법 판단
- 문장 배열
- 문장 재구성
- 빈칸 어법

[중요 사항]
- 전체 문항 중 최소 2문항은 개수형 문제를 포함할 것.
- 전체 문항의 최소 25%는 고난도 문항으로 구성할 것.
- 고난도 문항 앞에는 반드시 [High Difficulty]라고 표기할 것.
- 결합 문법이 주어졌다면, 각 문법 요소가 한쪽으로 치우치지 않게 반영될 것.
- 문제는 단순 암기형이 아니라 문맥 판단형, 구조 판단형, 변형형 중심으로 구성할 것.
- 선지는 지나치게 쉬운 obvious distractor를 피하고, 실제 학교 시험처럼 변별력이 있게 만들 것.

[금지 사항]
- 단순 암기로 풀 수 있는 단답형 문제 금지
- obvious distractors 금지
- 한눈에 답이 보이는 쉬운 문제 금지

응답 형식:
[[TITLE]]
{제목}
[[INSTRUCTIONS]]
{지시문}
[[QUESTIONS]]
1. {문제}
[[ANSWERS]]
1. {정답 및 해설}`.trim();
}

// --- 보정 추가: buildGrammarUserPrompt (결합형 강화) ---
function buildGrammarUserPrompt(input) {
  const title = buildWormholeTitle(input);
  const textbookBlock = input.textbook
    ? `
[교과서 정보]
- 학년: ${input.textbook.gradeLabel}
- 교과서: ${input.textbook.publisher}
- 단원: ${input.textbook.lesson}과
- 결합 문법: ${input.textbook.grammarList.join(", ")}
- 이 단원은 결합형 문항을 포함한 교과서 단원형으로 출제할 것
`
    : "";
  return `마커스웜홀 스타일 영어 문법 문제 세트를 생성하시오.

제목: ${title}
주제: ${input.topic}
대상: ${input.gradeLabel}
문항 수: ${input.count}
언어: ${input.language === "ko" ? "한국어 해설" : "English Explanation"}

${textbookBlock}

[문항 설계]
반드시 아래 유형을 포함할 것:
- 어색한 문장 찾기
- 올바른 문장의 개수
- 어색한 문장의 개수
- 같은 문법 구조 찾기
- 밑줄 어법 판단
- 문장 배열
- 문장 재구성
- 빈칸 어법

[중요]
- 최소 2문항은 개수형 문제 포함
- 최소 25%는 고난도
- 고난도는 [High Difficulty] 표시
- 교과서 결합 문법이 주어졌다면 각 문법 요소를 고르게 반영할 것
- 전체 문항의 최소 30%는 두 문법 요소를 동시에 묻는 결합형 문제로 만들 것
- 나머지 문항도 실제 내신 시험처럼 선지형/개수형/배열형/재구성형을 고르게 섞을 것

[금지]
- 단순 암기 문제 금지
- obvious 문제 금지
- 한눈에 답 보이는 문제 금지

사용자 요청:
${input.userPrompt || ""}`.trim();
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.5, max_tokens: 8000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
  });
  if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  return end === -1 ? rawText.slice(from).trim() : rawText.slice(from, end).trim();
}

function countQuestions(text = "") {
  return (text.match(/^\s*\d+\./gm) || []).length;
}

function cleanupText(text = "") {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatWormholeResponse(rawText, input) {
  const title = cleanupText(extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]"));
  const instructions = cleanupText(extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]"));
  const questions = cleanupText(extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]"));
  const answers = cleanupText(extractSection(rawText, "[[ANSWERS]]", null));
  let finalTitle = title || buildWormholeTitle(input);
  return {
    title: finalTitle,
    instructions,
    content: cleanupText([finalTitle, instructions, questions].filter(Boolean).join("\n\n")),
    answerSheet: cleanupText(answers),
    fullText: cleanupText([finalTitle, instructions, questions, "정답 및 해설\n" + answers].filter(Boolean).join("\n\n")),
    actualCount: countQuestions(questions),
  };
}

// --- 교체된 Memberstack 블록 시작 ---

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
}

async function memberstackRequest(path, options = {}) {
  if (!MEMBERSTACK_SECRET_KEY) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": MEMBERSTACK_SECRET_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Memberstack failed: ${response.status}`);
  }

  return data;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) return null;

  const safeNextMp = sanitizeMp(nextMp, 0);
  const currentCustomFields = member?.customFields || {};
  const currentMetaData = member?.metaData || {};

  const body = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
    },
  };

  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return data?.data || null;
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) {
    return { ...mpState, deducted: false };
  }

  const currentMp = sanitizeMp(mpState.currentMp, 0);
  const requiredMp = sanitizeMp(mpState.requiredMp, 0);

  if (!Number.isFinite(currentMp) || !Number.isFinite(requiredMp)) {
    return { ...mpState, deducted: false };
  }

  const nextMp = Math.max(0, currentMp - requiredMp);
  const updatedMember = await updateMemberMp(mpState.member, nextMp);

  return {
    ...mpState,
    member: updatedMember || mpState.member,
    currentMp: nextMp,
    remainingMp: nextMp,
    deducted: true,
  };
}

async function prepareMpState(req) {
  const requiredMp = sanitizeMp(req.body?.mpCost, 5);
  const memberId = sanitizeString(req.body?.memberId || req.headers?.["x-member-id"] || "");

  if (!MEMBERSTACK_SECRET_KEY || !memberId) {
    return {
      enabled: false,
      reason: "member_not_provided",
      requiredMp,
    };
  }

  try {
    const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
      method: "GET",
    });

    const member = data?.data;
    if (!member) {
      return {
        enabled: false,
        reason: "member_not_found",
        requiredMp,
      };
    }

    const rawMp =
      member.customFields?.[MEMBERSTACK_MP_FIELD] ??
      member.metaData?.[MEMBERSTACK_MP_FIELD] ??
      member.customFields?.mp ??
      member.metaData?.mp ??
      null;

    let currentMp = Number(rawMp);

    if (rawMp == null || rawMp === "" || !Number.isFinite(currentMp)) {
      currentMp = DEFAULT_TRIAL_MP;
      await updateMemberMp(member, currentMp);
    }

    return {
      enabled: true,
      reason: "memberstack-synced",
      requiredMp,
      currentMp,
      remainingMp: currentMp,
      member,
      deducted: false,
    };
  } catch (e) {
    return {
      enabled: false,
      reason: "lookup_failed",
      requiredMp,
    };
  }
}

// --- 교체된 Memberstack 블록 끝 ---

export default async function handler(req, res) {
  addCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST only" });

  try {
    const input = normalizeInput(req.body || {});
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, message: "Prompt or topic required" });
    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP가 부족합니다.", requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp });
    }

    let systemPrompt, userPrompt;
    if (input.mode === "grammar" || input.mode === "textbook-chapter" || input.mode === "school-exam") {
      systemPrompt = buildGrammarSystemPrompt(input);
      userPrompt = buildGrammarUserPrompt(input);
    } else {
      systemPrompt = `당신은 상위권 변별력을 위한 고난도 영어 문법 문제 생성기입니다.
웜홀 원칙에 따라 출제하세요.`;
      userPrompt = buildGrammarUserPrompt(input);
    }

    const rawText = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatWormholeResponse(rawText, input);

    // --- 보정 추가: 문항 수 검수 로직 ---
    if (formatted.actualCount < input.count) {
      return json(res, 500, {
        success: false,
        message: `Question count mismatch: expected ${input.count}, got ${formatted.actualCount}`
      });
    }

    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      ...formatted,
      textbook: input.textbook,
      remainingMp: finalMpState?.remainingMp ?? null,
      mpSyncEnabled: Boolean(mpState.enabled)
    });
  } catch (error) {
    console.error("Handler Error:", error);
    return json(res, 500, { success: false, message: "Generation failed", detail: error.message });
  }
}
