"use strict";

/**
 * S16 core: textbook-semester mapping + hard lock + clue/question fallback
 * This file is intentionally lightweight and editable.
 */

const TEXTBOOK_SEM1_CHAPTER_MAP = {
  middle1: {
    lesson1: {
      lessonNo: 1,
      topicKo: "현재진행형",
      chapterKey: "present_continuous",
      guideKo: [
        "반드시 be동사 + 동사ing 형태를 사용할 것.",
        "now / right now / at the moment 같은 현재 진행 신호를 자연스럽게 사용할 것.",
        "단순현재 문장으로 흐르지 말 것.",
        "현재 눈앞에서 일어나는 동작이나 상황을 묘사할 것."
      ],
      questionFallbacksKo: [
        "나는 지금 축구를 하고 있다.",
        "그들은 지금 TV를 보고 있다.",
        "너는 지금 무엇을 하고 있니?",
        "우리는 지금 친구들과 이야기하고 있다.",
        "그녀는 지금 책을 읽고 있다.",
        "그들은 지금 음악을 듣고 있다.",
        "그는 지금 수학을 공부하고 있다.",
        "그들은 지금 농구를 하고 있다.",
        "너는 지금 어디에 있니?",
        "나는 지금 집에 있지 않다.",
        "그녀는 지금 요리를 하고 있니?",
        "우리는 지금 학교에 가고 있다.",
        "그들은 지금 게임을 하고 있지 않다.",
        "나는 지금 숙제를 하고 있지 않다.",
        "너는 지금 친구를 기다리고 있니?",
        "그는 지금 점심을 먹고 있다.",
        "나는 지금 새 영화를 보고 있다.",
        "그녀는 지금 수업을 듣고 있지 않다.",
        "지금 너는 무엇을 듣고 있니?",
        "우리는 지금 공원에서 산책하고 있다.",
        "너는 지금 나와 함께 공부하고 있니?",
        "그들은 지금 새로운 노래를 부르고 있다.",
        "나는 지금 이 책을 읽고 있다.",
        "그녀는 지금 사진을 찍고 있다.",
        "그는 지금 친구에게 문자 메시지를 보내고 있다."
      ],
      answerFallbacksEn: [
        "I am playing soccer now.",
        "They are watching TV now.",
        "What are you doing now?",
        "We are talking with our friends now.",
        "She is reading a book now.",
        "They are listening to music now.",
        "He is studying math now.",
        "They are playing basketball now.",
        "Where are you now?",
        "I am not at home now.",
        "Is she cooking now?",
        "We are going to school now.",
        "They are not playing a game now.",
        "I am not doing my homework now.",
        "Are you waiting for your friend now?",
        "He is eating lunch now.",
        "I am watching a new movie now.",
        "She is not taking a class now.",
        "What are you listening to now?",
        "We are taking a walk in the park now.",
        "Are you studying with me now?",
        "They are singing a new song now.",
        "I am reading this book now.",
        "She is taking pictures now.",
        "He is sending a text message to his friend now."
      ]
    },
    lesson2: {
      lessonNo: 2,
      topicKo: "일반현재",
      chapterKey: "simple_present",
      guideKo: [
        "일반적인 사실, 습관, 반복 행동을 나타낼 것.",
        "always / usually / often / every day 등을 자연스럽게 사용할 수 있다.",
        "현재진행형을 사용하지 말 것."
      ]
    },
    lesson3: {
      lessonNo: 3,
      topicKo: "조동사 can",
      chapterKey: "modal_can",
      guideKo: [
        "반드시 can + 동사원형 구조를 사용할 것.",
        "능력, 가능, 허가의 의미를 중심으로 할 것.",
        "be동사 현재진행형 구조로 흐르지 말 것."
      ],
      questionFallbacksKo: [
        "나는 수영을 할 수 있다.",
        "그는 피아노를 칠 수 있다.",
        "너는 이 문제를 해결할 수 있다.",
        "우리는 함께 여행을 갈 수 있다.",
        "그들은 영어를 배울 수 있다.",
        "나는 내일 시험을 볼 수 있다.",
        "그녀는 요리를 잘할 수 있다.",
        "우리는 이 책을 읽을 수 있다.",
        "그는 나를 도와줄 수 있다.",
        "나는 친구들과 영화를 볼 수 있다.",
        "그녀는 그 문제를 설명할 수 있다.",
        "우리는 그 프로젝트를 완성할 수 있다.",
        "그는 그 수업에 참석할 수 있다.",
        "그녀는 나에게 그 이야기를 들려줄 수 있다.",
        "그들은 나에게 도움을 줄 수 있다.",
        "나는 너에게 좋은 기회를 줄 수 있다.",
        "우리는 함께 이 문제를 해결할 수 있다.",
        "그녀는 나에게 그 계획을 설명할 수 있다.",
        "나는 그를 도와줄 수 있다.",
        "우리는 그 수업을 이해할 수 있다.",
        "그는 나에게 새로운 전략을 가르칠 수 있다.",
        "나는 너에게 이 기회를 줄 수 있다.",
        "우리는 함께 그 프로젝트를 진행할 수 있다.",
        "그녀는 나에게 그 방법을 보여줄 수 있다.",
        "나는 그가 이 문제를 해결하도록 도와줄 수 있다."
      ],
      answerFallbacksEn: [
        "I can swim.",
        "He can play the piano.",
        "You can solve this problem.",
        "We can travel together.",
        "They can learn English.",
        "I can take the test tomorrow.",
        "She can cook well.",
        "We can read this book.",
        "He can help me.",
        "I can watch a movie with my friends.",
        "She can explain the problem.",
        "We can complete the project.",
        "He can attend the class.",
        "She can tell me the story.",
        "They can give me some help.",
        "I can give you a good opportunity.",
        "We can solve this problem together.",
        "She can explain the plan to me.",
        "I can help him.",
        "We can understand the class.",
        "He can teach me a new strategy.",
        "I can give you this chance.",
        "We can carry out the project together.",
        "She can show me the way.",
        "I can help him solve this problem."
      ]
    },
    lesson4: {
      lessonNo: 4,
      topicKo: "명령문/요청문",
      chapterKey: "imperative",
      guideKo: [
        "동사원형으로 시작하는 명령문을 중심으로 할 것.",
        "Please를 자연스럽게 사용할 수 있다.",
        "주어는 생략될 수 있다."
      ]
    }
  },
  middle2: {
    lesson1: {
      lessonNo: 1,
      topicKo: "현재완료",
      chapterKey: "present_perfect",
      guideKo: [
        "반드시 have/has + 과거분사 형태를 사용할 것.",
        "경험, 계속, 완료, 결과 의미를 균형 있게 다룰 것.",
        "yesterday, ago, last year 같은 완료 불가능 시간표현을 금지한다."
      ],
      questionFallbacksKo: [
        "나는 이 도시에 3년 동안 살아왔다.",
        "그녀는 이미 숙제를 끝냈다.",
        "나는 그를 한 번도 본 적이 없다.",
        "우리는 이미 점심을 먹었다.",
        "그는 아직 그 문제를 풀지 않았다.",
        "그들은 이 회사에서 2년 동안 일해왔다.",
        "나는 이 책을 두 번 읽어 보았다.",
        "그녀는 아직 그 소식을 듣지 못했다.",
        "우리는 2019년부터 이 도시에 살아왔다.",
        "그는 방금 그 게임을 시작했다.",
        "나는 이 일을 3년 동안 해왔다.",
        "그녀는 그 영화를 이미 보았다.",
        "나는 그 질문의 답을 이미 알고 있다.",
        "우리는 아직 그 일을 시작하지 않았다.",
        "그는 그 문제를 해결하려고 노력해왔다.",
        "나는 그 프로젝트를 이미 제출했다.",
        "그녀는 그 기회를 두 번 놓쳤다.",
        "우리는 이 도시에서 5년째 살고 있다.",
        "그는 그 책을 읽어 본 적이 있다.",
        "나는 그 문제를 해결하려고 노력해왔다.",
        "그녀는 그 소식을 듣고 매우 기뻤다.",
        "우리는 그 프로젝트를 아직 완료하지 못했다.",
        "그는 그 수업을 한 번도 빠진 적이 없다.",
        "나는 이 회사에서 2019년부터 일해왔다.",
        "나는 이 책을 두 번 읽어 보았다."
      ],
      answerFallbacksEn: [
        "I have lived in this city for three years.",
        "She has already finished her homework.",
        "I have never seen him.",
        "We have already eaten lunch.",
        "He has not solved the problem yet.",
        "They have worked at this company for two years.",
        "I have read this book twice.",
        "She has not heard the news yet.",
        "We have lived in this city since 2019.",
        "He has just started the game.",
        "I have done this work for three years.",
        "She has already seen the movie.",
        "I have already known the answer.",
        "We have not started the work yet.",
        "He has tried to solve the problem.",
        "I have already submitted the project.",
        "She has missed the opportunity twice.",
        "We have lived in this city for five years.",
        "He has read the book before.",
        "I have tried to solve the problem.",
        "She has been happy to hear the news.",
        "We have not completed the project yet.",
        "He has never missed the class.",
        "I have worked here since 2019.",
        "I have read this book twice."
      ]
    },
    lesson2: {
      lessonNo: 2,
      topicKo: "수동태",
      chapterKey: "passive",
      guideKo: [
        "반드시 be동사 + 과거분사 구조를 사용할 것.",
        "능동문으로 흐르지 말 것.",
        "현재/과거/미래/조동사 수동태를 고르게 사용할 수 있다."
      ],
      questionFallbacksKo: [
        "이 책은 많은 학생들에 의해 읽힌다.",
        "그 프로젝트는 내년에 완료될 것이다.",
        "이 그림은 유명한 화가에 의해 그려졌다.",
        "그 문제는 쉽게 해결될 수 있다.",
        "이 발표는 내일 진행될 것이다.",
        "이 보고서는 전문가들에 의해 작성되었다.",
        "이 수업은 매주 금요일에 열린다.",
        "이 문서는 내일까지 제출되어야 한다.",
        "이 건물은 최근에 리모델링되었다.",
        "이 사진은 유명한 사진작가에 의해 찍혔다.",
        "이 노래는 많은 사람들에게 사랑받고 있다.",
        "이 제품은 전 세계에서 팔리고 있다.",
        "그 소식은 곧 발표될 것이다.",
        "그 행사는 내년에 개최될 예정이다.",
        "이 책은 여러 언어로 번역되었다.",
        "그 문제는 곧 검토될 것이다.",
        "이 숙제는 학생들에 의해 제출되어야 한다.",
        "그 문은 누군가에 의해 닫혔다.",
        "이 프로그램은 많은 사람들이 사용한다.",
        "그 회의는 다음 주에 열릴 것이다.",
        "그 편지는 어제 쓰였다.",
        "이 음식은 전문 요리사에 의해 준비되었다.",
        "그 계획은 아직 완료되지 않았다.",
        "그 질문은 곧 다시 논의될 것이다.",
        "이 상은 훌륭한 학생에게 주어졌다."
      ],
      answerFallbacksEn: [
        "This book is read by many students.",
        "The project will be completed next year.",
        "This picture was painted by a famous artist.",
        "The problem can be solved easily.",
        "The presentation will be held tomorrow.",
        "The report was written by experts.",
        "The class is held every Friday.",
        "This document must be submitted by tomorrow.",
        "The building was remodeled recently.",
        "The photo was taken by a famous photographer.",
        "The song is loved by many people.",
        "The product is sold around the world.",
        "The news will be announced soon.",
        "The event will be held next year.",
        "The book was translated into many languages.",
        "The problem will be reviewed soon.",
        "The homework should be submitted by students.",
        "The door was closed by someone.",
        "The program is used by many people.",
        "The meeting will be held next week.",
        "The letter was written yesterday.",
        "The food was prepared by a professional chef.",
        "The plan has not been completed yet.",
        "The question will be discussed again soon.",
        "The prize was given to an excellent student."
      ]
    },
    lesson3: {
      lessonNo: 3,
      topicKo: "to부정사",
      chapterKey: "to_infinitive",
      guideKo: [
        "반드시 to + 동사원형 구조를 선명하게 사용할 것.",
        "명사적, 형용사적, 부사적 용법 중 요청된 맥락에 맞게 사용할 것.",
        "동명사 중심 세트로 흐르지 않게 할 것."
      ]
    },
    lesson4: {
      lessonNo: 4,
      topicKo: "동명사",
      chapterKey: "gerund",
      guideKo: [
        "동사의 -ing형이 명사 역할을 하도록 할 것.",
        "to부정사와 혼동되는 구조를 피할 것."
      ]
    }
  },
  middle3: {
    lesson1: {
      lessonNo: 1,
      topicKo: "현재완료진행형",
      chapterKey: "present_perfect_progressive",
      guideKo: [
        "반드시 have/has been + 동사ing 형태를 사용할 것.",
        "지속적으로 해오고 있는 동작을 나타낼 것.",
        "단순 현재완료와 혼동하지 말 것."
      ]
    },
    lesson2: {
      lessonNo: 2,
      topicKo: "관계대명사/관계부사",
      chapterKey: "relative_pronoun_general",
      guideKo: [
        "선행사와 관계절의 연결 관계가 분명해야 한다.",
        "what, who, which, that, where, when, why를 혼동하지 말 것."
      ]
    },
    lesson3: {
      lessonNo: 3,
      topicKo: "분사의 한정적 용법",
      chapterKey: "participial_modifier",
      guideKo: [
        "분사가 명사를 직접 수식하는 구조를 우선할 것.",
        "현재분사/과거분사 수식을 균형 있게 사용할 것."
      ]
    },
    lesson4: {
      lessonNo: 4,
      topicKo: "사역/목적 구문",
      chapterKey: "causative",
      guideKo: [
        "make / let / have / help / get 또는 so that 목적 구문을 요청에 맞게 사용할 것."
      ]
    }
  }
};


