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

// --- 핵심 데이터: TEXTBOOK_GRAMMAR_MAP ---
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

function buildGrammarSystemPrompt(input) {
  const isKo = input.language !== "en";
  const isHigh = input.difficulty === "high" || input.difficulty === "extreme";
  const difficultyLine = isHigh
    ? "모든 문항은 실제 내신 5점형 변별 문항처럼 출제한다."
    : "문항 난이도는 요청 수준에 맞춘다.";
  if (!isKo) {
    return `
You are the MARCUS Wormhole high-difficulty grammar exam generator.
STRICT RULES:
1. ALL questions must be 5-option multiple choice.
2. Every question must have exactly five choices:
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
3. Do NOT create 4-choice items.
4. Do NOT create subjective items, sentence arrangement items, rewrite items, or free-response items.
5. Do NOT place answers or explanations directly under the questions.
6. Put all answers only in the [[ANSWERS]] section.
7. Keep the worksheet exam-like, polished, and school-test appropriate.
8. Match the requested number of questions exactly.
- 반드시 정확히 ${input.count}문항을 작성할 것
- 1번부터 ${input.count}번까지 연속 번호를 유지할 것
- 누락 번호, 중복 번호 절대 금지
- [[QUESTIONS]]와 [[ANSWERS]]의 문항 수는 반드시 동일해야 함
- 문항 수가 부족하면 제출하지 말고 끝까지 채울 것

DIFFICULTY:
- ${isHigh ? "All questions must feel like real 5-point killer questions for top students." : "Keep the requested level."}
- Use grammar traps, structure judgment, tense contrast, relative clauses, participles, infinitives, gerunds, subject-verb agreement, and high-discrimination distractors.
- Wrong choices must be plausible, not silly.

QUESTION TYPE MIX:
Mix these question types across the whole set:
- find the awkward sentence
- count the correct sentences
- count the awkward sentences
- choose the grammatically correct sentence
- choose the grammatically incorrect sentence
- choose the sentence with the same grammar structure
- identify the underlined grammar point
- choose the best word/form for grammar usage
- high-difficulty discrimination item

Do not repeat the same pattern too many times in a row.
OUTPUT FORMAT:
[[TITLE]]
(one line only)

[[INSTRUCTIONS]]
(one short paragraph)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

2. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - explanation
2. ① - explanation
...
`.trim();
  }

  return `
당신은 마커스웜홀 전용 고난도 영어 문법 실전모의고사 생성 엔진이다.

[절대 규칙]
1. 모든 문항은 반드시 객관식 5지선다형으로 작성한다.
2. 모든 문항의 선택지는 반드시 다음 형식을 따른다.
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
3. 4지선다(a,b,c,d) 금지.
4. 주관식, 서술형, 문장 배열, 재구성, 영작형 금지.
5. 문제 바로 아래에 정답/해설을 쓰지 말 것.
6. 정답과 해설은 반드시 [[ANSWERS]] 섹션에만 모아 쓸 것.
7. 실제 학교시험/내신/고난도 실전모의고사처럼 보이게 작성할 것.
8. 요청된 문항 수를 정확히 맞출 것.
- 반드시 정확히 ${input.count}문항을 작성할 것
- 1번부터 ${input.count}번까지 연속 번호를 유지할 것
- 누락 번호, 중복 번호 절대 금지
- [[QUESTIONS]]와 [[ANSWERS]]의 문항 수는 반드시 동일해야 함
- 문항 수가 부족하면 제출하지 말고 끝까지 채울 것

[난이도 규칙]
- ${difficultyLine}
- 단순 암기형이 아니라 문장 구조와 어법 판단 중심으로 출제할 것.
- 오답 선지도 매우 그럴듯하게 만들 것.
- 변별력 있는 함정 선지를 포함할 것.
[유형 분배 규칙]
전체 세트에 아래 유형을 섞어서 출제한다.
- 어색한 문장 찾기
- 올바른 문장의 개수
- 어색한 문장의 개수
- 올바른 문장 고르기
- 틀린 문장 고르기
- 같은 문법 구조 찾기
- 밑줄 친 어법 판단
- 알맞은 어형/어휘 선택
- 고난도 변별 문항

같은 유형만 연속 반복하지 말 것.
[High Difficulty 규칙]
- 최소 25% 이상 문항은 고난도 변별 문항으로 설계한다.
- 해당 문항 제목 또는 문항 지시문에 [High Difficulty] 표기를 붙여도 된다.
- 단, 전체 세트의 기본 수준 자체가 고난도여야 한다.

[출력 형식]
[[TITLE]]
(제목 한 줄)

[[INSTRUCTIONS]]
(수험생 안내문 한 단락)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

2. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - 해설
2. ① - 해설
...
`.trim();
}

