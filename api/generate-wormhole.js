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

// --- ?듭떖 ?곗씠?? TEXTBOOK_GRAMMAR_MAP ---
const TEXTBOOK_GRAMMAR_MAP = {
  middle: {
    "泥쒖옱?뚯쁺??: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾 ?쒖젣", "議곕룞??will", "議곕룞??can"],
        3: ["?섎Ц???섎Ц臾?, "to遺?뺤궗??紐낆궗???⑸쾿"],
        4: ["怨쇨굅?쒖젣", "?숇챸??],
        5: ["鍮꾧탳湲?, "理쒖긽湲?],
        6: ["to遺?뺤궗??遺?ъ쟻 ?⑸쾿", "?묒냽??that"],
        7: ["?섏뿬?숈궗", "?묒냽??when"]
      },
      "以?": {
        1: ["?묒냽??if", "?섎Ц??to遺?뺤궗"],
        2: ["to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿", "二쇨꺽 愿怨꾨?紐낆궗"],
        3: ["?섎룞??, "?묒냽??although"],
        4: ["?꾩옱?꾨즺", "so ~ that 援щЦ"],
        5: ["5?뺤떇 臾몄옣(make/keep 紐⑹쟻???뺤슜??", "媛꾩젒?섎Ц臾?],
        6: ["吏媛곷룞??, "以?ъ뿭?숈궗"],
        7: ["?ъ뿭?숈궗", "it ~ to遺?뺤궗 援щЦ"],
        8: ["something ?뺤슜??, "紐⑹쟻寃?愿怨꾨?紐낆궗"]
      }
    },
    "泥쒖옱?댁긽湲?: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾 ?쒖젣", "?섎Ц臾?],
        3: ["紐낅졊臾?, "議곕룞??can", "議곕룞??will"],
        4: ["怨쇨굅?쒖젣", "媛먰깂臾?],
        5: ["there is(are) 援щЦ", "?숇챸??],
        6: ["?묒냽??that", "to遺?뺤궗??紐낆궗???⑸쾿"],
        7: ["媛먭컖?숈궗", "鍮꾧탳湲?],
        8: ["?묒냽??when", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"]
      },
      "以?": {
        1: ["?섏뿬?숈궗", "something ?뺤슜??],
        2: ["?묒냽??because", "?섎Ц??to遺?뺤궗"],
        3: ["?꾩옱?꾨즺", "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        4: ["理쒖긽湲?, "以?ъ뿭?숈궗"],
        5: ["二쇨꺽 愿怨꾨?紐낆궗", "吏媛곷룞??],
        6: ["?섎룞??, "so ~ that 援щЦ"],
        7: ["紐⑹쟻寃?愿怨꾨?紐낆궗", "?섎웾?뺤슜??],
        8: ["?묒냽??if", "it ~ to遺?뺤궗 援щЦ"]
      }
    },
    "吏?숈궗?〓???: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾 ?쒖젣", "there is(are) 援щЦ"],
        3: ["議곕룞??can", "媛먭컖?숈궗"],
        4: ["怨쇨굅?쒖젣", "議곕룞??will"],
        5: ["鍮꾧탳湲?, "理쒖긽湲?, "?묒냽??that"],
        6: ["to遺?뺤궗??紐낆궗???⑸쾿", "?숇챸??],
        7: ["to遺?뺤궗??遺?ъ쟻 ?⑸쾿", "?묒냽??when"],
        8: ["?묒냽??because", "議곕룞??have to"]
      },
      "以?": {
        1: ["5?뺤떇 臾몄옣", "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        2: ["?묒냽??if", "二쇨꺽 愿怨꾨?紐낆궗"],
        3: ["?꾩옱?꾨즺", "?섏뿬?숈궗"],
        4: ["?ъ뿭?숈궗", "so ~ that 援щЦ"],
        5: ["吏媛곷룞??, "紐⑹쟻寃?愿怨꾨?紐낆궗"],
        6: ["?섎룞??, "以?ъ뿭?숈궗"],
        7: ["?묒냽??while", "not only A but also B"],
        8: ["?묒냽??since", "媛꾩젒?섎Ц臾?]
      }
    },
    "鍮꾩긽?⑹쥌諛?: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["there is(are) 援щЦ", "?꾩옱吏꾪뻾 ?쒖젣"],
        3: ["怨쇨굅?쒖젣"],
        4: ["?섏뿬?숈궗", "議곕룞??will", "議곕룞??can"],
        5: ["?숇챸??, "媛먭컖?숈궗"],
        6: ["?묒냽??when", "鍮꾧탳湲?],
        7: ["to遺?뺤궗??紐낆궗???⑸쾿", "媛먰깂臾?],
        8: ["to遺?뺤궗??遺?ъ쟻 ?⑸쾿", "?묒냽??that"]
      },
      "以?": {
        1: ["理쒖긽湲?, "5?뺤떇 臾몄옣(keep)"],
        2: ["二쇨꺽 愿怨꾨?紐낆궗", "以?ъ뿭?숈궗"],
        3: ["?꾩옱?꾨즺", "?섎룞??],
        4: ["?ъ뿭?숈궗(make)", "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        5: ["as ~ as ?먭툒鍮꾧탳", "紐⑹쟻寃?愿怨꾨?紐낆궗"],
        6: ["if 議곌굔??, "吏媛곷룞??],
        7: ["so ~ that 援щЦ", "it ~ to 援щЦ"],
        8: ["not only ~ but also", "媛꾩젒?섎Ц臾?]
      }
    },
    "誘몃옒?붾Ц?곸씤": {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾??, "there is(are) 援щЦ"],
        3: ["怨쇨굅?쒖젣", "議곕룞??can"],
        4: ["?숇챸??, "議곕룞??will"],
        5: ["?섏뿬?숈궗", "議곕룞??should"],
        6: ["to遺?뺤궗??紐낆궗???⑸쾿", "?묒냽??when"],
        7: ["鍮꾧탳湲?, "理쒖긽湲?]
      },
      "以?": {
        1: ["二쇨꺽 愿怨꾨?紐낆궗", "something ?뺤슜??],
        2: ["紐⑹쟻寃?愿怨꾨?紐낆궗", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"],
        3: ["?섎룞??, "?묒냽??if"],
        4: ["以?ъ뿭?숈궗", "it ~ to遺?뺤궗 援щЦ"],
        5: ["to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿", "?꾩옱?꾨즺"],
        6: ["吏媛곷룞??, "?ъ뿭?숈궗"],
        7: ["so ~ that 援щЦ", "遺꾩궗???⑸쾿"],
        8: ["媛꾩젒?섎Ц臾?, "?섎Ц??to遺?뺤궗"]
      }
    },
    "?숈븘?대퀝誘?: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?섎Ц臾?, "紐낅졊臾?],
        3: ["議곕룞??can", "議곕룞??will", "?꾩옱吏꾪뻾?쒖젣"],
        4: ["怨쇨굅?쒖젣", "there is(are) 援щЦ"],
        5: ["want to遺?뺤궗", "鍮꾩씤移?＜??it"],
        6: ["媛먭컖?숈궗", "?숇챸?щ? 痍⑦븯???숈궗"],
        7: ["鍮꾧탳湲?, "?묒냽??when"],
        8: ["?섏뿬?숈궗", "?묒냽??that"]
      },
      "以?": {
        1: ["to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿", "理쒖긽湲?],
        2: ["?묒냽??if", "?섎룞??],
        3: ["二쇨꺽 愿怨꾨?紐낆궗", "5?뺤떇 臾몄옣(keep, make)"],
        4: ["?꾩옱?꾨즺", "以?ъ뿭?숈궗"],
        5: ["it ~ to 援щЦ", "the 鍮꾧탳湲? the 鍮꾧탳湲?],
        6: ["?섏쓽 ?쇱튂", "吏媛곷룞??],
        7: ["紐⑹쟻寃?愿怨꾨?紐낆궗", "?묒냽??although"],
        8: ["?섎Ц??to遺?뺤궗", "so ~ that 援щЦ"]
      },
      "以?": {
        1: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "愿怨꾨?紐낆궗 what"],
        2: ["二쇱뼱?숈궗 ?섏씪移?, "議곕룞?ъ쓽 ?섎룞??],
        3: ["?ъ뿭?숈궗", "It ~ that 媛뺤“援щЦ"],
        4: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "?묒냽??since"],
        5: ["媛?뺣쾿 怨쇨굅", "?섎Ц??to遺?뺤궗"],
        6: ["too ~ to 援щЦ", "?뺤슜??+ enough 援щЦ", "so that 援щЦ"],
        7: ["?묒냽??as", "?묒냽??while", "?묒냽??since", "?뚯쑀寃?愿怨꾨?紐낆궗"],
        8: ["遺꾩궗援щЦ", "怨쇨굅?꾨즺"]
      }
    },
    "?숈븘?ㅼ젙誘?: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾?쒖젣", "議곕룞??can", "議곕룞??will"],
        3: ["怨쇨굅?쒖젣", "紐낅졊臾?],
        4: ["?숇챸?щ? 痍⑦븯???숈궗", "be going to"],
        5: ["鍮꾧탳湲?, "理쒖긽湲?, "there is(are)"],
        6: ["want to遺?뺤궗", "?묒냽??that"],
        7: ["to遺?뺤궗??遺?ъ쟻 ?⑸쾿", "?묒냽??when"],
        8: ["?섏뿬?숈궗", "鍮꾩씤移?＜??it"]
      },
      "以?": {
        1: ["to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿", "5?뺤떇??臾몄옣(make)"],
        2: ["紐⑹쟻寃?愿怨꾨?紐낆궗", "以?ъ뿭?숈궗"],
        3: ["?섎룞??, "議곕룞??have to"],
        4: ["二쇨꺽 愿怨꾨?紐낆궗", "?묒냽??if"],
        5: ["?묒냽??that", "議곕룞??used to"],
        6: ["吏媛곷룞??, "so ~ that 援щЦ"],
        7: ["it ~ to 援щЦ", "5?뺤떇??臾몄옣(call)"],
        8: ["?꾩옱?꾨즺", "something ?뺤슜??]
      },
      "以?": {
        1: ["?묒냽??whether", "?묒냽??if", "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        2: ["?ъ뿭?숈궗", "so that 援щЦ"],
        3: ["愿怨꾨?紐낆궗??怨꾩냽???⑸쾿", "It ~ that 媛뺤“援щЦ", "媛二쇱뼱 吏꾩＜??援щЦ"],
        4: ["?꾩옱?꾨즺 吏꾪뻾??, "?섎Ц??+ to遺?뺤궗"],
        5: ["遺꾩궗???쒖젙???⑸쾿", "?먭툒鍮꾧탳"],
        6: ["怨쇨굅?꾨즺", "愿怨꾨?紐낆궗 what"],
        7: ["遺꾩궗援щЦ", "?묒냽??as"],
        8: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "媛?뺣쾿 怨쇨굅"]
      }
    },
    "?λ쪧源湲고깮": {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾 ?쒖젣", "?숇챸??],
        3: ["怨쇨굅?쒖젣", "?묒냽??when"],
        4: ["to遺?뺤궗??紐낆궗???⑸쾿", "議곕룞??should", "議곕룞??will"],
        5: ["?ш??紐낆궗", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"],
        6: ["媛먭컖?숈궗", "?묒냽??because"],
        7: ["5?뺤떇??臾몄옣", "?묒냽??that"],
        8: ["媛먰깂臾?, "something ?뺤슜??]
      },
      "以?": {
        1: ["4?뺤떇 臾몄옣", "二쇨꺽 愿怨꾨?紐낆궗"],
        2: ["?꾩옱?꾨즺", "鍮꾧탳湲?, "理쒖긽湲?],
        3: ["to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿", "?묒냽??if"],
        4: ["so ~ that 援щЦ", "?섎룞??],
        5: ["以?ъ뿭?숈궗", "紐⑹쟻寃?愿怨꾨?紐낆궗"],
        6: ["吏媛곷룞??, "愿怨꾨???how"],
        7: ["?ъ뿭?숈궗", "?먭툒 鍮꾧탳援щЦ"],
        8: ["it ~ to 援щЦ", "?섎Ц??+ to遺?뺤궗"]
      }
    },
    "YBM源???: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["be?숈궗 ?섎Ц臾?, "?쇰컲?숈궗 ?섎Ц臾?, "?꾩옱吏꾪뻾 ?쒖젣"],
        3: ["怨쇨굅?쒖젣", "議곕룞??will"],
        4: ["?숇챸??, "there is(are) 援щЦ"],
        5: ["to遺?뺤궗??紐낆궗???⑸쾿", "?ш??紐낆궗"],
        6: ["?묒냽??when", "議곕룞??should"],
        7: ["鍮꾧탳湲?, "理쒖긽湲?],
        8: ["?섏뿬?숈궗", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"]
      },
      "以?": {
        1: ["?묒냽??that", "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        2: ["?꾩옱?꾨즺", "鍮꾧탳湲??섏떇"],
        3: ["二쇨꺽 愿怨꾨?紐낆궗", "need to"],
        4: ["?묒냽??after", "?묒냽??before", "?섎룞??],
        5: ["?ъ뿭?숈궗", "紐⑹쟻寃?愿怨꾨?紐낆궗"],
        6: ["?묒냽??if", "it ~ to 援щЦ"],
        7: ["遺꾩궗", "遺꾩궗援щЦ", "how to遺?뺤궗"],
        8: ["媛꾩젒?섎Ц臾?, "吏媛곷룞??]
      }
    },
    "YBM諛뺤???: {
      "以?": {
        1: ["be?숈궗", "?쇰컲?숈궗"],
        2: ["?꾩옱吏꾪뻾 ?쒖젣", "議곕룞??will", "議곕룞??can"],
        3: ["怨쇨굅?쒖젣", "紐낅졊臾?],
        4: ["to遺?뺤궗??紐낆궗???⑸쾿", "?묒냽??when"],
        5: ["鍮꾧탳湲?, "媛먭컖?숈궗"],
        6: ["?숇챸??, "?섏뿬?숈궗"],
        7: ["?묒냽??that", "媛먰깂臾?],
        8: ["?ш??紐낆궗", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"]
      },
      "以?": {
        1: ["理쒖긽湲?, "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿"],
        2: ["?묒냽??if", "?ъ뿭?숈궗"],
        3: ["二쇨꺽 愿怨꾨?紐낆궗", "?섎Ц??+ to遺?뺤궗"],
        4: ["鍮꾧탳湲??섏떇??, "?섎룞??],
        5: ["it ~ to 援щЦ", "紐낅졊臾?and(or)"],
        6: ["?꾩옱?꾨즺", "?묒냽??although"],
        7: ["以?ъ뿭?숈궗", "紐⑹쟻寃?愿怨꾨?紐낆궗"],
        8: ["?먭툒鍮꾧탳", "so ~ that 援щЦ"]
      },
      "以?": {
        1: ["媛뺤“??do", "愿怨꾨?紐낆궗 what"],
        2: ["?꾩옱?꾨즺吏꾪뻾??, "遺꾩궗???쒖젙???⑸쾿"],
        3: ["it ~ that 媛뺤“援щЦ", "have + ?щЪ + p.p."],
        4: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "媛?뺣쾿 怨쇨굅"],
        5: ["怨쇨굅?꾨즺", "so ~ that 援щЦ", "so that 援щЦ"],
        6: ["愿怨꾨?紐낆궗??怨꾩냽???⑸쾿", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"],
        7: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "愿怨꾨???],
        8: ["遺꾩궗援щЦ", "?숇챸?ъ쓽 愿?⑺몴??],
        9: ["I wish 媛?뺣쾿", "媛꾩젒?섎Ц臾?whether"]
      }
    },
    "泥쒖옱?뺤궗??: {
      "以?": {
        1: ["媛꾩젒?섎Ц臾?, "愿怨꾨?紐낆궗??怨꾩냽???⑸쾿"],
        2: ["怨쇨굅?꾨즺", "鍮꾧탳湲?媛뺤“"],
        3: ["enough to", "not only A but also B"],
        4: ["遺꾩궗援щЦ", "愿怨꾨?紐낆궗 what"],
        5: ["媛?뺣쾿 怨쇨굅", "愿怨꾨?紐낆궗 whose"],
        6: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "It is ~ that 媛뺤“"],
        7: ["媛꾩젒?붾쾿", "紐낆궗??if"],
        8: ["遺?뺣?紐낆궗", "以?ъ뿭?숈궗"]
      }
    },
    "泥쒖옱?댁옱??: {
      "以?": {
        1: ["愿怨꾨?紐낆궗 what", "吏媛곷룞??],
        2: ["遺꾩궗???꾩튂?섏떇", "?묒냽??since", "?묒냽??though"],
        3: ["?꾩옱?꾨즺吏꾪뻾", "so ~ that 援щЦ"],
        4: ["愿怨꾨???, "?묒냽??if", "?묒냽??whether"],
        5: ["怨쇨굅?꾨즺", "It is ~ that 媛뺤“"],
        6: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "媛?뺣쾿 怨쇨굅"],
        7: ["遺꾩궗援щЦ", "議곕룞?ш? ?ы븿???섎룞??],
        8: ["議곕룞??have p.p.", "愿怨꾨?紐낆궗??怨꾩냽???⑸쾿"]
      }
    },
    "吏?숈궗誘쇱갔洹?: {
      "以?": {
        1: ["愿怨꾨?紐낆궗 what", "吏媛곷룞??],
        2: ["媛二쇱뼱 it???섎??곸쓽 二쇱뼱", "遺꾩궗???쒖젙???⑸쾿"],
        3: ["not only A but also B", "媛꾩젒?섎Ц臾?],
        4: ["怨쇨굅?꾨즺", "to遺?뺤궗??遺?ъ쟻 ?⑸쾿"],
        5: ["?紐낆궗 one", "遺꾩궗援щЦ"],
        6: ["It is ~ that 媛뺤“", "however"],
        7: ["媛?뺣쾿 怨쇨굅", "5?뺤떇 臾몄옣"],
        8: ["too ~ to 援щЦ", "no one 援щЦ"]
      }
    },
    "鍮꾩긽源吏꾩셿": {
      "以?": {
        1: ["愿怨꾨?紐낆궗 what", "愿怨꾨???],
        2: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "?꾩옱?꾨즺吏꾪뻾??],
        3: ["?묒냽??whether", "?묒냽??if", "怨쇨굅?꾨즺"],
        4: ["遺꾩궗???쒖젙???⑸쾿", "媛紐⑹쟻??it"],
        5: ["遺꾩궗援щЦ", "so that 援щЦ"],
        6: ["it ~ that 媛뺤“援щЦ", "have + ?щЪ + p.p."],
        7: ["?묒냽??as", "?섏쓽 ?쇱튂"],
        8: ["媛?뺣쾿 怨쇨굅", "with + 紐⑹쟻??+ 遺꾩궗"]
      }
    },
    "誘몃옒?붿턀?고씗": {
      "以?": {
        1: ["愿怨꾨?紐낆궗 what", "?묒냽??although"],
        2: ["it ~ that 媛뺤“援щЦ", "愿怨꾨?紐낆궗??怨꾩냽???⑸쾿"],
        3: ["遺꾩궗???쒖젙???⑸쾿", "媛뺤“??do"],
        4: ["媛꾩젒?섎Ц臾?, "怨쇨굅?꾨즺"],
        5: ["遺꾩궗援щЦ", "not only A but also B"],
        6: ["愿怨꾨???, "?묒냽遺??however", "thus"],
        7: ["?뚯쑀寃?愿怨꾨?紐낆궗", "媛?뺣쾿 怨쇨굅"]
      }
    },
    "?λ쪧?묓쁽沅?: {
      "以?": {
        1: ["媛二쇱뼱 it???섎??곸쓽 二쇱뼱", "愿怨꾨?紐낆궗??怨꾩냽???⑸쾿"],
        2: ["it ~ that 媛뺤“援щЦ", "5?뺤떇 臾몄옣"],
        3: ["愿怨꾨?紐낆궗 what", "?ъ뿭?숈궗"],
        4: ["遺꾩궗援щЦ", "怨쇨굅?꾨즺"],
        5: ["?섎Ц??+ to遺?뺤궗", "the 鍮꾧탳湲? the 鍮꾧탳湲?],
        6: ["媛꾩젒?붾쾿", "吏媛곷룞??],
        7: ["媛?뺣쾿 怨쇨굅", "so ~ that 援щЦ"]
      }
    },
    "?λ쪧源?깃낀": {
      "以?": {
        1: ["?꾩옱?꾨즺 吏꾪뻾??, "愿怨꾨?紐낆궗 what"],
        2: ["愿怨꾨?紐낆궗??怨꾩냽???⑸쾿", "遺꾩궗???쒖젙???⑸쾿"],
        3: ["?묒냽??since", "怨쇨굅?꾨즺"],
        4: ["?묒냽??whether", "?묒냽??if", "議곕룞?ъ쓽 ?섎룞??],
        5: ["to遺?뺤궗???섎??곸쓽 二쇱뼱", "愿怨꾨???where"],
        6: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "遺꾩궗援щЦ"],
        7: ["媛?뺣쾿 怨쇨굅", "so that 援щЦ"]
      }
    },
    "湲덉꽦理쒖씤泥?: {
      "以?": {
        1: ["?ъ뿭?숈궗", "?숇챸?ъ쓽 愿?⑹쟻 ?쒗쁽"],
        2: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "to遺?뺤궗???섎??곸쓽 二쇱뼱"],
        3: ["not only A but also B", "I wish 媛?뺣쾿"],
        4: ["怨쇨굅?꾨즺", "as ~ as ?먭툒鍮꾧탳"],
        5: ["so ~ that 援щЦ", "吏媛곷룞??],
        6: ["it ~ that 媛뺤“援щЦ", "遺꾩궗援щЦ"],
        7: ["?뺤슜??+ to遺?뺤궗", "so ?숈궗 二쇱뼱"],
        8: ["?묒냽??whether", "It's time 媛?뺣쾿"]
      }
    },
    "YBM?〓???: {
      "以?": {
        1: ["too ~ to 援щЦ", "to遺?뺤궗??遺?뺥몴??],
        2: ["遺꾩궗援щЦ", "紐낆궗??if"],
        3: ["the 鍮꾧탳湲? the 鍮꾧탳湲?, "it ~ that 媛뺤“援щЦ"],
        4: ["?묒냽??although", "it seems to 援щЦ"],
        5: ["愿怨꾨?紐낆궗 what", "?꾩옱?꾨즺 吏꾪뻾"],
        6: ["?먭툒鍮꾧탳", "怨쇨굅?꾨즺"],
        7: ["媛?뺣쾿 怨쇨굅", "so that 援щЦ"],
        8: ["?묒냽??while", "not only A but also B"]
      }
    }
  }
};

// --- ?좏떥由ы떚 ?⑥닔 ---

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSelectedGrade(value = "") {
  const grade = String(value || "")
    .replace(/\.json$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return /^(middle|high|elementary)\d+$/.test(grade) ? grade : "auto";
}

function inferSelectedGradeFromText(text = "") {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const middle = "\\uC911";
  const high = "\\uACE0";
  if (new RegExp(`\\bmiddle\\s*1\\b|\\bmiddle1\\b|${middle}\\s*1|${middle}1|\\uC911\\uD559\\uAD50\\s*1`).test(normalized)) return "middle1";
  if (new RegExp(`\\bmiddle\\s*2\\b|\\bmiddle2\\b|${middle}\\s*2|${middle}2|\\uC911\\uD559\\uAD50\\s*2`).test(normalized)) return "middle2";
  if (new RegExp(`\\bmiddle\\s*3\\b|\\bmiddle3\\b|${middle}\\s*3|${middle}3|\\uC911\\uD559\\uAD50\\s*3`).test(normalized)) return "middle3";
  if (new RegExp(`\\bhigh\\s*1\\b|\\bhigh1\\b|${high}\\s*1|${high}1|\\uACE0\\uB4F1\\uD559\\uAD50\\s*1`).test(normalized)) return "high1";
  if (new RegExp(`\\bhigh\\s*2\\b|\\bhigh2\\b|${high}\\s*2|${high}2|\\uACE0\\uB4F1\\uD559\\uAD50\\s*2`).test(normalized)) return "high2";
  if (new RegExp(`\\bhigh\\s*3\\b|\\bhigh3\\b|${high}\\s*3|${high}3|\\uACE0\\uB4F1\\uD559\\uAD50\\s*3`).test(normalized)) return "high3";
  return "auto";
}


function selectedGradeLabel(value = "") {
  const grade = normalizeSelectedGrade(value);
  const labels = { middle1: "以?", middle2: "以?", middle3: "以?", high1: "怨?", high2: "怨?", high3: "怨?" };
  return labels[grade] || "";
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
  const koreanMatches = t.match(/[媛-??/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();
  if (/珥덈벑|珥?1-6]|abc\s*starter|elementary/.test(t)) return "elementary";
  if (/怨?|怨?|怨?|怨좊벑|?섎뒫|紐⑥쓽怨좎궗|high/.test(t)) return "high";
  if (/以?|以?|以?|以묐벑|middle/.test(t)) return "middle";
  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/理쒓퀬?쒕룄|怨좊궃??洹뱀긽|advanced|extreme/.test(t)) return "advanced";
  if (/蹂??transform|rewrite|?ш뎄??.test(t)) return "transform";
  if (/?댁떊|?숆탳?쒗뿕|以묎컙怨좎궗|湲곕쭚怨좎궗|school/.test(t)) return "school-exam";
  return "grammar";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|理쒓퀬?쒕룄|洹뱀긽/.test(t)) return "extreme";
  if (/high|怨좊궃????.test(t)) return "high";
  if (/basic|湲곗큹|??.test(t)) return "basic";
  if (/standard|以?蹂댄넻/.test(t)) return "standard";
  return "high";
}

function inferTopic(text = "") {
  const t = String(text || "");
  const topicPatterns = [
    "?꾩옱?꾨즺", "?꾩옱吏꾪뻾??, "怨쇨굅?꾨즺", "?섎룞??, "愿怨꾨?紐낆궗", "愿怨꾨???,
    "?숇챸??, "to遺?뺤궗", "媛?뺣쾿", "鍮꾧탳湲?, "理쒖긽湲?, "?섏씪移?, "議곕룞??,
    "?쒖젣", "?묒냽??, "遺꾩궗", "遺꾩궗援щЦ", "遺?뺣?紐낆궗", "?紐낆궗", "紐낆궗??,
    "?뺤슜?ъ젅", "遺?ъ젅", "?꾩튂??, "?꾩튂", "媛뺤“援щЦ"
  ];
  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }
  const lower = t.toLowerCase();
  if (/\bafter\b/.test(lower) && /\bbefore\b/.test(lower)) return "after_before";
  if (/after[_\s,/-]*before/.test(lower) || /before[_\s,/-]*after/.test(lower)) return "after_before";
  if (/present perfect/.test(lower)) return "?꾩옱?꾨즺";
  if (/passive/.test(lower)) return "?섎룞??;
  if (/relative pronoun/.test(lower)) return "愿怨꾨?紐낆궗";
  if (/gerund/.test(lower)) return "?숇챸??;
  if (/infinitive|to-infinitive/.test(lower)) return "to遺?뺤궗";
  if (/subjunctive/.test(lower)) return "媛?뺣쾿";
  if (/tense/.test(lower)) return "?쒖젣";
  return "臾몃쾿 醫낇빀";
}

function inferGradeLabel(text = "", level = "middle") {
  const t = String(text || "");
  if (/珥?/.test(t)) return "珥?";
  if (/珥?/.test(t)) return "珥?";
  if (/珥?/.test(t)) return "珥?";
  if (/珥?/.test(t)) return "珥?";
  if (/珥?/.test(t)) return "珥?";
  if (/珥?/.test(t)) return "珥?";
  if (/以?/.test(t)) return "以?";
  if (/以?/.test(t)) return "以?";
  if (/以?/.test(t)) return "以?";
  if (/怨?/.test(t)) return "怨?";
  if (/怨?/.test(t)) return "怨?";
  if (/怨?/.test(t)) return "怨?";
  if (level === "elementary") return "珥덈벑";
  if (level === "high") return "怨좊벑";
  return "以묐벑";
}

function normalizeGrammarLabel(label = "") {
  const t = String(label || "").trim();
  const replacements = {
    "?꾩옱吏꾪뻾??: "?꾩옱吏꾪뻾 ?쒖젣",
    "?꾩옱吏꾪뻾?쒖젣": "?꾩옱吏꾪뻾 ?쒖젣",
    "to遺?뺤궗??紐낆궗?곸슜踰?: "to遺?뺤궗??紐낆궗???⑸쾿",
    "to遺?뺤궗??遺?ъ쟻?⑸쾿": "to遺?뺤궗??遺?ъ쟻 ?⑸쾿",
    "to遺?뺤궗???뺤슜?ъ쟻?⑸쾿": "to遺?뺤궗???뺤슜?ъ쟻 ?⑸쾿",
    "want to遺?뺤궗(紐낆궗??": "want to遺?뺤궗",
    "議곕룞??will(誘몃옒?쒖젣)": "議곕룞??will",
    "4?뺤떇 臾몄옣": "?섏뿬?숈궗",
    "5?뺤떇 臾몄옣": "5?뺤떇??臾몄옣",
    "it ~ to 援щЦ": "it ~ to遺?뺤궗 援щЦ",
    "it ~to 媛二쇱뼱, 吏꾩＜??援щЦ": "it ~ to遺?뺤궗 援щЦ",
    "媛二쇱뼱,吏꾩＜??: "媛二쇱뼱 吏꾩＜??援щЦ",
    "?꾩옱?꾨즺吏꾪뻾": "?꾩옱?꾨즺 吏꾪뻾??,
    "?꾩옱?꾨즺 吏꾪뻾": "?꾩옱?꾨즺 吏꾪뻾??,
    "It is ~ that 媛뺤“": "It ~ that 媛뺤“援щЦ",
    "It is ??that 媛뺤“": "It ~ that 媛뺤“援щЦ",
    "It ??that 媛뺤“": "It ~ that 媛뺤“援щЦ",
    "it ??that 媛뺤“": "it ~ that 媛뺤“援щЦ",
    "the 鍮꾧탳湲? the 鍮꾧탳湲?: "the 鍮꾧탳湲? the 鍮꾧탳湲?,
    "?먭툒 鍮꾧탳援щЦ": "?먭툒鍮꾧탳",
    "as ~ as ?먭툒鍮꾧탳": "?먭툒鍮꾧탳",
    "遺꾩궗???꾩튂?섏떇": "遺꾩궗???쒖젙???⑸쾿",
    "遺꾩궗(?섏떇??": "遺꾩궗",
    "?숇챸?ъ쓽 愿?⑹쟻 ?쒗쁽": "?숇챸?ъ쓽 愿?⑺몴??,
  };
  return replacements[t] || t;
}

function normalizePublisherName(text = "") {
  const t = String(text || "").replace(/\s+/g, "");
  const aliasMap = {
    "泥쒖옱?뚯쁺??: ["泥쒖옱?뚯쁺??, "泥쒖옱??, "?뚯쁺??],
    "泥쒖옱?댁긽湲?: ["泥쒖옱?댁긽湲?, "?댁긽湲?],
    "吏?숈궗?〓???: ["吏?숈궗?〓???, "?〓??뺤???, "吏?숈넚", "?〓???],
    "鍮꾩긽?⑹쥌諛?: ["鍮꾩긽?⑹쥌諛?, "鍮꾩긽??, "?⑹쥌諛?],
    "誘몃옒?붾Ц?곸씤": ["誘몃옒?붾Ц?곸씤", "臾몄쁺??],
    "?숈븘?대퀝誘?: ["?숈븘?대퀝誘?, "?대퀝誘?],
    "?숈븘?ㅼ젙誘?: ["?숈븘?ㅼ젙誘?, "?숈븘??, "?ㅼ젙誘?],
    "?λ쪧源湲고깮": ["?λ쪧源湲고깮", "源湲고깮"],
    "YBM源???: ["YBM源???, "ybm源???, "源???],
    "YBM諛뺤???: ["YBM諛뺤???, "ybm諛뺤???, "諛뺤???],
    "泥쒖옱?뺤궗??: ["泥쒖옱?뺤궗??, "?뺤궗??],
    "泥쒖옱?댁옱??: ["泥쒖옱?댁옱??, "?댁옱??],
    "吏?숈궗誘쇱갔洹?: ["吏?숈궗誘쇱갔洹?, "誘쇱갔洹?],
    "鍮꾩긽源吏꾩셿": ["鍮꾩긽源吏꾩셿", "源吏꾩셿"],
    "誘몃옒?붿턀?고씗": ["誘몃옒?붿턀?고씗", "理쒖뿰??],
    "?λ쪧?묓쁽沅?: ["?λ쪧?묓쁽沅?, "?묓쁽沅?],
    "?λ쪧源?깃낀": ["?λ쪧源?깃낀", "源?깃낀"],
    "湲덉꽦理쒖씤泥?: ["湲덉꽦理쒖씤泥?, "理쒖씤泥?],
    "YBM?〓???: ["YBM?〓???, "ybm?〓???, "?〓??븒bm"]
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
  const gradeMatch = source.match(/以?[123])/);
  const publisher = normalizePublisherName(source);
  const lessonMatch =
    source.match(/([1-9]|10)怨?) ||
    source.match(/([1-9]|10)?⑥썝/) ||
    source.match(/lesson([1-9]|10)/i) ||
    source.match(/lesson\s*([1-9]|10)/i);

  if (!gradeMatch || !lessonMatch || !publisher) return null;

  return {
    level: "middle",
    gradeLabel: `以?{gradeMatch[1]}`,
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
    sanitizeString(body.worksheetTitle || ""),
    sanitizeString(body.requestedChapter || ""),
    sanitizeString(body.chapter || ""),
    sanitizeString(body.chapterKey || ""),
    sanitizeString(body.canonical || "")
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
  const selectedGrade =
    normalizeSelectedGrade(body.selectedGrade || body.rawBody?.selectedGrade || "auto") !== "auto"
      ? normalizeSelectedGrade(body.selectedGrade || body.rawBody?.selectedGrade || "auto")
      : inferSelectedGradeFromText(mergedText);
  console.info("[GRADE_LOCK_TEST]", {
    mergedText,
    explicitSelectedGrade: body.selectedGrade || body.rawBody?.selectedGrade || "auto",
    inferred: inferSelectedGradeFromText(mergedText),
    selectedGrade
  });
  const gradeLabel = selectedGradeLabel(selectedGrade) || textbookResolved?.gradeLabel || inferGradeLabel(mergedText, level);

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
    selectedGrade,
    requestedChapter: sanitizeString(body.requestedChapter || body.chapter || body.chapterKey || body.canonical || ""),
    rawBody: body,
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
  if (difficulty === "extreme") return "理쒓퀬?쒕룄";
  if (difficulty === "high") return "怨좊궃??;
  if (difficulty === "standard") return "?쒖??쒕룄";
  return "湲곕낯?쒕룄";
}

function shortenTopicForTitle(topic = "") {
  const parts = String(topic).split("+").map(v => v.trim()).filter(Boolean);
  if (parts.length <= 2) return topic;
  return `${parts[0]} + ${parts[1]} ??;
}

function buildGrammarSystemPrompt(input) {
  const isKo = input.language !== "en";
  const isHigh = input.difficulty === "high" || input.difficulty === "extreme";
  const difficultyLine = isHigh
    ? "紐⑤뱺 臾명빆? ?ㅼ젣 ?댁떊 5?먰삎 蹂蹂?臾명빆泥섎읆 異쒖젣?쒕떎."
    : "臾명빆 ?쒖씠?꾨뒗 ?붿껌 ?섏???留욎텣??";
  if (!isKo) {
    return `
You are the MARCUS Wormhole high-difficulty grammar exam generator.
STRICT RULES:
1. ALL questions must be 5-option multiple choice.
2. Every question must have exactly five choices:
   ??...
   ??...
   ??...
   ??...
   ??...
3. Do NOT create 4-choice items.
4. Do NOT create subjective items, sentence arrangement items, rewrite items, or free-response items.
5. Do NOT place answers or explanations directly under the questions.
6. Put all answers only in the [[ANSWERS]] section.
7. Keep the worksheet exam-like, polished, and school-test appropriate.
8. Match the requested number of questions exactly.
- 諛섎뱶???뺥솗??${input.count}臾명빆???묒꽦??寃?- 1踰덈???${input.count}踰덇퉴吏 ?곗냽 踰덊샇瑜??좎???寃?- ?꾨씫 踰덊샇, 以묐났 踰덊샇 ?덈? 湲덉?
- [[QUESTIONS]]? [[ANSWERS]]??臾명빆 ?섎뒗 諛섎뱶???숈씪?댁빞 ??- 臾명빆 ?섍? 遺議깊븯硫??쒖텧?섏? 留먭퀬 ?앷퉴吏 梨꾩슱 寃?
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
??...
??...
??...
??...
??...

2. ...
??...
??...
??...
??...
??...

[[ANSWERS]]
1. ??- explanation
2. ??- explanation
...
`.trim();
  }

  return `
?뱀떊? 留덉빱?ㅼ썫? ?꾩슜 怨좊궃???곸뼱 臾몃쾿 ?ㅼ쟾紐⑥쓽怨좎궗 ?앹꽦 ?붿쭊?대떎.

[?덈? 洹쒖튃]
1. 紐⑤뱺 臾명빆? 諛섎뱶??媛앷???5吏?좊떎?뺤쑝濡??묒꽦?쒕떎.
2. 紐⑤뱺 臾명빆???좏깮吏??諛섎뱶???ㅼ쓬 ?뺤떇???곕Ⅸ??
   ??...
   ??...
   ??...
   ??...
   ??...
3. 4吏?좊떎(a,b,c,d) 湲덉?.
4. 二쇨??? ?쒖닠?? 臾몄옣 諛곗뿴, ?ш뎄?? ?곸옉??湲덉?.
5. 臾몄젣 諛붾줈 ?꾨옒???뺣떟/?댁꽕???곗? 留?寃?
6. ?뺣떟怨??댁꽕? 諛섎뱶??[[ANSWERS]] ?뱀뀡?먮쭔 紐⑥븘 ??寃?
7. ?ㅼ젣 ?숆탳?쒗뿕/?댁떊/怨좊궃???ㅼ쟾紐⑥쓽怨좎궗泥섎읆 蹂댁씠寃??묒꽦??寃?
8. ?붿껌??臾명빆 ?섎? ?뺥솗??留욎텧 寃?
- 諛섎뱶???뺥솗??${input.count}臾명빆???묒꽦??寃?- 1踰덈???${input.count}踰덇퉴吏 ?곗냽 踰덊샇瑜??좎???寃?- ?꾨씫 踰덊샇, 以묐났 踰덊샇 ?덈? 湲덉?
- [[QUESTIONS]]? [[ANSWERS]]??臾명빆 ?섎뒗 諛섎뱶???숈씪?댁빞 ??- 臾명빆 ?섍? 遺議깊븯硫??쒖텧?섏? 留먭퀬 ?앷퉴吏 梨꾩슱 寃?
[?쒖씠??洹쒖튃]
- ${difficultyLine}
- ?⑥닚 ?붽린?뺤씠 ?꾨땲??臾몄옣 援ъ“? ?대쾿 ?먮떒 以묒떖?쇰줈 異쒖젣??寃?
- ?ㅻ떟 ?좎???留ㅼ슦 洹몃윺??븯寃?留뚮뱾 寃?
- 蹂蹂꾨젰 ?덈뒗 ?⑥젙 ?좎?瑜??ы븿??寃?
[?좏삎 遺꾨같 洹쒖튃]
?꾩껜 ?명듃???꾨옒 ?좏삎???욎뼱??異쒖젣?쒕떎.
- ?댁깋??臾몄옣 李얘린
- ?щ컮瑜?臾몄옣??媛쒖닔
- ?댁깋??臾몄옣??媛쒖닔
- ?щ컮瑜?臾몄옣 怨좊Ⅴ湲?- ?由?臾몄옣 怨좊Ⅴ湲?- 媛숈? 臾몃쾿 援ъ“ 李얘린
- 諛묒쨪 移??대쾿 ?먮떒
- ?뚮쭪? ?댄삎/?댄쐶 ?좏깮
- 怨좊궃??蹂蹂?臾명빆

媛숈? ?좏삎留??곗냽 諛섎났?섏? 留?寃?
[High Difficulty 洹쒖튃]
- 理쒖냼 25% ?댁긽 臾명빆? 怨좊궃??蹂蹂?臾명빆?쇰줈 ?ㅺ퀎?쒕떎.
- ?대떦 臾명빆 ?쒕ぉ ?먮뒗 臾명빆 吏?쒕Ц??[High Difficulty] ?쒓린瑜?遺숈뿬???쒕떎.
- ?? ?꾩껜 ?명듃??湲곕낯 ?섏? ?먯껜媛 怨좊궃?꾩뿬???쒕떎.

[異쒕젰 ?뺤떇]
[[TITLE]]
(?쒕ぉ ??以?

[[INSTRUCTIONS]]
(?섑뿕???덈궡臾????⑤씫)

[[QUESTIONS]]
1. ...
??...
??...
??...
??...
??...

2. ...
??...
??...
??...
??...
??...

[[ANSWERS]]
1. ??- ?댁꽕
2. ??- ?댁꽕
...
`.trim();
}

function buildGrammarUserPrompt(input) {
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const displayTopic = shortenTopicForTitle(input.topic);
  let title = "";
  if (input.textbook) {
    title = input.language === "en" 
      ? `${input.textbook.gradeLabel} ${input.textbook.publisher} Lesson ${input.textbook.lesson} ${displayTopic} Wormhole ${difficultyLabel}` 
      : `${input.textbook.gradeLabel} ${input.textbook.publisher} ${input.textbook.lesson}怨?${displayTopic} 留덉빱?ㅼ썫? ${difficultyLabel}`;
  } else {
    title = input.language === "en"
      ? `${input.gradeLabel} ${displayTopic} Wormhole ${difficultyLabel}`
      : `${input.gradeLabel} ${displayTopic} 留덉빱?ㅼ썫? ${difficultyLabel}`;
  }

  const textbookInfo = input.textbook ? `援먭낵?? ${input.textbook.publisher}` : "援먭낵?? ?놁쓬";
  const chapterInfo = input.textbook ? `?⑥썝: ${input.textbook.lesson}怨? : "?⑥썝: ?놁쓬";
  const grammarList =
    input.textbook && input.textbook.grammarList && input.textbook.grammarList.length
      ? input.textbook.grammarList.join(", ")
      : input.topic || "臾몃쾿 醫낇빀";

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
  ??????????- Do not use a/b/c/d.
- Do not create sentence arrangement, rewrite, or subjective questions.
- Separate questions and answers completely.
- Use a balanced mix of real exam-style grammar discrimination types.
- ${isHigh ? "Make the set feel like a top-tier high school / top middle-school 5-point discrimination test." : "Keep the requested level."}

Original request:
${input.userPrompt || ""}
`.trim();
  }

  return `
?ㅼ쓬 議곌굔??留욌뒗 留덉빱?ㅼ썫? ?곸뼱 臾몃쾿 ?ㅼ쟾紐⑥쓽怨좎궗瑜??앹꽦?섏떆??
?쒕ぉ: ${title}
?붿쭊: wormhole
?숇뀈 ?섏?: ${input.level}
?숇뀈 ?쒓린: ${input.gradeLabel}
紐⑤뱶: ${input.mode}
二쇱젣: ${input.topic}
?쒖씠?? ${input.difficulty}
臾명빆 ?? ${input.count}
${textbookInfo}
${chapterInfo}
臾몃쾿 ?ъ씤?? ${grammarList}

諛섎뱶??吏??議곌굔:
- 紐⑤뱺 臾명빆? 5吏?좊떎 媛앷??앹쑝濡??묒꽦??寃?- 紐⑤뱺 臾명빆???좏깮吏??諛섎뱶?????????????뺤떇?쇰줈 ?묒꽦??寃?- a) b) c) d) ?뺤떇 ?ъ슜 湲덉?
- 諛곗뿴?? ?ш뎄?깊삎, ?쒖닠?? ?곸옉??湲덉?
- 臾몄젣? ?뺣떟/?댁꽕? ?꾩쟾??遺꾨━??寃?- ?ㅼ젣 ?댁떊???ㅼ쟾??臾몃쾿 ?먮떒 臾몄젣泥섎읆 留뚮뱾 寃?- ?댁깋??臾몄옣 李얘린, ?щ컮瑜?臾몄옣 媛쒖닔, ?댁깋??臾몄옣 媛쒖닔, 臾몃쾿 援ъ“ 鍮꾧탳, 諛묒쨪 ?대쾿 ?먮떒, ?뚮쭪? ?댄삎 ?좏깮 ?깆쓣 ?곸젅???욎쓣 寃?- ${isHigh ? "?꾩껜 ?명듃媛 怨좊궃??5?먰삎 蹂蹂?臾몄젣泥섎읆 ?먭뺨吏寃?留뚮뱾 寃? : "?붿껌 ?쒖씠?꾩뿉 留욎텧 寃?}

?ъ슜???먮Ц:
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

/* =========================
   Wormhole Output Stabilizer (?섏젙 諛섏쁺 遺遺?
   ========================= */

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSection(text = "", startMarker = "", endMarker = null) {
  const source = String(text || "");
  const start = startMarker ? source.indexOf(startMarker) : 0;
  if (start < 0) return "";

  const from = startMarker ? start + startMarker.length : 0;
  const sliced = source.slice(from);

  if (!endMarker) return cleanupText(sliced);

  const end = sliced.indexOf(endMarker);
  if (end < 0) return cleanupText(sliced);

  return cleanupText(sliced.slice(0, end));
}

function countQuestions(text = "") {
  return String(text || "")
    .split(/\n(?=\d+\.\s)/g)
    .map(s => s.trim())
    .filter(s => /^\d+\.\s/.test(s)).length;
}

function extractQuestionBlocks(text = "") {
  const source = cleanupText(text);
  if (!source) return [];
  return source
    .split(/\n(?=\d+\.\s)/g)
    .map(block => cleanupText(block))
    .filter(block => /^\d+\.\s/.test(block));
}

function renumberBlocks(blocks = [], startNumber = 1) {
  return blocks.map((block, index) => {
    const newNo = startNumber + index;
    return cleanupText(String(block).replace(/^\d+\.\s*/, `${newNo}. `));
  });
}

function extractAnswerBlocks(answerText = "") {
  const source = cleanupText(answerText);
  if (!source) return [];
  return source
    .split(/\n(?=\d+\)\s)/g)
    .map(block => cleanupText(block))
    .filter(block => /^\d+\)\s/.test(block));
}

function renumberAnswerBlocks(blocks = [], startNumber = 1) {
  return blocks.map((block, index) => {
    const newNo = startNumber + index;
    return cleanupText(String(block).replace(/^\d+\)\s*/, `${newNo}) `));
  });
}

function normalizeQuestionLine(line = "") {
  return String(line || "")
    .replace(/^\s*臾몄젣\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\s*(\d+)\)\s*/, "$1. ")
    .replace(/^\s*(\d+)\s*-\s*/, "$1. ")
    .trim();
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
      if (/^\s*[?졻몼?™몿??\s+/.test(line)) {
        choices.push(line.trim());
      } else {
        stem.push(line.trim());
      }
    }

    const normalizedChoices = choices
      .map((choice, idx) => choice.replace(/^\s*[?졻몼?™몿??\s+/, `${["??, "??, "??, "??, "??][idx]} `))
      .slice(0, 5);

    return [...stem, ...normalizedChoices].join("\n");
  });

  return cleanupText(fixed.join("\n\n"));
}

function buildWormholeTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;
  const gradeLabel = input.gradeLabel || "以묐벑";
  const topic = input.topic || "臾몃쾿";
  const difficultyLabel =
    input.difficulty === "extreme" ? "理쒓퀬?쒕룄" :
    input.difficulty === "high" ? "怨좊궃?? :
    input.difficulty === "basic" ? "湲곗큹?쒕룄" : "?쒖??쒕룄";

  return `${gradeLabel} ${topic} -${difficultyLabel} ?ㅼ쟾紐⑥쓽怨좎궗 1??;
}

function buildWormholeInstructions(input) {
  if (input.language === "en") {
    return `Choose the best answer for each question.`;
  }
  return `?ㅼ쓬 媛?臾명빆?먯꽌 媛???뚮쭪? ?듭쓣 怨좊Ⅴ?쒖삤.`;
}

function normalizeWormholeAnswers(answerText = "") {
  const source = cleanupText(answerText);
  if (!source) return "";

  const lines = source.split("\n").map(s => s.trim()).filter(Boolean);
  const normalized = lines.map((line) => {
    let v = line
      .replace(/^臾몄젣\s*(\d+)\s*[:.)-]?\s*/i, "$1) ")
      .replace(/^(\d+)\.\s*/, "$1) ")
      .trim();
    if (/^\d+\)\s*[?졻몼?™몿??/.test(v)) return v;
    if (/^\d+\)\s*\d/.test(v)) {
      return v.replace(/^(\d+\))\s*([1-5])/, (_, a, b) => {
        const map = { "1": "??, "2": "??, "3": "??, "4": "??, "5": "?? };
        return `${a} ${map[b]}`;
      });
    }

    return v;
  });

  return cleanupText(normalized.join("\n"));
}

function formatWormholeResponse(rawText, input) {
  const normalizedRaw = cleanupText(rawText);

  let title = extractSection(normalizedRaw, "[[TITLE]]", "[[INSTRUCTIONS]]");
  let instructions = extractSection(normalizedRaw, "[[INSTRUCTIONS]]", "[[QUESTIONS]]");
  let questions = extractSection(normalizedRaw, "[[QUESTIONS]]", "[[ANSWERS]]");
  let answers = extractSection(normalizedRaw, "[[ANSWERS]]", null);
  if (!questions) {
    const firstQuestionIndex = normalizedRaw.search(/^\s*(?:臾몄젣\s*1|1\.|1\))/m);
    if (firstQuestionIndex >= 0) {
      const beforeQuestions = cleanupText(normalizedRaw.slice(0, firstQuestionIndex));
      const afterQuestions = cleanupText(normalizedRaw.slice(firstQuestionIndex));
      if (!title) {
        const firstLine = beforeQuestions.split("\n").map(s => s.trim()).find(Boolean) || "";
        title = firstLine.replace(/^#+\s*/, "") || buildWormholeTitle(input);
      }

      if (!instructions) {
        const beforeLines = beforeQuestions
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => s !== title);
        instructions = cleanupText(beforeLines.join("\n")) || buildWormholeInstructions(input);
      }

      const answerStart = afterQuestions.search(/\n\s*(?:#{1,3}\s*)?(?뺣떟|?댁꽕|?뺣떟\s*諛?s*?댁꽕|answers?)/i);
      if (answerStart >= 0) {
        questions = cleanupText(afterQuestions.slice(0, answerStart));
        answers = cleanupText(afterQuestions.slice(answerStart));
      } else {
        questions = afterQuestions;
      }
    }
  }

  title = cleanupText(title) || buildWormholeTitle(input);
  instructions = cleanupText(instructions) || buildWormholeInstructions(input);
  questions = ensureFiveChoicesPerQuestion(questions);
  answers = normalizeWormholeAnswers(
    cleanupText(
      String(answers || "")
        .replace(/^(?뺣떟\s*諛?s*?댁꽕|?뺣떟|?댁꽕|answers?)\s*:?/i, "")
        .trim()
    )
  );
  const actualCount = countQuestions(questions);

  const content = cleanupText([title, instructions, questions].filter(Boolean).join("\n\n"));
  const answerSheet = cleanupText(answers);
  const fullText = cleanupText(
    [title, instructions, questions, "?뺣떟 諛??댁꽕", answerSheet]
      .filter(Boolean)
      .join("\n\n")
  );
  return {
    title,
    instructions,
    content,
    answerSheet,
    fullText,
    actualCount,
  };
}

async function mergeWormholeSupplement(formatted, supplement, input) {
  const originalQuestionText = cleanupText(
    String(formatted.content || "")
      .replace(formatted.title || "", "")
      .replace(formatted.instructions || "", "")
  );
  const supplementQuestionText = cleanupText(
    String(supplement.content || "")
      .replace(supplement.title || "", "")
      .replace(supplement.instructions || "", "")
  );
  const originalQuestionBlocks = extractQuestionBlocks(originalQuestionText);
  const supplementQuestionBlocks = extractQuestionBlocks(supplementQuestionText);

  const originalAnswerBlocks = extractAnswerBlocks(formatted.answerSheet || "");
  const supplementAnswerBlocks = extractAnswerBlocks(supplement.answerSheet || "");
  const mergedQuestionBlocks = [
    ...renumberBlocks(originalQuestionBlocks, 1),
    ...renumberBlocks(
      supplementQuestionBlocks,
      originalQuestionBlocks.length + 1
    ),
  ];
  const mergedAnswerBlocks = [
    ...renumberAnswerBlocks(originalAnswerBlocks, 1),
    ...renumberAnswerBlocks(
      supplementAnswerBlocks,
      originalAnswerBlocks.length + 1
    ),
  ];
  const mergedQuestionsText = ensureFiveChoicesPerQuestion(
    mergedQuestionBlocks.join("\n\n")
  );

  const mergedAnswersText = normalizeWormholeAnswers(
    mergedAnswerBlocks.join("\n")
  );
  return {
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
        "?뺣떟 諛??댁꽕",
        mergedAnswersText,
      ]
        .filter(Boolean)
        .join("\n\n")
    ),
    actualCount: countQuestions(mergedQuestionsText),
  };
}


/* =========================
   WORMHOLE_DB_FIRST_PILOT
   Pilot scope: middle2 DB-first chapters.
   Supported: after_before, although.
   Keeps GPT generation as fallback for every unsupported chapter.
   ========================= */

function normalizeWormholeDbFirstText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[竊뚣?/g, ",")
    .replace(/\bas\s*[~?쒙퐵]\s*as\b/g, "as as")
    .replace(/\bas\s*[-/]\s*as\b/g, "as as")
    .replace(/[~?쒙퐵]+/g, " ")
    .replace(/[\\/_-]+/g, " ")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveWormholeDbFirstScope(input = {}) {
  const requested = [
    input.topic,
    input.userPrompt,
    input.worksheetTitle,
    input.requestedChapter,
    input.rawBody?.requestedChapter,
    input.rawBody?.chapter,
    input.rawBody?.chapterKey,
    input.rawBody?.canonical,
    input.rawBody?.topic,
    input.rawBody?.worksheetTitle,
    input.rawBody?.selectedGrade
  ].filter(Boolean).join(" | ");

  const normalized = normalizeWormholeDbFirstText(requested);
  const selectedGrade = normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto");
  const inferredGrade = selectedGrade !== "auto"
    ? selectedGrade
    : (/\bmiddle\s*2\b/.test(normalized) || /\uC911\s*2/.test(requested) || /중\s*2/.test(requested) || /以?s*2/.test(normalized) || /以묓븰援?s*2/.test(normalized)
      ? "middle2"
      : selectedGrade);

  const rawRequested = String(requested || "").toLowerCase();
  const mentionsAfterBefore =
    /\bafter\s+before\b/.test(normalized) ||
    /\bbefore\s+after\b/.test(normalized) ||
    /\bafter\s*,?\s*before\b/.test(normalized) ||
    /\bbefore\s*,?\s*after\b/.test(normalized) ||
    /\bafter\b/.test(normalized) && /\bbefore\b/.test(normalized) ||
    /after_before/.test(rawRequested);

  const mentionsAlthough =
    /\balthough\b/.test(normalized) ||
    /\bthough\b/.test(normalized) ||
    /\beven\s+though\b/.test(normalized) ||
    /\bdespite\b/.test(normalized) ||
    /\bin\s+spite\s+of\b/.test(normalized) ||
    /although/.test(rawRequested) ||
    /\uC591\uBCF4\uC758\s*(\uC811\uC18D\uC0AC|\uC804\uCE58\uC0AC)/.test(requested) ||
    /\uC811\uC18D\uC0AC\s*(although|though|even\s+though)/i.test(requested);

  const mentionsAsAs =
    /\bas\s+as\b/.test(normalized) ||
    /\bas_as\b/.test(rawRequested) ||
    /\bmiddle\s*2\s+as\s+as\b/.test(normalized) ||
    /\uC911\s*2[^|]*as\s*[~?쒙퐵\-/]?\s*as[^|]*(\uC6D0\uAE09|\uC6D0\uAE09\uBE44\uAD50)?/i.test(requested) ||
    /\uC911\s*2[^|]*\uC6D0\uAE09\uBE44\uAD50/i.test(requested);

  const mentionsAsConjunction =
    !mentionsAsAs &&
    (
      /\bmiddle\s*2\s+as\s+conjunction\b/.test(normalized) ||
      /\bas\s+conjunction\b/.test(normalized) ||
      /\bconjunction\s+as\b/.test(normalized) ||
      /\b(as\s+meaning\s+when|as\s+meaning\s+because|as\s+simultaneous\s+action)\b/.test(normalized) ||
      /\uC911\s*2[^|]*(\uC811\uC18D\uC0AC\s*as|as\s*\uC811\uC18D\uC0AC|as\s*\uC2DC\uAC04\s*\uC811\uC18D\uC0AC|as\s*\uC774\uC720\s*\uC811\uC18D\uC0AC)/i.test(requested)
    );

  const mentionsToInfinitiveNoun =
    /\bmiddle\s*2\s+to\s+infinitive\s+noun\b/.test(normalized) ||
    /\bto[-\s]*infinitive\s+noun\b/.test(normalized) ||
    /\bnoun\s+use\s+of\s+to[-\s]*infinitive\b/.test(normalized) ||
    /\uC911\s*2[^|]*(to\s*\uBD80\uC815\uC0AC\s*\uBA85\uC0AC\uC801|to\uBD80\uC815\uC0AC\s*\uBA85\uC0AC\uC801|\uBA85\uC0AC\uC801\s*\uC6A9\uBC95|\uC8FC\uC5B4\s*\uBAA9\uC801\uC5B4\s*\uBCF4\uC5B4)/i.test(requested);

  const mentionsToInfinitiveAdjective =
    /\bmiddle\s*2\s+to\s+infinitive\s+adjective\b/.test(normalized) ||
    /\bto[-\s]*infinitive\s+adjective\b/.test(normalized) ||
    /\badjective\s+use\s+of\s+to[-\s]*infinitive\b/.test(normalized) ||
    /\uC911\s*2[^|]*(to\s*\uBD80\uC815\uC0AC\s*\uD615\uC6A9\uC0AC\uC801|to\uBD80\uC815\uC0AC\s*\uD615\uC6A9\uC0AC\uC801|\uD615\uC6A9\uC0AC\uC801\s*\uC6A9\uBC95|\uBA85\uC0AC\s*to\s*\uBD80\uC815\uC0AC)/i.test(requested);

  const mentionsToInfinitiveAdverbial =
    /\bmiddle\s*2\s+to\s+infinitive\s+adverbial\b/.test(normalized) ||
    /\bto[-\s]*infinitive\s+adverbial\b/.test(normalized) ||
    /\badverbial\s+use\s+of\s+to[-\s]*infinitive\b/.test(normalized) ||
    /\uC911\s*2[^|]*(to\s*\uBD80\uC815\uC0AC\s*\uBD80\uC0AC\uC801|to\uBD80\uC815\uC0AC\s*\uBD80\uC0AC\uC801|\uBD80\uC0AC\uC801\s*\uC6A9\uBC95|\uBAA9\uC801\uC758\s*to\uBD80\uC815\uC0AC|\uAC10\uC815\uC758\s*\uC6D0\uC778\s*to\uBD80\uC815\uC0AC|\uACB0\uACFC\uC758\s*to\uBD80\uC815\uC0AC)/i.test(requested);

  const mentionsTooToEnoughTo =
    /\bmiddle\s*2\s+(too\s*to|too\s*~\s*to|enough\s+to|too\s+to\s+enough\s+to|too_to_enough_to)\b/.test(normalized) ||
    /\b(too\s*~?\s*to|enough\s+to|too_to_enough_to)\b/.test(normalized) ||
    /\uC911\s*2[^|]*(too\s*[~\-]?\s*to|enough\s+to|too\s*~\s*to|too\s*to\s*enough\s*to|too\s*to\s*\uAD6C\uBB38|enough\s*to\s*\uAD6C\uBB38)/i.test(requested);

  const mentionsItTo =
    !mentionsTooToEnoughTo &&
    (
      /\bmiddle\s*2\s+it\s+to\b/.test(normalized) ||
      /\bit\s*~?\s*to\s+infinitive\b/.test(normalized) ||
      /\bit_to\b/.test(rawRequested) ||
      /\uC911\s*2[^|]*(it\s*[~\-]?\s*to|it\s*to\s*\uAD6C\uBB38|it\s*~\s*to\s*\uBD80\uC815\uC0AC|\uAC00\uC8FC\uC5B4\s*\uC9C4\uC8FC\uC5B4|\uAC00\uC8FC\uC5B4\s*to\uBD80\uC815\uC0AC|to\uBD80\uC815\uC0AC\s*\uAC00\uC8FC\uC5B4)/i.test(requested)
    );

  const mentionsCausativeVerbs =
    /\bmiddle\s*2\s+(causative\s+verbs|make\s+have\s+let|make\s+have\s+let\s+help|help\s+causative)\b/.test(normalized) ||
    /\b(causative\s+verbs|make\s+have\s+let|make\s+have\s+let\s+help|help\s+object\s+(base\s+verb|to\s+infinitive))\b/.test(normalized) ||
    /\uC911\s*2[^|]*(\uC0AC\uC5ED\s*\uB3D9\uC0AC|\uC0AC\uC5ED\uB3D9\uC0AC|make\s*have\s*let|make\s*let\s*have|make\s*have\s*let\s*help|help\s*\uC0AC\uC5ED\uB3D9\uC0AC|help\s*\uBAA9\uC801\uC5B4\s*(\uB3D9\uC0AC\uC6D0\uD615|to\uBD80\uC815\uC0AC))/i.test(requested);

  const mentionsComparativeEmphasis =
    !/\uC6D0\uAE09\uBE44\uAD50|\uCD5C\uC0C1\uAE09|the\s*\uBE44\uAD50\uAE09\s*the\s*\uBE44\uAD50\uAE09|\bthe\s+comparative\b|\b(as\s+as|as_as)\b/i.test(requested + " " + normalized) &&
    (
      /\bmiddle\s*2\s+comparative\s+emphasis\b/.test(normalized) ||
      /\b(comparative\s+emphasis|much\s+comparative|even\s+comparative|far\s+comparative|a\s+lot\s+comparative|still\s+comparative)\b/.test(normalized) ||
      /\uC911\s*2[^|]*(\uBE44\uAD50\uAE09\s*\uAC15\uC870|\uBE44\uAD50\uAE09\s*\uAC15\uC870\uC5B4|\uBE44\uAD50\uAE09\s*\uAC15\uC870\s*\uBD80\uC0AC|much\s*\uBE44\uAD50\uAE09|even\s*\uBE44\uAD50\uAE09|far\s*\uBE44\uAD50\uAE09|a\s*lot\s*\uBE44\uAD50\uAE09|still\s*\uBE44\uAD50\uAE09)/i.test(requested)
    );

  const mentionsBecause =
    /\bbecause\b/.test(normalized) ||
    /\bbecause\s+of\b/.test(normalized) ||
    /\bbecause_of\b/.test(rawRequested) ||
    /\bmiddle\s*2\s+because\b/.test(normalized) ||
    /\uC911\s*2[^|]*(because|\uC811\uC18D\uC0AC\s*because|\uC804\uCE58\uC0AC\uAD6C\s*because\s+of|\uC774\uC720|\uC6D0\uC778)/i.test(requested);

  const mentionsWhileWhen =
    (/\bwhen\b/.test(normalized) && /\bwhile\b/.test(normalized)) ||
    /\bmiddle\s*2\s+(when\s+while|while\s+when)\b/.test(normalized) ||
    /\uC911\s*2[^|]*(when\s*,?\s*while|while\s*,?\s*when|\uC811\uC18D\uC0AC\s*(when|while)|\uC2DC\uAC04\s*\uC811\uC18D\uC0AC)/i.test(requested);

  const mentionsTheComparative =
    /\bthe\s+(more|less|[a-z]+er)\b[^|,.;:!?]*[, ]+\s*the\s+(more|less|[a-z]+er)\b/i.test(normalized) ||
    /\bthe\s+comparative\s+the\s+comparative\b/i.test(normalized) ||
    /\bthe\s+more\s+the\s+more\b/i.test(normalized) ||
    /\uC911\s*2[^|]*(the\s*\uBE44\uAD50\uAE09\s*the\s*\uBE44\uAD50\uAE09|\uBE44\uAD50\uAE09\s*\uBCD1\uB82C\uAD6C\uBB38|the\s+comparative\s+the\s+comparative|the\s+more\s+the\s+more)/i.test(requested);

  const mentionsSuperlative =
    !/\bthe\s+comparative\b|\uBE44\uB840\s*\uBE44\uAD50|\uC6D0\uAE09\uBE44\uAD50|\b(as\s+as|as_as)\b/i.test(requested + " " + normalized) &&
    (
      /\bmiddle\s*2\s+superlative\b/.test(normalized) ||
      /\b(the\s+most|the\s+least)\b/.test(normalized) ||
      /\uC911\s*2[^|]*(\uCD5C\uC0C1\uAE09|superlative|the\s+most|the\s+least)/i.test(requested)
    );

  const mentionsComparative =
    !/\uC6D0\uAE09\uBE44\uAD50|\uCD5C\uC0C1\uAE09|\b(as\s+as|as_as)\b|\bthe\s+comparative\b/i.test(requested + " " + normalized) &&
    (
      /\bmiddle\s*2\s+comparative\b/.test(normalized) ||
      /\bcomparative\s+than\b/.test(normalized) ||
      /\bmore\s+than\s+comparative\b/.test(normalized) ||
      /\uC911\s*2[^|]*(\uBE44\uAD50\uAE09|comparative|than\s*\uBE44\uAD50\uAE09|more\s+than\s*\uBE44\uAD50\uAE09)/i.test(requested)
    );

  let canonical = null;
  if (mentionsAfterBefore) canonical = "after_before";
  else if (mentionsWhileWhen) canonical = "while_when";
  else if (mentionsAlthough) canonical = "although";
  else if (mentionsAsAs) canonical = "as_as";
  else if (mentionsAsConjunction) canonical = "as_conjunction";
  else if (mentionsTooToEnoughTo) canonical = "too_to_enough_to";
  else if (mentionsItTo) canonical = "it_to";
  else if (mentionsToInfinitiveNoun) canonical = "to_infinitive_noun";
  else if (mentionsToInfinitiveAdjective) canonical = "to_infinitive_adjective";
  else if (mentionsToInfinitiveAdverbial) canonical = "to_infinitive_adverbial";
  else if (mentionsCausativeVerbs) canonical = "causative_verbs";
  else if (mentionsTheComparative) canonical = "the_comparative";
  else if (mentionsSuperlative) canonical = "superlative";
  else if (mentionsComparativeEmphasis) canonical = "comparative_emphasis";
  else if (mentionsComparative) canonical = "comparative";
  else if (mentionsBecause) canonical = "because";
  return { requested, normalized, canonical, selectedGrade: inferredGrade };
}

async function resolveWormholeDbFile(input = {}) {
  const scope = resolveWormholeDbFirstScope(input);
  const path = require("path");
  const fs = require("fs");
  const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const dbFileByCanonical = {
    after_before: "middle2_after_before.json",
    although: "middle2_although.json",
    as_as: "middle2_as_as.json",
    as_conjunction: "middle2_as_conjunction.json",
    because: "middle2_because.json",
    causative_verbs: "middle2_causative_verbs.json",
    comparative_emphasis: "middle2_comparative_emphasis.json",
    while_when: "middle2_while_when.json",
    comparative: "middle2_comparative.json",
    superlative: "middle2_superlative.json",
    the_comparative: "middle2_the_comparative_the_comparative.json",
    to_infinitive_noun: "middle2_to_infinitive_noun.json",
    to_infinitive_adjective: "middle2_to_infinitive_adjective.json",
    to_infinitive_adverbial: "middle2_to_infinitive_adverbial.json",
    too_to_enough_to: "middle2_too_to_enough_to.json",
    it_to: "middle2_it_to.json"
  };
  const fileName = dbFileByCanonical[scope.canonical] || null;
  const candidatePaths = fileName && scope.selectedGrade === "middle2"
    ? [
        path.join(process.cwd(), "data", "middle2", fileName),
        path.join(currentDir, "..", "data", "middle2", fileName),
        path.join(process.cwd(), "data", "sentence_bank", "middle2", fileName),
        path.join(currentDir, "..", "data", "sentence_bank", "middle2", fileName)
      ]
    : [];

  const testedPaths = candidatePaths.map((candidate) => ({
    path: candidate,
    exists: fs.existsSync(candidate)
  }));
  const found = testedPaths.find((entry) => entry.exists);
  const resolvedPath = found ? found.path : null;
  const selectedDbFile = resolvedPath || candidatePaths[0] || null;

  console.info("[WORMHOLE_DB_FIRST_MATCH]", {
    requested: scope.requested,
    normalized: scope.normalized,
    canonical: scope.canonical,
    selectedGrade: scope.selectedGrade,
    selectedDbFile
  });
  console.info("[DB_PATH_DEBUG]", {
    cwd: process.cwd(),
    __dirname: currentDir,
    testedPaths
  });
  console.info("[WORMHOLE_DB_FILE]", {
    canonical: scope.canonical,
    selectedGrade: scope.selectedGrade,
    selectedDbFile,
    resolvedPath,
    candidatePaths,
    cwd: process.cwd(),
    __dirname: currentDir
  });

  return resolvedPath;
}

async function loadGrammarDb(filePath) {
  if (!filePath) return null;
  const loadStart = Date.now();
  const fs = require("fs");
  console.info("[WORMHOLE_DB_FILE_READ]", { filePath, cwd: process.cwd() });
  const raw = fs.readFileSync(filePath, "utf8");
  const items = JSON.parse(raw);
  console.info("[DB_LOAD_TIME]", { ms: Date.now() - loadStart, filePath, rawBytes: raw.length, itemCount: Array.isArray(items) ? items.length : 0 });
  if (!Array.isArray(items)) throw new Error("Wormhole DB is not an array.");

  const validItems = items.filter((item) =>
    item &&
    item.id &&
    typeof item.english === "string" &&
    item.english.trim() &&
    item.distractorSeeds &&
    Array.isArray(item.distractorSeeds.wormholeVariants) &&
    item.distractorSeeds.wormholeVariants.length >= 4
  );

  if (!validItems.length) throw new Error("Wormhole DB has no usable items.");
  return validItems;
}

function dbPilotHash(text = "") {
  let hash = 2166136261;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dbPilotRandom(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function stableShuffle(list = [], seedText = "") {
  const arr = [...list];
  const rand = dbPilotRandom(dbPilotHash(seedText));
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getDbItemTailKey(item = {}) {
  const text = String(item.english || "").toLowerCase();
  const knownTails = [
    "after the reactions became colder",
    "once the screenshots spread privately",
    "after the awkward silence grew longer",
    "while nobody mentioned the real issue",
    "after people misunderstood the situation",
    "before the teacher clarified the rumor",
    "while the tension slowly increased",
    "after the comments became personal",
    "when the atmosphere suddenly changed",
    "after the conversation lost its warmth",
    "once the private replies stopped",
    "after the friendly tone disappeared",
    "while everyone avoided the real question",
    "after the apology sounded too late",
    "when the private chat became uncomfortable",
    "after the classroom mood changed",
    "while the real reason stayed hidden",
    "after the screenshot changed the meaning",
    "when the joke stopped feeling harmless",
    "after the silence made the answer obvious",
    "while the group pretended nothing happened",
    "after the online reaction felt colder",
    "when the explanation arrived too late",
    "after the praise started sounding forced",
    "while the friendship felt distant"
  ];
  const found = knownTails.find((tail) => text.includes(tail));
  if (found) return found;
  const match = text.match(/\b(after|before|while|when|once)\b[^.?!]*[.?!]?$/i);
  return match ? match[0].replace(/[.?!]$/, "").trim() : "no_tail";
}

function selectAlthoughDbItems(items = [], input = {}, seedText = "") {
  const count = clamp(Number(input.count) || 10, 1, 30);
  const shuffled = stableShuffle(items, seedText)
    .sort((a, b) => Number((b.tags || []).includes("premium_priority")) - Number((a.tags || []).includes("premium_priority")));
  const selected = [];
  const used = new Set();
  const bucketCount = new Map();
  const worldCount = new Map();
  const emotionCount = new Map();
  const tailCount = new Map();
  const maxBucket = Math.max(2, Math.ceil(count / 4));
  const maxWorld = Math.max(3, Math.ceil(count / 3));
  const maxEmotion = Math.max(2, Math.ceil(count / 4));

  function keyOf(item, key, fallback = "unknown") {
    return String(item.chapterMeta?.[key] || fallback);
  }
  function canTake(item, relaxed = false) {
    if (!item || used.has(item.id)) return false;
    if (relaxed) return true;
    const bucket = keyOf(item, "semanticBucket");
    const world = keyOf(item, "worldType");
    const emotion = keyOf(item, "emotionAxis");
    const tail = getDbItemTailKey(item);
    return (bucketCount.get(bucket) || 0) < maxBucket &&
      (worldCount.get(world) || 0) < maxWorld &&
      (emotionCount.get(emotion) || 0) < maxEmotion &&
      (tail === "no_tail" || (tailCount.get(tail) || 0) < 1);
  }
  function take(item) {
    used.add(item.id);
    selected.push(item);
    const bucket = keyOf(item, "semanticBucket");
    const world = keyOf(item, "worldType");
    const emotion = keyOf(item, "emotionAxis");
    const tail = getDbItemTailKey(item);
    bucketCount.set(bucket, (bucketCount.get(bucket) || 0) + 1);
    worldCount.set(world, (worldCount.get(world) || 0) + 1);
    emotionCount.set(emotion, (emotionCount.get(emotion) || 0) + 1);
    tailCount.set(tail, (tailCount.get(tail) || 0) + 1);
  }

  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (canTake(item, false)) take(item);
  }
  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (canTake(item, true)) take(item);
  }
  console.info("[ALTHOUGH_SELECTION_QUOTA]", {
    requested: count,
    selected: selected.length,
    buckets: Object.fromEntries(bucketCount),
    worlds: Object.fromEntries(worldCount),
    emotions: Object.fromEntries(emotionCount),
    repeatedTails: [...tailCount.entries()].filter(([, value]) => value > 1)
  });
  return selected.slice(0, count);
}

function selectDbItems(items = [], input = {}) {
  const count = clamp(Number(input.count) || 10, 1, 30);
  if (items.length < count) return [];

  const seedText = [
    input.selectedGrade,
    input.topic,
    input.userPrompt,
    input.worksheetTitle,
    input.requestedChapter,
    input.problemType,
    count
  ].filter(Boolean).join("|");

  const scope = resolveWormholeDbFirstScope(input);
  if (scope.canonical === "although") {
    return selectAlthoughDbItems(items, input, seedText);
  }

  const shuffled = stableShuffle(items, seedText);
  const afterItems = shuffled.filter((item) => (item.tags || []).includes("after"));
  const beforeItems = shuffled.filter((item) => (item.tags || []).includes("before"));
  const neutralItems = shuffled.filter((item) => !(item.tags || []).includes("after") && !(item.tags || []).includes("before"));

  const selected = [];
  const used = new Set();
  let turn = dbPilotHash(seedText) % 2;

  function takeFrom(bucket) {
    while (bucket.length) {
      const item = bucket.shift();
      if (!used.has(item.id)) {
        used.add(item.id);
        selected.push(item);
        return true;
      }
    }
    return false;
  }

  while (selected.length < count && (afterItems.length || beforeItems.length || neutralItems.length)) {
    const preferred = turn % 2 === 0 ? afterItems : beforeItems;
    const alternate = turn % 2 === 0 ? beforeItems : afterItems;
    if (!takeFrom(preferred) && !takeFrom(alternate)) takeFrom(neutralItems);
    turn += 1;
  }

  return selected.slice(0, count);
}

function cleanDbOption(text = "") {
  return normalizeDbSentenceCase(String(text || "").replace(/\s+/g, " ").trim());
}

function normalizeDbSentenceCase(text = "") {
  const source = String(text || "").trim();
  if (!source) return source;
  return source.replace(/^(\s*)([a-z])/, (_, lead, ch) => lead + ch.toUpperCase());
}

function isLowQualityDbDistractor(text = "") {
  const t = cleanDbOption(text).toLowerCase();
  return /\bafter\s+before\b|\bbefore\s+after\b|\bafter\s+to\b|\bbefore\s+to\b/.test(t);
}

function buildQuestionFromDbItem(item, index, input = {}) {
  const correct = cleanDbOption(item.english);
  const rawDistractors = [
    ...(item.distractorSeeds?.wormholeVariants || []),
    item.distractorSeeds?.auxError
  ].map(cleanDbOption).filter(Boolean);

  const unique = [];
  for (const value of rawDistractors) {
    if (value && value !== correct && !unique.includes(value)) unique.push(value);
  }

  const highQuality = unique.filter((value) => !isLowQualityDbDistractor(value));
  const fallback = unique.filter((value) => isLowQualityDbDistractor(value));
  const wrong = [...highQuality, ...fallback].slice(0, 4);
  if (wrong.length < 4) return null;

  console.info("[WORMHOLE_DB_VARIANT_USED]", {
    seedId: item.seedId || item.id,
    variantCount: Array.isArray(item.distractorSeeds?.wormholeVariants) ? item.distractorSeeds.wormholeVariants.length : 0,
    assemblyMode: "db_variant_assembly"
  });

  const optionObjects = [
    { text: correct, correct: true },
    ...wrong.map((text) => ({ text, correct: false }))
  ];
  const shuffled = stableShuffle(optionObjects, `${item.id}|${input.topic || ""}|${input.userPrompt || ""}|${input.worksheetTitle || ""}|${input.requestedChapter || ""}|${input.count || ""}|${index}`);
  const labels = ["??, "??, "??, "??, "??];
  const answerIndex = shuffled.findIndex((option) => option.correct);
  const answerLabel = labels[answerIndex] || "??;
  const questionStem = input.language === "en"
    ? "Choose the grammatically correct sentence."
    : "?ㅼ쓬 以??대쾿??媛???먯뿰?ㅻ윭??臾몄옣??怨좊Ⅴ?쒖삤.";

  return {
    id: item.id,
    questionText: [
      `${index + 1}. ${questionStem}`,
      ...shuffled.map((option, optionIndex) => `${labels[optionIndex]} ${option.text}`)
    ].join("\n"),
    answerText: `${index + 1}) ${answerLabel} - ${correct}`
  };
}

function formatDbWormholeResponse(questions = [], input = {}) {
  const title = buildWormholeTitle(input);
  const instructions = buildWormholeInstructions(input);
  const questionsText = cleanupText(questions.map((question) => question.questionText).join("\n\n"));
  const answerSheet = cleanupText(questions.map((question) => question.answerText).join("\n"));
  const content = cleanupText([title, instructions, questionsText].filter(Boolean).join("\n\n"));
  const fullText = cleanupText([title, instructions, questionsText, "?뺣떟 諛??댁꽕", answerSheet].filter(Boolean).join("\n\n"));
  return {
    title,
    instructions,
    content,
    answerSheet,
    fullText,
    actualCount: questions.length,
    source: "db-first",
    dbFirst: true
  };
}

async function tryBuildWormholeFromDb(input = {}) {
  const totalStart = Date.now();
  try {
    const filePath = await resolveWormholeDbFile(input);
    if (!filePath) return { success: false, reason: "db_file_not_found_or_unsupported_scope" };

    const items = await loadGrammarDb(filePath);
    const selected = selectDbItems(items, input);
    if (selected.length < input.count) {
      return { success: false, reason: "not_enough_db_items" };
    }

    const assemblyStart = Date.now();
    const questions = selected
      .map((item, index) => buildQuestionFromDbItem(item, index, input))
      .filter(Boolean);
    console.info("[ASSEMBLY_TIME]", { ms: Date.now() - assemblyStart, selected: selected.length, questions: questions.length });

    if (questions.length < input.count) {
      return { success: false, reason: "not_enough_db_questions" };
    }

    console.info("[TOTAL_EXECUTION_TIME]", { phase: "db_first_success", ms: Date.now() - totalStart });
    return {
      success: true,
      formatted: formatDbWormholeResponse(questions.slice(0, input.count), input)
    };
  } catch (error) {
    console.warn("[WORMHOLE_DB_FIRST_PILOT_FALLBACK]", error?.message || error);
    return { success: false, reason: error?.message || "db_first_failed" };
  }
}


async function generateWormholeSupplement(input, missingCount, existingQuestionsText = "") {
  const supplementSystemPrompt = buildGrammarSystemPrompt({
    ...input,
    count: missingCount,
  });
  const supplementUserPrompt = `
湲곗〈 ?쒗? 臾명빆???쇰? 遺議깊빀?덈떎.
?대? ?앹꽦??臾명빆怨?寃뱀튂吏 ?딅룄濡? ?꾨옒 湲곗〈 臾명빆怨??ㅻⅨ ?좉퇋 臾명빆留??뺥솗??${missingCount}臾명빆 異붽? ?앹꽦?섏꽭??
[湲곗〈 臾명빆 ?쇰?]
${existingQuestionsText}

[以묒슂]
- 諛섎뱶??${missingCount}臾명빆留?異붽?
- 踰덊샇??1踰덈????ㅼ떆 ?⑤룄 ??(?쒕쾭?먯꽌 ?щ쾲??遺?ы븿)
- 湲곗〈 臾명빆怨??좏삎/蹂닿린/?뺣떟??寃뱀튂吏 ?딄쾶 ?묒꽦
- ?쒕룄? 二쇱젣??湲곗〈 ?명듃? ?숈씪?섍쾶 ?좎?
`.trim();
  const raw = await callOpenAI(supplementSystemPrompt, supplementUserPrompt);
  return formatWormholeResponse(raw, { ...input, count: missingCount });
}

// --- Memberstack 釉붾줉 ---

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
  if (!headers) throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null;
  } catch { data = text; }
  if (!response.ok) throw new Error(`Memberstack request failed: ${response.status}`);
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
  return sanitizeString(req?.body?.memberId || req?.headers?.["x-member-id"] || req?.headers?.["X-Member-Id"] || "");
}

async function verifyMemberToken(token) {
  if (!token) return null;
  const payload = { token };
  if (MEMBERSTACK_APP_ID) payload.audience = MEMBERSTACK_APP_ID;
  const data = await memberstackRequest("/verify-token", { method: "POST", body: JSON.stringify(payload) });
  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, { method: "GET" });
  return data?.data || null;
}

function readMpFromMember(member) {
  if (!member) return null;
  const candidates = [
    member?.customFields?.[MEMBERSTACK_MP_FIELD],
    member?.metaData?.[MEMBERSTACK_MP_FIELD],
    member?.customFields?.mp,
    member?.metaData?.mp
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return sanitizeMp(parsed, 0);
  }
  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) throw new Error("Missing member id");
  const safeNextMp = sanitizeMp(nextMp, 0);
  const body = {
    customFields: { ...member?.customFields, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp },
    metaData: { ...member?.metaData, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp }
  };
  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, { method: "PATCH", body: JSON.stringify(body) });
  return data?.data || null;
}

async function resolveMemberForMp(req) {
  if (!MEMBERSTACK_SECRET_KEY) return { enabled: false, reason: "missing_secret_key", member: null };
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
    return { enabled: false, reason: "member_lookup_failed", member: null };
  }
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  const memberContext = await resolveMemberForMp(req);
  if (!memberContext.enabled || !memberContext.member) {
    return { enabled: false, reason: memberContext.reason, requiredMp, member: null, currentMp: null, trialGranted: false, deducted: false };
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
  return { enabled: true, reason: memberContext.reason, requiredMp, member, currentMp, remainingMp: currentMp, trialGranted, deducted: false };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) return { ...mpState, deducted: false };
  const nextMp = Math.max(0, sanitizeMp(mpState.currentMp, 0) - sanitizeMp(mpState.requiredMp, 0));
  const updatedMember = await updateMemberMp(mpState.member, nextMp);
  return { ...mpState, member: updatedMember || mpState.member, currentMp: nextMp, remainingMp: nextMp, deducted: true };
}

// --- Main Handler ---

export default async function handler(req, res) {
  addCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST only" });
  try {
    const input = normalizeInput(req.body || {});
    console.info("[WORMHOLE_NAMESPACE_LOCK]", {
      selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedBucket: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedChapter: input.topic || "",
    });
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, message: "Prompt or topic required" });
    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP媛 遺議깊빀?덈떎.", requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp });
    }

    const handlerStart = Date.now();
    const dbResult = await tryBuildWormholeFromDb(input);
    let formatted;
    if (dbResult?.success) {
      formatted = dbResult.formatted;
      console.info("[WORMHOLE_DB_FIRST_PILOT_HIT]", {
        selectedGrade: input.selectedGrade,
        requestedChapter: input.requestedChapter,
        topic: input.topic,
        actualCount: formatted.actualCount,
        source: formatted.source || "db-first"
      });
      console.info("[GPT_FALLBACK_SKIPPED]", { reason: "db_first_success", actualCount: formatted.actualCount });
      console.info("[TOTAL_EXECUTION_TIME]", { phase: "handler_db_first_return", ms: Date.now() - handlerStart });
      const finalMpState = await deductMpAfterSuccess(mpState);
      return json(res, 200, {
        success: true,
        ...formatted,
        textbook: input.textbook,
        mp: {
          requiredMp: mpState.requiredMp,
          currentMp: mpState.currentMp,
          remainingMp: finalMpState?.remainingMp ?? null,
          deducted: Boolean(finalMpState?.deducted),
          trialGranted: Boolean(mpState.trialGranted),
        }
      });
    } else {
      console.info("[WORMHOLE_DB_FIRST_PILOT_FALLBACK]", dbResult?.reason || "no_db_result");
      const systemPrompt = buildGrammarSystemPrompt(input);
      const userPrompt = buildGrammarUserPrompt(input);
      const raw = await callOpenAI(systemPrompt, userPrompt);
      formatted = formatWormholeResponse(raw, input);
    }

    // --- ?몃뱾????蹂댁젙 援ш컙 (?섏젙 諛섏쁺 遺遺? ---
    if (formatted.actualCount < input.count) {
      console.warn(`WORMHOLE QUESTION SHORTAGE: expected ${input.count}, got ${formatted.actualCount}`);
      const missingCount = input.count - formatted.actualCount;
      if (missingCount > 0) {
        const supplement = await generateWormholeSupplement(input, missingCount, formatted.content);
        formatted = await mergeWormholeSupplement(formatted, supplement, input);
      }
    }

    if (formatted.actualCount > input.count) {
      const trimmedQuestionBlocks = extractQuestionBlocks(
        cleanupText(
          String(formatted.content || "")
            .replace(formatted.title || "", "")
            .replace(formatted.instructions || "", "")
        )
      ).slice(0, input.count);
      const trimmedAnswerBlocks = extractAnswerBlocks(formatted.answerSheet || "").slice(0, input.count);

      const trimmedQuestionsText = ensureFiveChoicesPerQuestion(
        renumberBlocks(trimmedQuestionBlocks, 1).join("\n\n")
      );
      const trimmedAnswersText = normalizeWormholeAnswers(
        renumberAnswerBlocks(trimmedAnswerBlocks, 1).join("\n")
      );
      formatted = {
        ...formatted,
        content: cleanupText(
          [formatted.title, formatted.instructions, trimmedQuestionsText]
            .filter(Boolean)
            .join("\n\n")
        ),
        answerSheet: cleanupText(trimmedAnswersText),
        fullText: cleanupText(
          [
            formatted.title,
            formatted.instructions,
            trimmedQuestionsText,
            "?뺣떟 諛??댁꽕",
            trimmedAnswersText,
          ]
            .filter(Boolean)
            .join("\n\n")
        ),
        actualCount: countQuestions(trimmedQuestionsText),
      };
    }

    if (formatted.actualCount !== input.count) {
      console.warn(`WORMHOLE FINAL COUNT MISMATCH: expected ${input.count}, got ${formatted.actualCount}`);
    }

    if (formatted.actualCount === 0) {
      return json(res, 500, { success: false, message: `Question parsing failed: expected ${input.count}, got 0` });
    }

    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      ...formatted,
      textbook: input.textbook,
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