const CHAPTER_COMPLETION_PROFILE = {
  present_continuous: {
    completionGoal: "중1 현재진행형 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "단순현재 또는 상태동사 대비",
    templateFamilies: [
      "be + V-ing + now/right now/at the moment",
      "의문문: Are/Is ... V-ing?",
      "부정문: am/is/are not + V-ing"
    ]
  },
  present_perfect: {
    completionGoal: "중2 현재완료 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "현재완료진행형 또는 시간 대비 문항",
    templateFamilies: [
      "have/has + p.p + already/just/yet",
      "have/has + p.p + for/since",
      "have/has ever/never + p.p"
    ]
  },
  present_perfect_progressive: {
    completionGoal: "중3 현재완료진행형 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "현재완료 일반형 대비",
    templateFamilies: [
      "have/has been + V-ing + for",
      "have/has been + V-ing + since"
    ]
  },
  relative_pronoun_what: {
    completionGoal: "중3 관계대명사 what Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "the thing that 비교",
    templateFamilies: [
      "What S need/want/is ...",
      "What S said/learned/made ..."
    ]
  },
  be_question: {
    completionGoal: "중1 be동사 의문문 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "일반동사 의문문과의 근접 대비",
    templateFamilies: [
      "Am/Is/Are + subject + complement/adverbial?"
    ]
  },
  do_question: {
    completionGoal: "중1 일반동사 의문문 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "be동사 의문문과의 근접 대비",
    templateFamilies: [
      "Do/Does + subject + base verb ...?"
    ]
  },
  ditransitive: {
    completionGoal: "중2 수여동사 Guided Writing 완성",
    coreRatio: "85~90%",
    contrastRatio: "10~15%",
    contrastZone: "3형식/4형식, to/for alternation",
    templateFamilies: [
      "give/send/show/teach/tell + IO + DO",
      "buy/make/find + DO + for/to + person"
    ]
  }
};