function buildGrammarUserPrompt(input) {
  const title = buildWormholeTitle(input);
  const textbookInfo = input.textbook ? `교과서: ${input.textbook.publisher}` : "교과서: 없음";
  const chapterInfo = input.textbook ? `단원: ${input.textbook.lesson}과` : "단원: 없음";
  const grammarList =
    input.textbook && input.textbook.grammarList && input.textbook.grammarList.length
      ? input.textbook.grammarList.join(", ")
      : input.topic || "문법 종합";

  const isHigh = input.difficulty === "high" || input.difficulty === "extreme";

  if (input.language === "en") {
    return `
Generate a Wormhole-style grammar worksheet with these conditions.
Title: ${title}
Engine: wormhole
Level: ${input.level}
Grade label: ${input.gradeLabel}
Mode: ${input.mode}
Topic: ${input.topic}
Difficulty: ${input.difficulty}
Question count: ${input.count}
${textbookInfo}
${chapterInfo}
Grammar points: ${grammarList}

CORE REQUIREMENTS:
- Make EVERY item a 5-option multiple-choice question.
- Every item must use exactly:
  ① ② ③ ④ ⑤
- Do not use a/b/c/d.
- Do not create sentence arrangement, rewrite, or subjective questions.
- Separate questions and answers completely.
- Use a balanced mix of real exam-style grammar discrimination types.
- ${isHigh ? "Make the set feel like a top-tier high school / top middle-school 5-point discrimination test." : "Keep the requested level."}

Original request:
${input.userPrompt || ""}
`.trim();
  }

  return `
다음 조건에 맞는 마커스웜홀 영어 문법 실전모의고사를 생성하시오.
제목: ${title}
엔진: wormhole
학년 수준: ${input.level}
학년 표기: ${input.gradeLabel}
모드: ${input.mode}
주제: ${input.topic}
난이도: ${input.difficulty}
문항 수: ${input.count}
${textbookInfo}
${chapterInfo}
문법 포인트: ${grammarList}

반드시 지킬 조건:
- 모든 문항은 5지선다 객관식으로 작성할 것
- 모든 문항의 선택지는 반드시 ① ② ③ ④ ⑤ 형식으로 작성할 것
- a) b) c) d) 형식 사용 금지
- 배열형, 재구성형, 서술형, 영작형 금지
- 문제와 정답/해설은 완전히 분리할 것
- 실제 내신형/실전형 문법 판단 문제처럼 만들 것
- 어색한 문장 찾기, 올바른 문장 개수, 어색한 문장 개수, 문법 구조 비교, 밑줄 어법 판단, 알맞은 어형 선택 등을 적절히 섞을 것
- ${isHigh ? "전체 세트가 고난도 5점형 변별 문제처럼 느껴지게 만들 것" : "요청 난이도에 맞출 것"}

사용자 원문:
${input.userPrompt || ""}
`.trim();
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
  const source = String(text || "").replace(/\r\n/g, "\n");
  const matches =
    source.match(
      /^\s*(\d+\.\s+|\d+\)\s+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*|#{1,3}\s*문제\s*\d+\s*[:.\-]?\s*|문제\s*\d+\s*[:.\-]?\s*)/gm
    ) || [];
  return matches.filter((m) => /^\s*(\d+\.\s+|\d+\)\s+|#{1,3}\s*문제\s*\d+|문제\s*\d+)/.test(m)).length;
}

function cleanupText(text = "") {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeChoiceLabels(text = "") {
  return String(text || "")
    .replace(/^\s*[aA][\)\.\:]\s+/gm, "① ")
    .replace(/^\s*[bB][\)\.\:]\s+/gm, "② ")
    .replace(/^\s*[cC][\)\.\:]\s+/gm, "③ ")
    .replace(/^\s*[dD][\)\.\:]\s+/gm, "④ ")
    .replace(/^\s*[eE][\)\.\:]\s+/gm, "⑤ ")
    .replace(/^\s*1[\)\.\:]\s+/gm, "① ")
    .replace(/^\s*2[\)\.\:]\s+/gm, "② ")
    .replace(/^\s*3[\)\.\:]\s+/gm, "③ ")
    .replace(/^\s*4[\)\.\:]\s+/gm, "④ ")
    .replace(/^\s*5[\)\.\:]\s+/gm, "⑤ ");
}