const GENERIC_CHAPTER_BANK = {
  be_question: {
    track: "middle1",
    lessonKey: "generic_be_question",
    lessonNo: "generic",
    topicKo: "be동사 의문문",
    chapterKey: "be_question",
    guideKo: [
      "반드시 Am/Is/Are로 시작하는 의문문을 중심으로 할 것.",
      "물음표가 있는 진짜 의문문으로 만들 것.",
      "평서문이나 일반동사 의문문으로 흐르지 말 것."
    ],
    questionFallbacksKo: [
      "너는 지금 바쁘니?",
      "그녀는 오늘 학교에 있니?",
      "그들은 지금 집에 있니?",
      "나는 지금 늦었니?",
      "그는 친절하니?",
      "너희는 준비되었니?",
      "그녀는 지금 피곤하니?",
      "우리는 같은 반이니?",
      "그 책은 재미있니?",
      "그 영화는 길니?",
      "너는 오늘 행복하니?",
      "그는 지금 집에 있니?",
      "우리는 지금 안전하니?",
      "그 가게는 지금 열려 있니?",
      "그녀는 너의 친구니?",
      "너는 지금 괜찮니?",
      "그 문제는 어렵니?",
      "그들은 지금 조용하니?",
      "이 방은 깨끗하니?",
      "그 소식은 사실이니?",
      "그녀는 지금 교실에 있니?",
      "나는 지금 준비되었니?",
      "그들은 오늘 바쁘니?",
      "그 계획은 가능하니?",
      "이 음식은 신선하니?"
    ],
    answerFallbacksEn: [
      "Are you busy now?",
      "Is she at school today?",
      "Are they at home now?",
      "Am I late now?",
      "Is he kind?",
      "Are you ready?",
      "Is she tired now?",
      "Are we in the same class?",
      "Is the book interesting?",
      "Is the movie long?",
      "Are you happy today?",
      "Is he at home now?",
      "Are we safe now?",
      "Is the store open now?",
      "Is she your friend?",
      "Are you okay now?",
      "Is the problem difficult?",
      "Are they quiet now?",
      "Is this room clean?",
      "Is the news true?",
      "Is she in the classroom now?",
      "Am I ready now?",
      "Are they busy today?",
      "Is the plan possible?",
      "Is this food fresh?"
    ]
  },
  do_question: {
    track: "middle1",
    lessonKey: "generic_do_question",
    lessonNo: "generic",
    topicKo: "일반동사 의문문",
    chapterKey: "do_question",
    guideKo: [
      "반드시 Do/Does + 주어 + 동사원형 의문문을 중심으로 할 것.",
      "물음표가 있는 단순현재 의문문으로 만들 것.",
      "평서문이나 조동사 문장으로 흐르지 말 것."
    ],
    questionFallbacksKo: [
      "너는 매일 운동하니?",
      "그는 학교에 걸어가니?",
      "그녀는 피아노를 치니?",
      "너희는 영어를 공부하니?",
      "그들은 주말에 축구를 하니?",
      "너는 아침을 집에서 먹니?",
      "그는 책을 자주 읽니?",
      "그녀는 매일 일찍 일어나니?",
      "너는 숙제를 스스로 하니?",
      "그는 버스를 타고 학교에 가니?",
      "그녀는 토요일에 쇼핑하니?",
      "너는 저녁에 음악을 듣니?",
      "그는 친구들을 자주 만나니?",
      "그녀는 영어 일기를 쓰니?",
      "너희는 점심을 학교에서 먹니?",
      "너는 주말에 영화를 보니?",
      "그는 수학을 좋아하니?",
      "그녀는 매일 커피를 마시니?",
      "너는 방과 후에 공부하니?",
      "그는 저녁에 게임을 하니?",
      "그녀는 동생을 도와주니?",
      "너는 일요일에 늦게 자니?",
      "그는 학교 도서관을 이용하니?",
      "그녀는 개를 키우니?",
      "너는 매일 영어 단어를 외우니?"
    ],
    answerFallbacksEn: [
      "Do you exercise every day?",
      "Does he walk to school?",
      "Does she play the piano?",
      "Do you study English?",
      "Do they play soccer on weekends?",
      "Do you eat breakfast at home?",
      "Does he read books often?",
      "Does she get up early every day?",
      "Do you do your homework by yourself?",
      "Does he go to school by bus?",
      "Does she go shopping on Saturday?",
      "Do you listen to music in the evening?",
      "Does he meet his friends often?",
      "Does she write an English diary?",
      "Do you eat lunch at school?",
      "Do you watch movies on weekends?",
      "Does he like math?",
      "Does she drink coffee every day?",
      "Do you study after school?",
      "Does he play games in the evening?",
      "Does she help her younger brother?",
      "Do you go to bed late on Sunday?",
      "Does he use the school library?",
      "Does she have a dog?",
      "Do you memorize English words every day?"
    ]
  },
  ditransitive: {
    track: "middle2",
    lessonKey: "generic_ditransitive",
    lessonNo: "generic",
    topicKo: "수여동사",
    chapterKey: "ditransitive",
    guideKo: [
      "반드시 give/show/send/teach/tell/buy/make/find/offer 같은 수여동사 구조를 중심으로 할 것.",
      "간접목적어 + 직접목적어, 또는 직접목적어 + to/for + 사람 구조가 보이게 할 것.",
      "make/let/have 같은 사역동사 중심 세트로 흐르지 말 것."
    ],
    questionFallbacksKo: [
      "그는 나에게 새 책을 주었다.",
      "나는 그녀에게 편지를 보냈다.",
      "선생님은 우리에게 영어를 가르쳐 주셨다.",
      "그녀는 나에게 좋은 조언을 해주었다.",
      "나는 친구에게 사진을 보여주었다.",
      "엄마는 나에게 따뜻한 저녁을 만들어 주셨다.",
      "그는 나에게 자리를 찾아 주었다.",
      "나는 그에게 이메일을 보냈다.",
      "그녀는 우리에게 중요한 사실을 말해 주었다.",
      "아빠는 나에게 새 가방을 사 주셨다.",
      "나는 동생에게 숙제를 설명해 주었다.",
      "그는 그녀에게 꽃을 보내 주었다.",
      "선생님은 학생들에게 질문을 해주셨다.",
      "나는 친구에게 내 계획을 말해 주었다.",
      "그녀는 나에게 길을 보여주었다.",
      "엄마는 우리에게 간식을 주셨다.",
      "나는 그에게 좋은 기회를 마련해 주었다.",
      "그는 나에게 유용한 정보를 알려주었다.",
      "나는 그녀에게 작은 선물을 사 주었다.",
      "선생님은 우리에게 흥미로운 이야기를 들려주셨다.",
      "나는 친구에게 메시지를 보냈다.",
      "그녀는 나에게 답을 보여주었다.",
      "아빠는 나에게 새 자전거를 사 주셨다.",
      "그는 우리에게 특별한 자리를 마련해 주었다.",
      "나는 동생에게 쉬운 예문을 가르쳐 주었다."
    ],
    answerFallbacksEn: [
      "He gave me a new book.",
      "I sent her a letter.",
      "The teacher taught us English.",
      "She gave me good advice.",
      "I showed my friend the picture.",
      "My mom made me a warm dinner.",
      "He found me a seat.",
      "I sent him an email.",
      "She told us an important fact.",
      "My dad bought me a new bag.",
      "I explained the homework to my brother.",
      "He sent her flowers.",
      "The teacher asked the students a question.",
      "I told my friend my plan.",
      "She showed me the way.",
      "My mom gave us a snack.",
      "I made him a good opportunity.",
      "He told me useful information.",
      "I bought her a small gift.",
      "The teacher told us an interesting story.",
      "I sent my friend a message.",
      "She showed me the answer.",
      "My dad bought me a new bicycle.",
      "He found us a special place.",
      "I taught my younger brother an easy example."
    ]
  },
  present_perfect_progressive: {
    track: "middle3",
    lessonKey: "generic_present_perfect_progressive",
    lessonNo: "generic",
    topicKo: "현재완료진행형",
    chapterKey: "present_perfect_progressive",
    guideKo: [
      "반드시 have/has been + 동사ing 형태를 사용할 것.",
      "지금까지 계속 이어지는 동작 의미를 중심으로 할 것.",
      "현재완료 일반형이 주류가 되지 않게 할 것."
    ],
    questionFallbacksKo: [
      "나는 2시간 동안 영어를 공부해오고 있다.",
      "그녀는 아침부터 피아노를 연습해오고 있다.",
      "우리는 2019년부터 이 도시에 살고 있다.",
      "그는 30분 동안 숙제를 하고 있다.",
      "나는 지난주부터 이 책을 읽고 있다.",
      "그녀는 오랫동안 그 문제를 해결하려고 노력해오고 있다.",
      "우리는 오전 내내 회의를 준비해오고 있다.",
      "그는 세 시간 동안 축구를 연습해오고 있다.",
      "나는 겨울부터 이 프로젝트를 진행해오고 있다.",
      "그녀는 10분 동안 버스를 기다리고 있다.",
      "우리는 두 달 동안 영어 일기를 써오고 있다.",
      "그는 아침부터 컴퓨터를 사용하고 있다.",
      "나는 5년 동안 이 회사에서 일해오고 있다.",
      "그녀는 최근까지 노래를 연습해오고 있다.",
      "우리는 한 시간 동안 청소를 하고 있다.",
      "그는 며칠 동안 감기와 싸우고 있다.",
      "나는 20분 동안 점심을 준비하고 있다.",
      "그녀는 지난달부터 수영을 배워오고 있다.",
      "우리는 몇 년 동안 서로를 도와오고 있다.",
      "그는 오전부터 방을 정리하고 있다.",
      "나는 오래전부터 이 꿈을 준비해오고 있다.",
      "그녀는 두 시간 동안 그림을 그리고 있다.",
      "우리는 아침부터 비를 기다리고 있다.",
      "그는 2018년부터 영어를 가르쳐오고 있다.",
      "나는 한동안 이 문제를 생각해오고 있다."
    ],
    answerFallbacksEn: [
      "I have been studying English for two hours.",
      "She has been practicing the piano since morning.",
      "We have been living in this city since 2019.",
      "He has been doing his homework for thirty minutes.",
      "I have been reading this book since last week.",
      "She has been trying to solve the problem for a long time.",
      "We have been preparing for the meeting all morning.",
      "He has been practicing soccer for three hours.",
      "I have been working on this project since winter.",
      "She has been waiting for the bus for ten minutes.",
      "We have been writing English diaries for two months.",
      "He has been using the computer since morning.",
      "I have been working at this company for five years.",
      "She has been practicing singing until recently.",
      "We have been cleaning for an hour.",
      "He has been fighting a cold for several days.",
      "I have been preparing lunch for twenty minutes.",
      "She has been learning swimming since last month.",
      "We have been helping each other for years.",
      "He has been cleaning his room since this morning.",
      "I have been preparing for this dream for a long time.",
      "She has been drawing for two hours.",
      "We have been waiting for the rain since morning.",
      "He has been teaching English since 2018.",
      "I have been thinking about this problem for a while."
    ]
  },
  present_continuous: {
    track: "middle1",
    lessonKey: "generic_present_continuous",
    lessonNo: "generic",
    topicKo: "현재진행형",
    chapterKey: "present_continuous",
    guideKo: [
      "반드시 be동사 + 동사ing 형태를 사용할 것.",
      "now / right now / at the moment 같은 현재 진행 신호를 자연스럽게 사용할 것."
    ]
  },
  present_perfect: {
    track: "middle2",
    lessonKey: "generic_present_perfect",
    lessonNo: "generic",
    topicKo: "현재완료",
    chapterKey: "present_perfect",
    guideKo: [
      "반드시 have/has + 과거분사 형태를 사용할 것.",
      "경험, 계속, 완료, 결과 의미를 다루되 완료 불가능 시간표현은 피할 것."
    ]
  },
  passive: {
    track: "middle2",
    lessonKey: "generic_passive",
    lessonNo: "generic",
    topicKo: "수동태",
    chapterKey: "passive",
    guideKo: [
      "반드시 be동사 + 과거분사 구조를 사용할 것.",
      "능동문 중심 세트로 흐르지 말 것."
    ]
  },
  to_infinitive: {
    track: "middle2",
    lessonKey: "generic_to_infinitive",
    lessonNo: "generic",
    topicKo: "to부정사",
    chapterKey: "to_infinitive",
    guideKo: [
      "반드시 to + 동사원형 구조를 선명하게 사용할 것."
    ]
  },
  gerund: {
    track: "middle2",
    lessonKey: "generic_gerund",
    lessonNo: "generic",
    topicKo: "동명사",
    chapterKey: "gerund",
    guideKo: [
      "동사의 -ing형이 명사 역할을 하도록 할 것."
    ]
  },
  relative_pronoun_general: {
    track: "middle3",
    lessonKey: "generic_relative_pronoun_general",
    lessonNo: "generic",
    topicKo: "관계대명사",
    chapterKey: "relative_pronoun_general",
    guideKo: [
      "선행사와 관계절의 연결 관계가 분명해야 한다."
    ]
  },
  participial_modifier: {
    track: "middle3",
    lessonKey: "generic_participial_modifier",
    lessonNo: "generic",
    topicKo: "분사의 한정적 용법",
    chapterKey: "participial_modifier",
    guideKo: [
      "분사가 명사를 직접 수식하는 구조를 우선할 것."
    ]
  },
  causative: {
    track: "middle3",
    lessonKey: "generic_causative",
    lessonNo: "generic",
    topicKo: "사역동사",
    chapterKey: "causative",
    guideKo: [
      "make / let / have / help / get 구조를 요청에 맞게 사용할 것."
    ]
  },
  so_that_purpose: {
    track: "middle3",
    lessonKey: "generic_so_that_purpose",
    lessonNo: "generic",
    topicKo: "so that 목적 구문",
    chapterKey: "so_that_purpose",
    guideKo: [
      "so that 뒤 목적 의미가 분명하게 드러나게 할 것."
    ]
  }
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferTrackKey(input = {}) {
  const grade = String(input.gradeLabel || input.level || "").toLowerCase();
  if (/중1|middle1|middle 1/.test(grade)) return "middle1";
  if (/중2|middle2|middle 2/.test(grade)) return "middle2";
  if (/중3|middle3|middle 3/.test(grade)) return "middle3";
  if (/middle/.test(grade)) return "middle2";
  return "";
}

function resolveTextbookLesson(input = {}) {
  const track = inferTrackKey(input);
  const source = [
    input.worksheetTitle,
    input.topic,
    input.userPrompt,
    input.examType,
    input.mode
  ].map(normalizeText).join(" ");

  const lessonExplicit = source.match(/(?:lesson|lesson\s*|lesson-?|과)\s*([1-4])/i) || source.match(/([1-4])과/);
  const explicitNo = lessonExplicit ? Number(lessonExplicit[1]) : 0;

  const map = TEXTBOOK_SEM1_CHAPTER_MAP[track];
  if (map && explicitNo && map[`lesson${explicitNo}`]) {
    return { track, lessonKey: `lesson${explicitNo}`, ...map[`lesson${explicitNo}`] };
  }

  const gf = input.grammarFocus || {};
  const topic = String(input.topic || "");
  const raw = [source, topic, input.userPrompt, input.worksheetTitle].filter(Boolean).join(" ");

  if (map) {
    for (const [lessonKey, lesson] of Object.entries(map)) {
      if (lesson.chapterKey === "present_continuous" && /현재진행형|present\s+continuous/i.test(topic)) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "modal_can" && /조동사\s*can|\bcan\b/i.test(topic)) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "present_perfect" && (gf.isPresentPerfect || /현재완료(?!\s*진행형)|present\s+perfect(?!\s+(continuous|progressive))/i.test(topic))) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "passive" && gf.isPassive) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "to_infinitive" && gf.isToInfinitive) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "gerund" && gf.isGerund) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "present_perfect_progressive" && (gf.isPresentPerfectProgressive || /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(topic))) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "participial_modifier" && gf.isParticipialModifier) return { track, lessonKey, ...lesson };
      if (lesson.chapterKey === "causative" && gf.isCausative) return { track, lessonKey, ...lesson };
    }
  }

  if (gf.isBeQuestion || /be동사\s*의문문|\bam\/is\/are\b/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.be_question };
  if (gf.isDoQuestion || /일반동사\s*의문문|do\/does/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.do_question };
  if (gf.isDitransitive || /수여동사|간접목적어|직접목적어|4형식/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.ditransitive };
  if (gf.isPresentPerfectProgressive || /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.present_perfect_progressive };
  if (/현재진행형|present\s+continuous/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.present_continuous };
  if (gf.isPresentPerfect || /현재완료|present\s+perfect/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.present_perfect };
  if (gf.isPassive || /수동태|passive/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.passive };
  if (gf.isToInfinitive || /to부정사|to-infinitive|infinitive/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.to_infinitive };
  if (gf.isGerund || /동명사|gerund/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.gerund };
  if (gf.isParticipialModifier || /분사의\s*한정적\s*용법|participial\s*modifier/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.participial_modifier };
  if (gf.isRelativePronoun || /관계대명사|relative\s*pronoun/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.relative_pronoun_general };
  if (gf.isCausative || /사역동사|causative/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.causative };
  if (gf.isSoThatPurpose || /so that\s*구문|purpose clause/i.test(raw)) return { ...GENERIC_CHAPTER_BANK.so_that_purpose };

  return null;
}

function buildTextbookGuideBlock(input = {}) {
  const resolved = resolveTextbookLesson(input);
  if (!resolved || !resolved.guideKo || !resolved.guideKo.length) return "";
  const lessonLabel = resolved.lessonNo === "generic" ? "보조 챕터 매핑" : `${resolved.lessonNo}과`;
  const header = `[S17 교과서 1학기 매핑]\n- 학년 트랙: ${resolved.track}\n- 단원: ${lessonLabel}\n- 핵심 챕터: ${resolved.topicKo}\n`;
  const lines = resolved.guideKo.map((line) => `- ${line}`).join("\n");
  return `${header}${lines}`;
}

function pickOne(arr, idx) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr[idx % arr.length];
}

function stripNumbering(value) {
  return normalizeText(String(value || "").replace(/^\d+[.)-]?\s*/, ""));
}

function hasKoreanSentenceShape(q) {
  const t = stripNumbering(q);
  if (!t) return false;
  if (!/[가-힣]/.test(t)) return false;
  if (t.length < 5) return false;
  if (/^\[.*\]$/.test(t)) return false;
  return true;
}

function isBrokenQuestionLine(q) {
  const t = stripNumbering(q);
  if (!t) return true;
  if (/^\[.*\]$/.test(t)) return true;
  if (/^(8단어|be -ing|be\+pp|word count|clue)/i.test(t)) return true;
  if (/[A-Za-z]{3,},\s*[A-Za-z]{3,}/.test(t) && !/[가-힣]/.test(t)) return true;
  return false;
}