function stripInlineAnswersFromQuestions(text = "") {
  let source = String(text || "");
  source = source.replace(
    /\n?\s*(정답|해설|정답 및 해설|answers?)\s*[:：].*$/gim,
    ""
  );
  source = source.replace(
    /\n?\s*\*+\s*해설\s*\*+\s*[:：][\s\S]*?(?=\n\s*\d+\.\s|\n\s*문제\s*\d+|$)/gim,
    "\n"
  );
  source = source.replace(
    /\n?\s*\*+\s*정답\s*\*+\s*[:：][\s\S]*?(?=\n\s*\d+\.\s|\n\s*문제\s*\d+|$)/gim,
    "\n"
  );

  return cleanupText(source);
}

function ensureFiveChoicesPerQuestion(questions = "") {
  const source = String(questions || "").replace(/\r\n/g, "\n");
  const blocks = source
    .split(/\n(?=\d+\.\s)/g)
    .map(s => s.trim())
    .filter(Boolean);
  const fixed = blocks.map((block) => {
    const lines = block.split("\n");
    const stem = [];
    const choices = [];

    for (const line of lines) {
      if (/^\s*[①②③④⑤]\s+/.test(line)) {
        choices.push(line.trim());
      } else {
        stem.push(line);
      }
    }

    if (choices.length === 4) {
      choices.push("⑤ 위의 보기 중 어느 것도 아니다.");
    }

    if (choices.length > 5) {
      return [...stem, ...choices.slice(0, 5)].join("\n");
    }

    return [...stem, ...choices].join("\n");
  });
  return cleanupText(fixed.join("\n\n"));
}

function formatWormholeResponse(rawText, input) {
  const normalizedRaw = String(rawText || "").replace(/\r\n/g, "\n").trim();

  let title = cleanupText(extractSection(normalizedRaw, "[[TITLE]]", "[[INSTRUCTIONS]]"));
  let instructions = cleanupText(extractSection(normalizedRaw, "[[INSTRUCTIONS]]", "[[QUESTIONS]]"));
  let questions = cleanupText(extractSection(normalizedRaw, "[[QUESTIONS]]", "[[ANSWERS]]"));
  let answers = cleanupText(extractSection(normalizedRaw, "[[ANSWERS]]", null));
  if (!questions) {
    const firstQuestionIndex = normalizedRaw.search(
      /^\s*(?:문제\s*1\s*[:.\-]?\s*|1\.\s+|1\)\s+|①\s+)/m
    );
    if (firstQuestionIndex >= 0) {
      const beforeQuestions = normalizedRaw.slice(0, firstQuestionIndex).trim();
      const afterQuestions = normalizedRaw.slice(firstQuestionIndex).trim();
      if (!title) {
        const titleLine =
          beforeQuestions
            .split("\n")
            .map(s => s.trim())
            .find(s => /^#\s+/.test(s)) ||
          beforeQuestions
            .split("\n")
            .map(s => s.trim())
            .find(Boolean) ||
          "";

        title = cleanupText(titleLine.replace(/^#+\s*/, "")) || buildWormholeTitle(input);
      }

      if (!instructions) {
        const bodyLines = beforeQuestions
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => !/^#\s+/.test(s));
        instructions = cleanupText(bodyLines.join("\n"));
      }

      const answerStart = afterQuestions.search(
        /\n\s*(#{1,3}\s*)?(정답|해설|정답\s*및\s*해설|answers?)\b/i
      );
      if (answerStart >= 0) {
        questions = cleanupText(afterQuestions.slice(0, answerStart));
        answers = cleanupText(afterQuestions.slice(answerStart));
      } else {
        questions = cleanupText(afterQuestions);
      }
    }
  }

  questions = (questions || "")
    .replace(/^\s*(\d+)\)\s+/gm, "$1. ")
    .replace(/^\s*#{1,3}\s*문제\s*(\d+)\s*[:.\-]?\s*/gm, "$1. ")
    .replace(/^\s*문제\s*(\d+)\s*[:.\-]?\s*/gm, "$1. ");
  answers = (answers || "")
    .replace(/^\s*(\d+)\)\s+/gm, "$1. ")
    .replace(/^\s*#{1,3}\s*정답\s*(\d+)\s*[:.\-]?\s*/gm, "$1. ")
    .replace(/^\s*정답\s*(\d+)\s*[:.\-]?\s*/gm, "$1. ");
  if (questions && !/^\s*1\.\s+/m.test(questions)) {
    const lines = questions.split("\n");
    const firstChoiceIndex = lines.findIndex(line => /^\s*[①②③④⑤]\s+/.test(line));

    if (firstChoiceIndex >= 0) {
      const introLines = lines.slice(0, firstChoiceIndex).map(s => s.trim()).filter(Boolean);
      const choiceLines = lines.slice(firstChoiceIndex);

      const inferredStem = introLines.length
        ? introLines.join(" ")
        : (input.language === "en"
            ? "1. Choose the best answer."
            : "1. 다음 문항에 답하세요.");
      questions = cleanupText(
        ["1. " + inferredStem.replace(/^1\.\s*/, ""), ...choiceLines].join("\n")
      );
    }
  }

  questions = normalizeChoiceLabels(questions);
  answers = normalizeChoiceLabels(answers);
  questions = stripInlineAnswersFromQuestions(questions);

  questions = ensureFiveChoicesPerQuestion(questions);
  if (!answers) {
    const possibleAnswerBlock = normalizedRaw.match(
      /\n\s*(#{1,3}\s*)?(정답|해설|정답\s*및\s*해설|answers?)\b[\s\S]*$/i
    );
    if (possibleAnswerBlock) {
      answers = cleanupText(possibleAnswerBlock[0]);
    }
  }

  const finalTitle = title || buildWormholeTitle(input);
  const finalInstructions =
    instructions ||
    (input.language === "en"
      ? "Answer all questions. Choose the best answer for each item."
      : "다음 문항에 답하세요. 각 문항에서 가장 알맞은 답을 고르세요.");
  const actualCount = countQuestions(questions);

  return {
    title: finalTitle,
    instructions: finalInstructions,
    content: cleanupText([finalTitle, finalInstructions, questions].filter(Boolean).join("\n\n")),
    answerSheet: cleanupText(answers),
    fullText: cleanupText(
      [
        finalTitle,
        finalInstructions,
        questions,
        answers ? "정답 및 해설\n" + answers : ""
      ].filter(Boolean).join("\n\n")
    ),
    actualCount,
    rawPreview: normalizedRaw.slice(0, 2000)
  };
}

function extractQuestionBlocks(text = "") {
  const source = cleanupText(text);
  const matches = [...source.matchAll(/(^|\n)(\d+)\.\s([\s\S]*?)(?=\n\d+\.\s|$)/g)];
  return matches.map((m) => ({
    number: Number(m[2]),
    body: `${m[2]}. ${m[3].trim()}`
  }));
}

function renumberBlocks(blocks = [], start = 1) {
  return blocks.map((block, index) => {
    const nextNo = start + index;
    return String(block.body).replace(/^\d+\.\s*/, `${nextNo}. `).trim();
  });
}

async function generateWormholeSupplement(input, missingCount, existingQuestionsText = "") {
  const supplementSystemPrompt = buildGrammarSystemPrompt({
    ...input,
    count: missingCount,
  });

  const supplementUserPrompt = `
기존 웜홀 문항이 일부 부족합니다.
이미 생성된 문항과 겹치지 않도록, 아래 기존 문항과 다른 신규 문항만 정확히 ${missingCount}문항 추가 생성하세요.

[기존 문항 일부]
${existingQuestionsText}

[중요]
- 반드시 ${missingCount}문항만 추가
- 번호는 1번부터 다시 써도 됨 (서버에서 재번호 부여함)
- 기존 문항과 유형/보기/정답이 겹치지 않게 작성
- 난도와 주제는 기존 세트와 동일하게 유지
`.trim();

  const raw = await callOpenAI(supplementSystemPrompt, supplementUserPrompt);
  return formatWormholeResponse(raw, { ...input, count: missingCount });
}

// --- Memberstack 블록 시작 ---

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
}

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) return null;
  return {
    "x-api-key": MEMBERSTACK_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

async function memberstackRequest(path, options = {}) {
  const headers = getMemberstackHeaders();
  if (!headers) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
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
    throw new Error(
      `Memberstack request failed: ${response.status} ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
}

function getRequiredMp(reqBody = {}) {
  return sanitizeMp(reqBody?.mpCost, 5);
}

function getInitialTrialMp() {
  return sanitizeMp(DEFAULT_TRIAL_MP, 15);
}

function extractBearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function extractMemberId(req) {
  return sanitizeString(
    req?.body?.memberId ||
    req?.headers?.["x-member-id"] ||
    req?.headers?.["X-Member-Id"] ||
    ""
  );
}

async function verifyMemberToken(token) {
  if (!token) return null;

  const payload = { token };
  if (MEMBERSTACK_APP_ID) {
    payload.audience = MEMBERSTACK_APP_ID;
  }

  const data = await memberstackRequest("/verify-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "GET",
  });

  return data?.data || null;
}

function readMpFromMember(member) {
  if (!member) return null;

  const candidates = [
    member?.customFields?.[MEMBERSTACK_MP_FIELD],
    member?.metaData?.[MEMBERSTACK_MP_FIELD],
    member?.customFields?.mp,
    member?.metaData?.mp,
    member?.customFields?.MP,
    member?.metaData?.MP,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return sanitizeMp(parsed, 0);
    }
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) {
    throw new Error("Missing member id for MP update");
  }

  const safeNextMp = sanitizeMp(nextMp, 0);
  const currentCustomFields =
    member?.customFields && typeof member.customFields === "object"
      ? member.customFields
      : {};
  const currentMetaData =
    member?.metaData && typeof member.metaData === "object"
      ? member.metaData
      : {};

  const body = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
    },
  };
  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data?.data || null;
}

async function resolveMemberForMp(req) {
  if (!MEMBERSTACK_SECRET_KEY) {
    return { enabled: false, reason: "missing_secret_key", member: null };
  }

  try {
    const bearerToken = extractBearerToken(req);
    if (bearerToken) {
      const verified = await verifyMemberToken(bearerToken);
      if (verified?.id) {
        const member = await getMemberById(verified.id);
        return { enabled: true, reason: "token_verified", member };
      }
    }

    const explicitMemberId = extractMemberId(req);
    if (explicitMemberId) {
      const member = await getMemberById(explicitMemberId);
      return { enabled: true, reason: "member_id", member };
    }

    return { enabled: false, reason: "member_not_provided", member: null };
  } catch (error) {
    console.error("resolveMemberForMp error:", error);
    return { enabled: false, reason: "member_lookup_failed", member: null };
  }
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  const memberContext = await resolveMemberForMp(req);
  if (!memberContext.enabled || !memberContext.member) {
    return {
      enabled: false,
      reason: memberContext.reason,
      requiredMp,
      member: null,
      currentMp: null,
      remainingMp: null,
      trialGranted: false,
      deducted: false,
    };
  }

  let member = memberContext.member;
  let currentMp = readMpFromMember(member);
  let trialGranted = false;
  if (!Number.isFinite(currentMp)) {
    currentMp = getInitialTrialMp();
    member = (await updateMemberMp(member, currentMp)) || member;
    currentMp = readMpFromMember(member);
    trialGranted = true;
  }

  if (!Number.isFinite(currentMp)) {
    currentMp = 0;
  }

  return {
    enabled: true,
    reason: memberContext.reason,
    requiredMp,
    member,
    currentMp,
    remainingMp: currentMp,
    trialGranted,
    deducted: false,
  };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) {
    return {
      ...mpState,
      deducted: false,
    };
  }

  const currentMp = sanitizeMp(mpState.currentMp, 0);
  const requiredMp = sanitizeMp(mpState.requiredMp, 0);
  if (!Number.isFinite(currentMp) || !Number.isFinite(requiredMp)) {
    return {
      ...mpState,
      deducted: false,
    };
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

// --- Memberstack 블록 끝 ---

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

    const systemPrompt = buildGrammarSystemPrompt(input);
    const userPrompt = buildGrammarUserPrompt(input);

    const raw = await callOpenAI(systemPrompt, userPrompt);
    let formatted = formatWormholeResponse(raw, input);

    if (formatted.actualCount < input.count) {
      console.warn(
        `WORMHOLE QUESTION SHORTAGE: expected ${input.count}, got ${formatted.actualCount}`
      );

      const missingCount = input.count - formatted.actualCount;

      if (missingCount > 0) {
        const supplement = await generateWormholeSupplement(
          input,
          missingCount,
          formatted.content
        );

        const originalQuestionBlocks = extractQuestionBlocks(
          extractSection(formatted.content, formatted.title, null)
            .replace(formatted.instructions || "", "")
            .trim()
        );

        const supplementQuestionBlocks = extractQuestionBlocks(
          supplement.content
            .replace(supplement.title || "", "")
            .replace(supplement.instructions || "", "")
            .trim()
        );

        const originalAnswerBlocks = extractQuestionBlocks(formatted.answerSheet);
        const supplementAnswerBlocks = extractQuestionBlocks(supplement.answerSheet);

        const mergedQuestionBlocks = [
          ...renumberBlocks(originalQuestionBlocks, 1),
          ...renumberBlocks(supplementQuestionBlocks, originalQuestionBlocks.length + 1),
        ];

        const mergedAnswerBlocks = [
          ...renumberBlocks(originalAnswerBlocks, 1),
          ...renumberBlocks(supplementAnswerBlocks, originalAnswerBlocks.length + 1),
        ];

        const mergedQuestionsText = mergedQuestionBlocks.join("\n\n");
        const mergedAnswersText = mergedAnswerBlocks.join("\n\n");

        formatted = {
          ...formatted,
          content: cleanupText(
            [formatted.title, formatted.instructions, mergedQuestionsText]
              .filter(Boolean)
              .join("\n\n")
          ),
          answerSheet: cleanupText(mergedAnswersText),
          fullText: cleanupText(
            [
              formatted.title,
              formatted.instructions,
              mergedQuestionsText,
              "정답 및 해설",
              mergedAnswersText,
            ]
              .filter(Boolean)
              .join("\n\n")
          ),
          actualCount: countQuestions(mergedQuestionsText),
        };
      }
    }

    if (formatted.actualCount !== input.count) {
      console.warn(
        `WORMHOLE FINAL COUNT MISMATCH: expected ${input.count}, got ${formatted.actualCount}`
      );
    }

    if (!formatted.content.includes("⑤ ")) {
      console.warn("WORMHOLE WARNING: 5th choice was missing in at least some items; fallback normalization applied.");
    }

    if (formatted.actualCount === 0) {
      console.error("WORMHOLE PARSE FAILED - RAW PREVIEW:", formatted.rawPreview);
      return json(res, 500, {
        success: false,
        message: `Question parsing failed: expected ${input.count}, got 0`,
        rawPreview: formatted.rawPreview
      });
    }

    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      ...formatted,
      textbook: input.textbook,
      requiredMp: mpState.requiredMp,
      remainingMp: finalMpState?.remainingMp ?? null,
      trialGranted: Boolean(mpState.trialGranted),
      mpSyncEnabled: Boolean(mpState.enabled),
      mpSyncReason: mpState.reason || "unknown",
      mp: {
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: finalMpState?.remainingMp ?? null,
        deducted: Boolean(finalMpState?.deducted),
        trialGranted: Boolean(mpState.trialGranted),
      }
    });
  } catch (error) {
    console.error("Handler Error:", error);
    return json(res, 500, { success: false, message: "Generation failed", detail: error.message });
  }
}