function hasProgressive(answer) {
  return /\b(am|is|are|was|were)\b[\w\s,'"-]{0,40}\b[a-z]+ing\b/i.test(answer);
}

function hasPerfect(answer) {
  return /\b(have|has)\b[\w\s,'"-]{0,30}\b([a-z]+ed|been|gone|done|seen|made|written|eaten|read|met|heard|finished|completed|lived|worked|learned|solved|visited|played|exercised|gotten|known|submitted|missed|started|used|attended)\b/i.test(answer);
}

function hasPerfectProgressive(answer) {
  return /\b(have|has)\s+been\s+[a-z]+ing\b/i.test(answer);
}

function hasPassive(answer) {
  return /\b(am|is|are|was|were|be|been|being)\b[\w\s,'"-]{0,30}\b([a-z]+ed|written|made|held|read|known|seen|understood|praised|invited|taken|translated|completed|sold|loved|awarded|submitted|carried|closed|announced|prepared|given)\b/i.test(answer);
}

function hasModalCan(answer) {
  return /\bcan\s+[a-z]+\b/i.test(answer);
}

function hasBeQuestion(answer) {
  return /^(Am|Is|Are)\b.*\?$/i.test(normalizeText(answer));
}

function hasDoQuestion(answer) {
  return /^(Do|Does)\b.*\?$/i.test(normalizeText(answer));
}

function hasDitransitive(answer) {
  const text = normalizeText(answer);
  if (!/\b(give|gives|gave|send|sends|sent|show|shows|showed|teach|teaches|taught|tell|tells|told|buy|buys|bought|offer|offers|offered|make|makes|made|find|finds|found|ask|asks|asked)\b/i.test(text)) {
    return false;
  }
  return /\bto\b|\bfor\b/i.test(text) || /\b(me|you|him|her|us|them)\b/.test(text);
}

function hasBadFinishedPastMarker(answer) {
  return /\b(yesterday|ago|last\s+(week|month|year|night|summer|winter|spring|fall|autumn)|in\s+(19|20)\d{2})\b/i.test(answer);
}

function enforceChapterHardLock(answer, input = {}) {
  const lesson = resolveTextbookLesson(input);
  const gf = input.grammarFocus || {};
  const text = normalizeText(answer);

  if (!text) return false;

  if ((lesson && lesson.chapterKey === "be_question") || gf.isBeQuestion) {
    return hasBeQuestion(text);
  }
  if ((lesson && lesson.chapterKey === "do_question") || gf.isDoQuestion) {
    return hasDoQuestion(text);
  }
  if ((lesson && lesson.chapterKey === "ditransitive") || gf.isDitransitive) {
    return hasDitransitive(text);
  }
  if ((lesson && lesson.chapterKey === "present_continuous") || /현재진행형|present\s+continuous/i.test(String(input.topic || ""))) {
    return hasProgressive(text);
  }
  if ((lesson && lesson.chapterKey === "present_perfect_progressive") || gf.isPresentPerfectProgressive || /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(String(input.topic || ""))) {
    return hasPerfectProgressive(text);
  }
  if ((lesson && lesson.chapterKey === "present_perfect") || gf.isPresentPerfect || /현재완료(?!\s*진행형)|present\s+perfect(?!\s+(continuous|progressive))/i.test(String(input.topic || ""))) {
    return hasPerfect(text) && !hasBadFinishedPastMarker(text) && !hasPerfectProgressive(text);
  }
  if ((lesson && lesson.chapterKey === "passive") || gf.isPassive) {
    return hasPassive(text);
  }
  if ((lesson && lesson.chapterKey === "modal_can") || /조동사\s*can|\bcan\b/i.test(String(input.topic || ""))) {
    return hasModalCan(text);
  }
  return true;
}

function getLessonQuestionFallbackBank(input = {}) {
  const lesson = resolveTextbookLesson(input);
  if (lesson && Array.isArray(lesson.questionFallbacksKo) && lesson.questionFallbacksKo.length) {
    return lesson.questionFallbacksKo.slice();
  }
  return [];
}

function getLessonAnswerFallbackBank(input = {}) {
  const lesson = resolveTextbookLesson(input);
  if (lesson && Array.isArray(lesson.answerFallbacksEn) && lesson.answerFallbacksEn.length) {
    return lesson.answerFallbacksEn.slice();
  }
  return [];
}

function makeLooseClue(answer) {
  const words = normalizeText(answer)
    .replace(/[.?!,]/g, "")
    .split(" ")
    .filter(Boolean)
    .filter((w) => w.length > 2);
  return words.slice(0, 4).join(", ");
}

function ensureQuestionLine(question, answer, input, idx) {
  const fallbackQ = getLessonQuestionFallbackBank(input);
  const clean = stripNumbering(question);

  if (hasKoreanSentenceShape(clean) && !isBrokenQuestionLine(clean)) {
    return clean;
  }

  const picked = pickOne(fallbackQ, idx);
  if (picked) return picked;

  const clue = makeLooseClue(answer);
  if (clue) return `주어진 단서를 사용하여 영어 문장을 쓰시오. (${clue})`;
  return "주어진 단서를 사용하여 영어 문장을 쓰시오.";
}

function ensureAnswerLine(answer, input, idx) {
  const fallbackA = getLessonAnswerFallbackBank(input);
  const clean = normalizeText(answer);
  if (enforceChapterHardLock(clean, input)) return clean;
  return pickOne(fallbackA, idx) || clean;
}

function dedupeAnswer(answer, seen, input, idx) {
  const key = normalizeText(answer).toLowerCase();
  if (!key) return answer;
  if (!seen.has(key)) {
    seen.add(key);
    return answer;
  }
  const fallbackA = getLessonAnswerFallbackBank(input);
  const picked = pickOne(fallbackA, idx + seen.size);
  if (picked && !seen.has(normalizeText(picked).toLowerCase())) {
    seen.add(normalizeText(picked).toLowerCase());
    return picked;
  }
  return answer;
}

module.exports = {
  TEXTBOOK_SEM1_CHAPTER_MAP,
  CHAPTER_COMPLETION_PROFILE,
  resolveTextbookLesson,
  buildTextbookGuideBlock,
  getLessonQuestionFallbackBank,
  getLessonAnswerFallbackBank,
  enforceChapterHardLock,
  ensureQuestionLine,
  ensureAnswerLine,
  dedupeAnswer,
  stripNumbering,
  normalizeText,
};
