// 치웨미 인베스트먼트 NRFA 리그 원 - 26/27 시즌 데이터베이스

// ===== 시즌/라운드 날짜 정보 =====
// SEASON_START: 시즌 개막일 (주차 계산 기준일)
// ROUND_DATE  : 가장 최근에 끝난 라운드의 날짜 — 새 라운드가 끝날 때마다 이 값만 갱신하면 됩니다.
const SEASON_START = '2026-07-12';
const ROUND_DATE = '2026-08-12';

// ===== 치주물루 라운드별 상세 (포메이션/득점/교체/최근 상대전적) =====
// starters: 포지션별 선발. goals: 득점 시간(분) 배열. outMin: 교체 아웃 시간('HT'=하프타임)
// subsIn: 교체 투입 선수. subsUnused: 미출전 명단(등번호)
const matchLineups = {
  round1: {
    formation: "4-2-3-1",
    opponentKo: "치하메 올스타즈 FC",
    result: "3 : 1 승",
    starters: [
      { pos: "ST", number: 22, nameKo: "TEEKAY" },
      { pos: "LW", number: 49, nameKo: "쿰부카니 바냐", outMin: "후반 11'" },
      { pos: "CAM", number: 7, nameKo: "디킨스", goals: ["8'", "78'"], outMin: "후반" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 77, nameKo: "군도", captain: true },
      { pos: "RCM", number: 98, nameKo: "스티브", outMin: "후반 10'" },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트", outMin: "후반 15'" },
      { pos: "RB", number: 2, nameKo: "로날드", outMin: "후반" },
      { pos: "GK", number: 88, nameKo: "티나시" }
    ],
    subsIn: [
      { number: 11, nameKo: "해리", inMin: "후반 11'", goals: ["76'"] },
      { number: 80, nameKo: "스쿠카", inMin: "후반" },
      { number: 10, nameKo: "찰스", inMin: "후반 10'" },
      { number: 15, nameKo: "만토", inMin: "후반 15'" },
      { number: 3, nameKo: "음롱골라", inMin: "후반" }
    ],
    subsUnused: [9, 20, 66, 90],
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 23주차", score: "치하메 2 : 1 치주물루", result: "치하메 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 8주차", score: "치주물루 2 : 0 치하메", result: "치주물루 승" }
    ],
    historySummary: "최근 2경기 전적 2전 1승 0무 1패로 백중세"
  },
  round2: {
    formation: "4-2-3-1",
    opponentKo: "마푸 스타즈 FC",
    result: "0 : 1 패",
    starters: [
      { pos: "ST", number: 22, nameKo: "TEEKAY" },
      { pos: "LW", number: 11, nameKo: "해리" },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민", outMin: "후반" },
      { pos: "LCM", number: 77, nameKo: "군도", outMin: "34'" },
      { pos: "RCM", number: 10, nameKo: "찰스", outMin: "후반" },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "RB", number: 25, nameKo: "모버트" },
      { pos: "GK", number: 88, nameKo: "티나시", outMin: "전반", injury: true }
    ],
    subsIn: [
      { number: 49, nameKo: "바냐", inMin: "후반" },
      { number: 98, nameKo: "스티브", inMin: "34'" },
      { number: 80, nameKo: "스쿠카", inMin: "후반" },
      { number: 90, nameKo: "마야미코", inMin: "전반" }
    ],
    subsUnused: [15, 20, 66],
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 27주차", score: "심보웨 4 : 2 치주물루", result: "심보웨 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 13주차", score: "치주물루 2 : 1 심보웨", result: "치주물루 승" }
    ],
    historySummary: "최근 2경기 전적 2전 1승 0무 1패로 백중세"
  },
  round3: {
    formation: "4-2-3-1",
    opponentKo: "라이플리 FC",
    result: "1 : 0 승",
    starters: [
      { pos: "ST", number: 22, nameKo: "TEEKAY", goalNote: true },
      { pos: "LW", number: 11, nameKo: "해리" },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 99, nameKo: "패트릭" },
      { pos: "RCM", number: 98, nameKo: "스티브" },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "RB", number: 2, nameKo: "로날드" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [],
    subsUnused: [9, 10, 20, 25, 66, 77, 88],
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 28주차", score: "치주물루 2 : 0 라이플리", result: "치주물루 승" },
      { comp: "2025-26 시즌 MNRF 심소 프리미어 리그 1주차", score: "라이플리 5 : 1 치주물루", result: "라이플리 승" }
    ],
    historySummary: "최근 2경기 전적 2전 1승 0무 1패로 백중세"
  },
  round4: {
    formation: "4-2-3-1",
    opponentKo: "루베 마스터즈 FC",
    result: "0 : 0 무",
    starters: [
      { pos: "ST", number: 22, nameKo: "TEEKAY" },
      { pos: "LW", number: 11, nameKo: "해리", outMin: "후반" },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 98, nameKo: "스티브" },
      { pos: "RCM", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트" },
      { pos: "RB", number: 2, nameKo: "로날드", outMin: "후반" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [
      { number: 10, nameKo: "찰스", inMin: "후반" },
      { number: 77, nameKo: "군도", inMin: "후반" }
    ],
    subsUnused: [9, 20, 49, 66, 88],
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 27주차", score: "치주물루 4 : 1 루베", result: "치주물루 승" },
      { comp: "2025-26 시즌 카스텔컵 지역 단계 3라운드", score: "치주물루 1 : 1 루베 (PSO 4:2)", result: "무승부" },
      { comp: "2025-26 시즌 MNRF 심소 프리미어 리그 2주차", score: "루베 3 : 2 치주물루", result: "루베 승" }
    ],
    historySummary: "최근 3경기 전적 1승 1무 1패로 백중세"
  },
  round5: {
    formation: "4-2-3-1",
    opponentKo: "에크웬데니 FC",
    result: "2 : 0 승",
    starters: [
      { pos: "ST", number: 9, nameKo: "임마누엘", outMin: "29'" },
      { pos: "LW", number: 49, nameKo: "쿰부카니", goalNote: true },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 98, nameKo: "스티브", goalNote: true },
      { pos: "RCM", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "LB", number: 20, nameKo: "프란시스", outMin: "-" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트" },
      { pos: "RB", number: 77, nameKo: "군도" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [
      { number: 22, nameKo: "TK", inMin: "29'" },
      { number: 5, nameKo: "라반", inMin: "-" }
    ],
    subsUnused: [8, 10, 11, 66, 80, 88],
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 28주차", score: "치주물루 5 : 1 에크웬데니", result: "치주물루 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 11주차", score: "에크웬데니 2 : 2 치주물루", result: "무승부" }
    ],
    historySummary: "최근 2경기 전적 2전 1승 1무 0패로 우세"
  }
};

const squadData = [
  { number: 2, position: "DF", nameKo: "로날드 은달라마", nameEn: "Ronald Ndalama" },
  { number: 3, position: "DF", nameKo: "알란 음롱골라", nameEn: "Allan Mlongola", isViceCaptain: true },
  { number: 5, position: "DF", nameKo: "라반 롱웨", nameEn: "Laban Longwe" },
  { number: 6, position: "MF", nameKo: "벤자민 니렌다", nameEn: "Benjamin Nyirenda" },
  { number: 7, position: "MF", nameKo: "디킨스 니렌다", nameEn: "Dickies Nyirenda" },
  { number: 8, position: "MF", nameKo: "엑스퍼트 카망가", nameEn: "Expert Kamanga" },
  { number: 9, position: "FW", nameKo: "임마누엘 음칸다위레", nameEn: "Emmanuel Mkandawire" },
  { number: 10, position: "MF", nameKo: "찰스 데야", nameEn: "Charles Deya" },
  { number: 11, position: "FW", nameKo: "해리 바튼", nameEn: "Harry Barton" },
  { number: 13, position: "DF", nameKo: "조셉 반다", nameEn: "Joseph Banda" },
  { number: 15, position: "DF", nameKo: "만토 카망가", nameEn: "Mantoh Kamanga", isCaptain: true },
  { number: 20, position: "DF", nameKo: "프란시스 피리", nameEn: "Francis Phiri" },
  { number: 22, position: "FW", nameKo: "티모시 카타파", nameEn: "Timothy Katapa" },
  { number: 25, position: "DF", nameKo: "모버트 카타파", nameEn: "Movert Katapa" },
  { number: 49, position: "FW", nameKo: "쿰부카니 바냐", nameEn: "Kumbukani Banya" },
  { number: 66, position: "DF", nameKo: "조던 칠와", nameEn: "Jordon Chirwa" },
  { number: 77, position: "DF", nameKo: "제임스 귄도안", nameEn: "James Gundogan" },
  { number: 80, position: "FW", nameKo: "다니엘 스쿠카", nameEn: "Daniel Scuka" },
  { number: 88, position: "GK", nameKo: "티나시 카삼발라", nameEn: "Tinashe Kasambala" },
  { number: 90, position: "GK", nameKo: "마야미코 치우시와", nameEn: "Mayamiko Chiusiwa" },
  { number: 98, position: "MF", nameKo: "스티브 피리", nameEn: "Steve Phiri" },
  { number: 99, position: "MF", nameKo: "패트릭 지야", nameEn: "Patrick Jiya" }
];

// ===== 팀 수상 정보 (맨 오브 더 매치 / 이달의 선수) =====
// motm: 라운드별 맨 오브 더 매치 수상자. 값은 squadData의 등번호(number) 배열 (공동 수상 가능)
// playerOfTheMonth: 'YYYY-MM' 형식의 월별 이달의 선수 수상자. 값은 squadData의 등번호(number)
const teamAwards = {
  motm: {
    round1: [13, 7],
    round3: [22, 6],
    round5: [49]
  },
  playerOfTheMonth: {
    '2026-07': 90
  }
};

const matchDetails = {
  round1: [
    {
      match: "치바비 3 : 루베 0",
      scorersHome: "CLIFFORD CHISALE, ADJOY SHABANI, HENDERSON KANJIKA",
      scorersAway: "없음"
    },
    {
      match: "비전 4 : 라이플리 3",
      scorersHome: "JOMOLE PHIRI (3골), NATHAN MSISKA",
      scorersAway: "PEARSON NYIRENDA, KONDWANI CHIRWA, ZACHARIAH MPHAMBA"
    },
    {
      match: "친테체 2 : 마푸 2",
      scorersHome: "TEMWA NDHLOVU (2골)",
      scorersAway: "GUMBIKANI BANDA (2골)"
    },
    {
      match: "칠룸바 2 : 에크웬데니 1",
      scorersHome: "BENJAMIN MAPUNDA, WANANGWA GONDWE",
      scorersAway: "MPHATSO KUMWENDA (PK)"
    },
    {
      match: "음벨와 2 : 에우티니 1",
      scorersHome: "SHAIBU JAHALI, MASSA PEREKANI",
      scorersAway: "SOLOMON NKOSI"
    },
    {
      match: "루비리 0 : 젠다 1",
      scorersHome: "없음",
      scorersAway: "WYSON NYIRENDA"
    },
    {
      match: "치주물루 3 : 치하메 1",
      scorersHome: "DICKIES NYIRENDA (2골), HARRY BARTON",
      scorersAway: "KENNEDY SEME"
    }
  ],
  round2: [
    {
      match: "에크웬데니 1 : 치바비 2",
      scorersHome: "EMMANUEL MIOTHA",
      scorersAway: "HENDERSON KANYIKA, THOMPSON MKANDAWIRE"
    },
    {
      match: "젠다 0 : 음벨와 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "치폴로폴로 3 : 루비리 1",
      scorersHome: "CLEMENT MTHALI (2골), MIKE LUHANGA",
      scorersAway: "JONATHAN PHIRI"
    },
    {
      match: "에우티니 1 : 칠룸바 1",
      scorersHome: "DANIEL CHISOKWE",
      scorersAway: "BENJAMIN MAPUNDA"
    },
    {
      match: "루베 4 : 비전 3",
      scorersHome: "MAPALO GUMBO, TAIMON GOMEKA, DUMISAN CHIRAMBO (2골)",
      scorersAway: "NATHAN MSISKA, GOMEZGANI SIBALE, JOMOLLY PHIRI"
    },
    {
      match: "라이플리 3 : 친테체 3",
      scorersHome: "ZAKARIA MPHAMBA (2골), LUMABANI KAMANGA",
      scorersAway: "JIMMY KALANJE, ANDREW KAMANGA (자책골), TEMWA NDHLOVU"
    },
    {
      match: "마푸 1 : 치주물루 0",
      scorersHome: "HERAND PHIRI",
      scorersAway: "없음"
    }
  ],
  round3: [
    {
      match: "비전 0 : 에크웬데니 3",
      scorersHome: "없음",
      scorersAway: "JOLLY MFUNE, MPHATSO KUMWENDA (2골)"
    },
    {
      match: "치하메 0 : 마푸 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "친테체 3 : 루베 0",
      scorersHome: "STUART LONGWE, ESSAU DOBIE (2골)",
      scorersAway: "없음"
    },
    {
      match: "치바비 6 : 에우티니 0",
      scorersHome: "SAM SALE, HENDERSON KANYIKA (4골), KINGLEY MVULA",
      scorersAway: "없음"
    },
    {
      match: "칠룸바 0 : 젠다 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "음벨와 1 : 치폴로폴로 1",
      scorersHome: "LUKE JERE",
      scorersAway: "TYSON KAUNDA"
    },
    {
      match: "치주물루 1 : 라이플리 0",
      scorersHome: "TIMOTHY KATAPA",
      scorersAway: "없음"
    }
  ],
  round4: [
    {
      match: "루베 0 : 치주물루 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "라이플리 7 : 치하메 0",
      scorersHome: "KONDWANI CHIRWA (2골), ZAKARIA MPHAMBA (2골), GRACIOUS YASIN, LIMBANI KAMANGA (PK), PEARSON NYIRENDA",
      scorersAway: "없음"
    },
    {
      match: "젠다 1 : 치바비 0",
      scorersHome: "CHISOMO MYGHA",
      scorersAway: "없음"
    },
    {
      match: "에크웬데니 1 : 친테체 0",
      scorersHome: "DAVIE MWANZA (PK)",
      scorersAway: "없음"
    },
    {
      match: "루비리 0 : 음벨와 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "치폴로폴로 2 : 칠룸바 1",
      scorersHome: "CLEMENT KASEKA, JERPHASON KANYENDA",
      scorersAway: "RAPHAEL PHIRI"
    },
    {
      match: "에우티니 4 : 비전 2",
      scorersHome: "DANIEL CHISOKWE (2골), SOLOMON INKOSI, JASTON MOYO",
      scorersAway: "NATHAN MSISKA (2골)"
    }
  ],
  round5: [
    {
      match: "마푸 1 : 라이플리 1",
      scorersHome: "WONGANI KAMANGA (PK)",
      scorersAway: "ZAKARIA MPHAMBA"
    },
    {
      match: "칠룸바 1 : 루비리 0",
      scorersHome: "BENJAMIN MAPUNDA",
      scorersAway: "없음"
    },
    {
      match: "친테체 2 : 에우티니 0",
      scorersHome: "ESSAU NGWIRA, ESSAU DOBIE",
      scorersAway: "없음"
    },
    {
      match: "치바비 4 : 치폴로폴로 1",
      scorersHome: "HENDERSON KANYIKA, SYDNEY MHONE, ISSA HASSAN, AUSTINE NGOMA",
      scorersAway: "CLEMENT MTHALI"
    },
    {
      match: "비전 2 : 젠다 4",
      scorersHome: "CHIKONDI SAKA (2골)",
      scorersAway: "CHIKONDI NYIRENDA, EDWIN NYIRENDA (2골), DUNCAN MPOHA"
    },
    {
      match: "치하메 4 : 루베 2",
      scorersHome: "KENNEDY SEME (2골), BABA NKHOMA, SAMANI NYIRENDA",
      scorersAway: "FRANK MWALE, MAPALO GUMBO"
    },
    {
      match: "치주물루 2 : 에크웬데니 0",
      scorersHome: "STEVEN PHIRI, KUMBUKANI BANYA",
      scorersAway: "없음"
    }
  ]
};


const roundsData = {
  round1: [
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", homeScore: 3, awayScore: 0 },
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "라이플리 FC", awayEn: "Raiply FC", homeScore: 4, awayScore: 3 },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", homeScore: 2, awayScore: 2 },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", homeScore: 2, awayScore: 1 },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", homeScore: 2, awayScore: 1 },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", homeScore: 0, awayScore: 1 },
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", homeScore: 3, awayScore: 1 },
    { byeKo: "치폴로폴로 FC", byeEn: "Chipolopolo FC" }
  ],
  round2: [
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", homeScore: 1, awayScore: 2 },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", homeScore: 0, awayScore: 0 },
    { homeKo: "치폴로폴로 FC", homeEn: "Chipolopolo FC", awayKo: "루비리 FC", awayEn: "Luviri FC", homeScore: 3, awayScore: 1 },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", homeScore: 1, awayScore: 1 },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", homeScore: 4, awayScore: 3 },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", homeScore: 3, awayScore: 3 },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", homeScore: 1, awayScore: 0 },
    { byeKo: "치하메 올스타즈 FC", byeEn: "Chihame All Stars FC" }
  ],
  round3: [
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", homeScore: 0, awayScore: 3 },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", homeScore: 0, awayScore: 0 },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", homeScore: 3, awayScore: 0 },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", homeScore: 6, awayScore: 0 },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", homeScore: 0, awayScore: 0 },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "치폴로폴로 FC", awayEn: "Chipolopolo FC", homeScore: 1, awayScore: 1 },
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", homeScore: 1, awayScore: 0 },
    { byeKo: "루비리 FC", byeEn: "Luviri FC" }
  ],
  round4: [
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", homeScore: 0, awayScore: 0 },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", homeScore: 7, awayScore: 0 },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", homeScore: 1, awayScore: 0 },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", homeScore: 1, awayScore: 0 },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", homeScore: 0, awayScore: 0 },
    { homeKo: "치폴로폴로 FC", homeEn: "Chipolopolo FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", homeScore: 2, awayScore: 1 },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", homeScore: 4, awayScore: 2 },
    { byeKo: "마푸 스타즈 FC", byeEn: "Mafu Stars FC" }
  ],
  round5: [
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", homeScore: 1, awayScore: 1 },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "루비리 FC", awayEn: "Luviri FC", homeScore: 1, awayScore: 0 },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", homeScore: 2, awayScore: 0 },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "치폴로폴로 FC", awayEn: "Chipolopolo FC", homeScore: 4, awayScore: 1 },
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", homeScore: 2, awayScore: 4 },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", homeScore: 4, awayScore: 2 },
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", homeScore: 2, awayScore: 0 },
    { byeKo: "음벨와 워리어스 FC", byeEn: "M'mbelwa Warriors FC" }
  ]
};

// ============================================================
// 주차별 순위 히스토리 계산
// ------------------------------------------------------------
// roundsData(라운드별 홈/원정 결과)를 순서대로 누적 적용해서
// 각 라운드가 끝난 시점의 팀별 순위를 계산합니다.
// (부전승 라운드는 순위에 영향 없이 그대로 유지됩니다)
// ============================================================
function computeStandingsHistory() {
  const state = {};
  leagueData.forEach(t => {
    state[t.nameEn] = { pts: 0, gf: 0, ga: 0 };
  });

  const roundKeys = Object.keys(roundsData).sort((a, b) => {
    const na = parseInt(a.replace('round', ''), 10);
    const nb = parseInt(b.replace('round', ''), 10);
    return na - nb;
  });

  const history = []; // [{ week, ranks: { nameEn: rank } }]

  roundKeys.forEach((roundKey, idx) => {
    roundsData[roundKey].forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (!m.homeEn || !m.awayEn) return;
      const home = state[m.homeEn];
      const away = state[m.awayEn];
      if (!home || !away) return;

      home.gf += m.homeScore;
      home.ga += m.awayScore;
      away.gf += m.awayScore;
      away.ga += m.homeScore;

      if (m.homeScore > m.awayScore) home.pts += 3;
      else if (m.homeScore < m.awayScore) away.pts += 3;
      else { home.pts += 1; away.pts += 1; }
    });

    const standings = leagueData
      .map(t => ({
        nameEn: t.nameEn,
        pts: state[t.nameEn].pts,
        gd: state[t.nameEn].gf - state[t.nameEn].ga,
        gf: state[t.nameEn].gf
      }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });

    const ranks = {};
    standings.forEach((s, i) => { ranks[s.nameEn] = i + 1; });

    history.push({ week: idx + 1, ranks });
  });

  return history;
}

const leagueData = [
  {
    nameKo: "치바비 리얼 스타스 FC", nameEn: "Chibavi Real Stars FC", logoSrc: "치바비.webp",
    played: 5, won: 4, drawn: 0, lost: 1, goalsFor: 15, goalsAgainst: 3, cleanSheets: 2, failedToScore: 1,
    form: ["W", "L", "W", "W", "W"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "루비리 FC", oppEn: "Luviri FC", oppLogo: "루비리.webp" }
  },
  {
    nameKo: "젠다 유나이티드 FC", nameEn: "Jenda United FC", logoSrc: "젠다.webp",
    played: 5, won: 3, drawn: 2, lost: 0, goalsFor: 6, goalsAgainst: 2, cleanSheets: 4, failedToScore: 2,
    form: ["W", "D", "D", "W", "W"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "친테체 유나이티드 FC", oppEn: "Chintheche United FC", oppLogo: "친테체.webp" }
  },
  {
    nameKo: "치주물루 유나이티드 FC", nameEn: "Chizumulu United FC", logoSrc: "dd.svg",
    played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 6, goalsAgainst: 2, cleanSheets: 3, failedToScore: 2,
    form: ["W", "L", "W", "D", "W"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "에우티니 베테랑스 FC", oppEn: "Euthini Veterans FC", oppLogo: "에우티니.webp" }
  },
  {
    nameKo: "친테체 유나이티드 FC", nameEn: "Chintheche United FC", logoSrc: "친테체.webp",
    played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 10, goalsAgainst: 6, cleanSheets: 2, failedToScore: 2,
    form: ["D", "D", "W", "L", "W"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "에크웬데니 FC", oppEn: "Ekwendeni FC", oppLogo: "에크웬데니.webp" }
  },
  {
    nameKo: "칠룸바 배럭스 FC", nameEn: "Chilumba Barracks FC", logoSrc: "칠룸바.webp",
    played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 5, goalsAgainst: 4, cleanSheets: 2, failedToScore: 2,
    form: ["W", "D", "D", "L", "W"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "음벨와 워리어스 FC", oppEn: "M'mbelwa Warriors FC", oppLogo: "음벨와.webp" }
  },
  {
    nameKo: "마푸 스타즈 FC", nameEn: "Mafu Stars FC", logoSrc: "마푸스타즈.webp",
    played: 4, won: 1, drawn: 3, lost: 0, goalsFor: 4, goalsAgainst: 3, cleanSheets: 1, failedToScore: 1,
    form: ["D", "W", "D", "D"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "루베 마스터즈 FC", oppEn: "Lube Masters FC", oppLogo: "루베.webp" }
  },
  {
    nameKo: "음벨와 워리어스 FC", nameEn: "M'mbelwa Warriors FC", logoSrc: "음벨와.webp",
    played: 4, won: 1, drawn: 3, lost: 0, goalsFor: 3, goalsAgainst: 2, cleanSheets: 2, failedToScore: 1,
    form: ["W", "D", "D", "D"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "칠룸바 배럭스 FC", oppEn: "Chilumba Barracks FC", oppLogo: "칠룸바.webp" }
  },
  {
    nameKo: "치폴로폴로 FC", nameEn: "Chipolopolo FC", logoSrc: "치폴로폴로.webp",
    played: 4, won: 2, drawn: 1, lost: 1, goalsFor: 7, goalsAgainst: 7, cleanSheets: 0, failedToScore: 0,
    form: ["W", "D", "W", "L"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "비전 S 아카데미", oppEn: "Vision S Academy", oppLogo: "비전아카데미.webp" }
  },
  {
    nameKo: "에크웬데니 FC", nameEn: "Ekwendeni FC", logoSrc: "에크웬데니.webp",
    played: 5, won: 2, drawn: 0, lost: 3, goalsFor: 6, goalsAgainst: 6, cleanSheets: 1, failedToScore: 2,
    form: ["L", "W", "W", "L", "L"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "치하메 올스타즈 FC", oppEn: "Chihame All Stars FC", oppLogo: "치하메.webp" }
  },
  {
    nameKo: "루베 마스터즈 FC", nameEn: "Lube Masters FC", logoSrc: "루베.webp",
    played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 6, goalsAgainst: 13, cleanSheets: 1, failedToScore: 3,
    form: ["L", "W", "L", "D", "L"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "마푸 스타즈 FC", oppEn: "Mafu Stars FC", oppLogo: "마푸스타즈.webp" }
  },
  {
    nameKo: "치하메 올스타즈 FC", nameEn: "Chihame All Stars FC", logoSrc: "치하메.webp",
    played: 4, won: 1, drawn: 1, lost: 2, goalsFor: 5, goalsAgainst: 12, cleanSheets: 1, failedToScore: 2,
    form: ["L", "D", "L", "W"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "에크웬데니 FC", oppEn: "Ekwendeni FC", oppLogo: "에크웬데니.webp" }
  },
  {
    nameKo: "라이플리 FC", nameEn: "Raiply FC", logoSrc: "라이플리.webp",
    played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 14, goalsAgainst: 9, cleanSheets: 1, failedToScore: 1,
    form: ["L", "D", "L", "W", "D"],
    nextMatch: { isBye: true }
  },
  {
    nameKo: "에우티니 베테랑스 FC", nameEn: "Euthini Veterans FC", logoSrc: "에우티니.webp",
    played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 6, goalsAgainst: 13, cleanSheets: 0, failedToScore: 2,
    form: ["L", "D", "L", "W", "L"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "치주물루 유나이티드 FC", oppEn: "Chizumulu United FC", oppLogo: "dd.svg" }
  },
  {
    nameKo: "비전 S 아카데미", nameEn: "Vision S Academy", logoSrc: "비전아카데미.webp",
    played: 5, won: 1, drawn: 0, lost: 4, goalsFor: 11, goalsAgainst: 18, cleanSheets: 0, failedToScore: 1,
    form: ["W", "L", "L", "L", "L"],
    nextMatch: { isBye: false, homeAway: "A", oppKo: "치폴로폴로 FC", oppEn: "Chipolopolo FC", oppLogo: "치폴로폴로.webp" }
  },
  {
    nameKo: "루비리 FC", nameEn: "Luviri FC", logoSrc: "루비리.webp",
    played: 4, won: 0, drawn: 1, lost: 3, goalsFor: 1, goalsAgainst: 5, cleanSheets: 1, failedToScore: 3,
    form: ["L", "L", "D", "L"],
    nextMatch: { isBye: false, homeAway: "H", oppKo: "치바비 리얼 스타스 FC", oppEn: "Chibavi Real Stars FC", oppLogo: "치바비.webp" }
  }
];

// ============================================================
// 득점 순위 (topScorersData) 자동 계산
// ------------------------------------------------------------
// 더 이상 득점 순위를 직접 세어 하드코딩하지 않습니다.
// 매주 matchDetails 에 그 라운드의 경기 결과와 득점자만 추가하면
// 아래 로직이 전체 라운드를 다시 훑어서 득점 순위를 자동으로 계산합니다.
//
// - "N골" 표기가 있으면 해당 숫자만큼, 없으면 1골로 계산합니다.
// - "(PK)" 표기는 득점으로 인정하되 추가 골로 계산하지 않습니다.
// - "(자책골)" 표기는 득점자 개인 기록에서 제외합니다 (팀 실점에는 이미 반영됨).
// - matchDetails 안의 이름 표기가 라운드마다 살짝 다른 경우
//   (오타 등)를 위해 nameAliases 로 동일 선수로 묶어줍니다.
// - 선수의 한글 이름은 playerDirectory 에서 가져옵니다. 새로운 득점자가
//   matchDetails 에 등장했는데 playerDirectory 에 없으면, 일단 영문 이름을
//   그대로 사용하고, 아래 목록에 "영문이름": { nameKo: "...", nameEn: "..." }
//   한 줄만 추가해주면 됩니다.
// ============================================================

// 라운드별 원문 표기가 서로 다른 동일 선수를 하나로 묶어주는 별칭 매핑
// (예: 1주차 오타 "HENDERSON KANJIKA" -> 이후 라운드 표기 "HENDERSON KANYIKA")
const nameAliases = {
  "HENDERSON KANJIKA": "HENDERSON KANYIKA",
  "JOMOLLY PHIRI": "JOMOLE PHIRI",
  "LUMABANI KAMANGA": "LIMBANI KAMANGA",
  "SOLOMON INKOSI": "SOLOMON NKOSI",
  "ZACHARIAH MPHAMBA": "ZAKARIA MPHAMBA"
};

// 영문 이름(대문자) -> 한글/영문 표기 사전. matchDetails 에 새 득점자가
// 나오면 이 사전에 한 줄만 추가하면 나머지는 자동으로 계산됩니다.
const playerDirectory = {
  "HENDERSON KANYIKA": { nameKo: "헨더슨 칸이카", nameEn: "Henderson Kanyika" },
  "ZAKARIA MPHAMBA": { nameKo: "자카리아 음팜바", nameEn: "Zakaria Mphamba" },
  "NATHAN MSISKA": { nameKo: "네이단 음시스카", nameEn: "Nathan Msiska" },
  "JOMOLE PHIRI": { nameKo: "조몰레 피리", nameEn: "Jomole Phiri" },
  "KONDWANI CHIRWA": { nameKo: "콘드와니 치르와", nameEn: "Kondwani Chirwa" },
  "TEMWA NDHLOVU": { nameKo: "템와 은들로부", nameEn: "Temwa Ndhlovu" },
  "ESSAU DOBIE": { nameKo: "에사우 도비", nameEn: "Essau Dobie" },
  "BENJAMIN MAPUNDA": { nameKo: "벤자민 마푼다", nameEn: "Benjamin Mapunda" },
  "MPHATSO KUMWENDA": { nameKo: "음파초 쿰웬다", nameEn: "Mphatso Kumwenda" },
  "DANIEL CHISOKWE": { nameKo: "다니엘 치소크웨", nameEn: "Daniel Chisokwe" },
  "KENNEDY SEME": { nameKo: "케네디 세메", nameEn: "Kennedy Seme" },
  "CLEMENT MTHALI": { nameKo: "클레멘트 음탈리", nameEn: "Clement Mthali" },
  "GUMBIKANI BANDA": { nameKo: "감비카니 반다", nameEn: "Gumbikani Banda" },
  "CHIKONDI SAKA": { nameKo: "치콘디 사카", nameEn: "Chikondi Saka" },
  "PEARSON NYIRENDA": { nameKo: "피어슨 니렌다", nameEn: "Pearson Nyirenda" },
  "SOLOMON NKOSI": { nameKo: "솔로몬 은코시", nameEn: "Solomon Nkosi" },
  "DICKIES NYIRENDA": { nameKo: "디킨스 니렌다", nameEn: "Dickies Nyirenda" },
  "DUMISAN CHIRAMBO": { nameKo: "듀미산 치람보", nameEn: "Dumisan Chirambo" },
  "MAPALO GUMBO": { nameKo: "마팔로 굼보", nameEn: "Mapalo Gumbo" },
  "EDWIN NYIRENDA": { nameKo: "에드윈 니렌다", nameEn: "Edwin Nyirenda" },
  "CLIFFORD CHISALE": { nameKo: "클리포드 치살레", nameEn: "Clifford Chisale" },
  "ADJOY SHABANI": { nameKo: "아조이 샤바니", nameEn: "Adjoy Shabani" },
  "THOMPSON MKANDAWIRE": { nameKo: "톰슨 음칸다위레", nameEn: "Thompson Mkandawire" },
  "SAM SALE": { nameKo: "샘 세일", nameEn: "Sam Sale" },
  "KINGLEY MVULA": { nameKo: "킹슬리 음불라", nameEn: "Kingley Mvula" },
  "SYDNEY MHONE": { nameKo: "시드니 모네", nameEn: "Sydney Mhone" },
  "ISSA HASSAN": { nameKo: "이사 하산", nameEn: "Issa Hassan" },
  "AUSTINE NGOMA": { nameKo: "오스틴 응고마", nameEn: "Austine Ngoma" },
  "GRACIOUS YASIN": { nameKo: "그레이셔스 야신", nameEn: "Gracious Yasin" },
  "LIMBANI KAMANGA": { nameKo: "림바니 카망가", nameEn: "Limbani Kamanga" },
  "JIMMY KALANJE": { nameKo: "지미 칼란제", nameEn: "Jimmy Kalanje" },
  "STUART LONGWE": { nameKo: "스튜어트 롱웨", nameEn: "Stuart Longwe" },
  "ESSAU NGWIRA": { nameKo: "에사우 응위라", nameEn: "Essau Ngwira" },
  "HERAND PHIRI": { nameKo: "헤란드 피리", nameEn: "Herand Phiri" },
  "WONGANI KAMANGA": { nameKo: "웡가니 카망가", nameEn: "Wongani Kamanga" },
  "WANANGWA GONDWE": { nameKo: "와낭과 곤드웨", nameEn: "Wanangwa Gondwe" },
  "RAPHAEL PHIRI": { nameKo: "라파엘 피리", nameEn: "Raphael Phiri" },
  "EMMANUEL MIOTHA": { nameKo: "임마누엘 미오타", nameEn: "Emmanuel Miotha" },
  "JOLLY MFUNE": { nameKo: "졸리 음푸네", nameEn: "Jolly Mfune" },
  "DAVIE MWANZA": { nameKo: "데이비 므완자", nameEn: "Davie Mwanza" },
  "SHAIBU JAHALI": { nameKo: "샤이부 자할리", nameEn: "Shaibu Jahali" },
  "MASSA PEREKANI": { nameKo: "마사 페레카니", nameEn: "Massa Perekani" },
  "LUKE JERE": { nameKo: "루크 제레", nameEn: "Luke Jere" },
  "JASTON MOYO": { nameKo: "재스톤 모요", nameEn: "Jaston Moyo" },
  "JONATHAN PHIRI": { nameKo: "조나단 피리", nameEn: "Jonathan Phiri" },
  "WYSON NYIRENDA": { nameKo: "와이슨 니렌다", nameEn: "Wyson Nyirenda" },
  "CHISOMO MYGHA": { nameKo: "치소모 미그하", nameEn: "Chisomo Mygha" },
  "CHIKONDI NYIRENDA": { nameKo: "치콘디 니렌다", nameEn: "Chikondi Nyirenda" },
  "DUNCAN MPOHA": { nameKo: "던컨 음포하", nameEn: "Duncan Mpoha" },
  "HARRY BARTON": { nameKo: "해리 바튼", nameEn: "Harry Barton" },
  "TIMOTHY KATAPA": { nameKo: "티모시 카타파", nameEn: "Timothy Katapa" },
  "STEVEN PHIRI": { nameKo: "스티브 피리", nameEn: "Steven Phiri" },
  "KUMBUKANI BANYA": { nameKo: "쿰부카니 바냐", nameEn: "Kumbukani Banya" },
  "BABA NKHOMA": { nameKo: "바바 은코마", nameEn: "Baba Nkhoma" },
  "SAMANI NYIRENDA": { nameKo: "사마니 니렌다", nameEn: "Samani Nyirenda" },
  "TAIMON GOMEKA": { nameKo: "타이몬 고메카", nameEn: "Taimon Gomeka" },
  "FRANK MWALE": { nameKo: "프랭크 므왈레", nameEn: "Frank Mwale" },
  "MIKE LUHANGA": { nameKo: "마이크 루항가", nameEn: "Mike Luhanga" },
  "TYSON KAUNDA": { nameKo: "타이슨 카운다", nameEn: "Tyson Kaunda" },
  "CLEMENT KASEKA": { nameKo: "클레멘트 카세카", nameEn: "Clement Kaseka" },
  "JERPHASON KANYENDA": { nameKo: "제르파손 칸옌다", nameEn: "Jerphason Kanyenda" },
  "GOMEZGANI SIBALE": { nameKo: "고메즈가니 시발레", nameEn: "Gomezgani Sibale" }
};

function toTitleCase(upperName) {
  return upperName
    .split(" ")
    .map(w => (w.length ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// nameEn 으로 leagueData 에서 팀 정보를 찾아줍니다 (로고 등 참조용)
function findTeamByNameEn(nameEn) {
  return leagueData.find(t => t.nameEn === nameEn) || null;
}

// matchDetails 의 "치바비 3 : 루베 0" 같은 짧은 팀 표기를
// leagueData 의 정식 팀 정보(로고/영문명 포함)로 연결해주는 맵
function buildShortNameToTeamMap() {
  const map = {};
  leagueData.forEach(team => {
    const shortName = team.nameKo.split(" ")[0];
    map[shortName] = team;
  });
  return map;
}

// matchDetails 전체를 훑어서 득점 순위를 계산합니다.
function computeTopScorers() {
  const teamByShortName = buildShortNameToTeamMap();
  const goalsByPlayer = {}; // key: 정규화된 영문 이름 -> { goals, team }

  function addScorers(scorerText, team) {
    if (!scorerText || scorerText === "없음" || !team) return;

    scorerText.split(",").forEach(rawSegment => {
      const segment = rawSegment.trim();
      if (!segment) return;

      const parenMatch = segment.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      const rawName = (parenMatch ? parenMatch[1] : segment).trim();
      const note = parenMatch ? parenMatch[2] : "";

      // 자책골은 득점자 개인 기록에서 제외 (이미 상대팀 실점에 반영됨)
      if (/자책골/.test(note)) return;

      let goals = 1;
      const golMatch = note.match(/(\d+)\s*골/);
      if (golMatch) goals = parseInt(golMatch[1], 10);

      let key = rawName.toUpperCase();
      if (nameAliases[key]) key = nameAliases[key];

      if (!goalsByPlayer[key]) {
        goalsByPlayer[key] = { goals: 0, team };
      }
      goalsByPlayer[key].goals += goals;
    });
  }

  Object.keys(matchDetails).forEach(roundKey => {
    matchDetails[roundKey].forEach(m => {
      const parts = m.match.split(":").map(s => s.trim());
      if (parts.length !== 2) return;

      const homeParse = parts[0].match(/^(.+?)\s+(\d+)$/);
      const awayParse = parts[1].match(/^(.+?)\s+(\d+)$/);
      const homeTeam = homeParse ? teamByShortName[homeParse[1]] : null;
      const awayTeam = awayParse ? teamByShortName[awayParse[1]] : null;

      addScorers(m.scorersHome, homeTeam);
      addScorers(m.scorersAway, awayTeam);
    });
  });

  return Object.keys(goalsByPlayer)
    .map(key => {
      const { goals, team } = goalsByPlayer[key];
      const info = playerDirectory[key] || { nameKo: toTitleCase(key), nameEn: toTitleCase(key) };
      return {
        key,
        nameKo: info.nameKo,
        nameEn: info.nameEn,
        teamKo: team.nameKo,
        teamEn: team.nameEn,
        teamLogo: team.logoSrc,
        goals
      };
    })
    .sort((a, b) => b.goals - a.goals);
}

// 득점 순위 데이터 (matchDetails 로부터 자동 계산됨. 더 이상 직접 수정할 필요 없음)
const topScorersData = computeTopScorers();

// ============================================================
// 선수별 득점 타임라인 (playerGoalTimelines) 자동 계산
// ------------------------------------------------------------
// 득점 순위표에서 선수 이름을 클릭했을 때 보여줄 "어느 라운드에 몇 골을
// 넣었는지" 타임라인입니다. roundsData(팀/스코어 정보)와 matchDetails
// (라운드별 득점자 목록)를 라운드별로 같은 순서로 짝지어서 계산합니다.
// (round-results 뷰의 buildRoundMatches() 와 동일한 정렬 방식)
// 반환값: { "선수이름(대문자, 정규화됨)": [ {roundKey, weekNum, goals, isPk,
//           teamEn, teamKo, oppEn, oppKo, oppLogo, homeAway, homeScore, awayScore}, ... ] }
// ============================================================
function computePlayerGoalTimelines() {
  const timelines = {};

  function addEntry(scorerText, ctx) {
    if (!scorerText || scorerText === "없음") return;

    scorerText.split(",").forEach(rawSegment => {
      const segment = rawSegment.trim();
      if (!segment) return;

      const parenMatch = segment.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      const rawName = (parenMatch ? parenMatch[1] : segment).trim();
      const note = parenMatch ? parenMatch[2] : "";

      // 자책골은 득점자 개인 기록에서 제외 (이미 상대팀 실점에 반영됨)
      if (/자책골/.test(note)) return;

      let goals = 1;
      const golMatch = note.match(/(\d+)\s*골/);
      if (golMatch) goals = parseInt(golMatch[1], 10);
      const isPk = /PK/i.test(note);

      let key = rawName.toUpperCase();
      if (nameAliases[key]) key = nameAliases[key];

      if (!timelines[key]) timelines[key] = [];
      timelines[key].push({
        roundKey: ctx.roundKey,
        weekNum: ctx.weekNum,
        goals,
        isPk,
        teamEn: ctx.teamEn,
        teamKo: ctx.teamKo,
        oppEn: ctx.oppEn,
        oppKo: ctx.oppKo,
        oppLogo: ctx.oppLogo,
        homeAway: ctx.homeAway,
        homeScore: ctx.homeScore,
        awayScore: ctx.awayScore
      });
    });
  }

  const roundKeysSorted = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  roundKeysSorted.forEach((roundKey, idx) => {
    const weekNum = idx + 1;
    const matches = roundsData[roundKey] || [];
    const details = matchDetails[roundKey] || [];
    let detailIdx = 0;

    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return; // 부전승 라운드는 득점 기록이 없으므로 스킵

      const d = details[detailIdx] || {};
      detailIdx++;

      const homeTeam = findTeamByNameEn(m.homeEn);
      const awayTeam = findTeamByNameEn(m.awayEn);

      addEntry(d.scorersHome, {
        roundKey, weekNum,
        teamEn: m.homeEn, teamKo: m.homeKo,
        oppEn: m.awayEn, oppKo: m.awayKo,
        oppLogo: awayTeam ? awayTeam.logoSrc : '',
        homeAway: 'H', homeScore: m.homeScore, awayScore: m.awayScore
      });
      addEntry(d.scorersAway, {
        roundKey, weekNum,
        teamEn: m.awayEn, teamKo: m.awayKo,
        oppEn: m.homeEn, oppKo: m.homeKo,
        oppLogo: homeTeam ? homeTeam.logoSrc : '',
        homeAway: 'A', homeScore: m.homeScore, awayScore: m.awayScore
      });
    });
  });

  return timelines;
}

// 선수별 득점 타임라인 데이터 (matchDetails/roundsData 로부터 자동 계산됨)
const playerGoalTimelines = computePlayerGoalTimelines();

// ============================================================
// 경기 예측 (몬테카를로 시뮬레이션)
// ------------------------------------------------------------
// 15팀이 서로 홈/어웨이로 2경기씩(총 210경기) 치르는 리그 구조를
// 기준으로, 아직 열리지 않은 경기들을 찾아내 포아송 분포 기반으로
// 결과를 수천 번 반복 시뮬레이션합니다. roundsData 에 이미 기록된
// 경기(홈/원정 포함)를 훑어서 각 팀 쌍이 몇 번 붙었는지, 누가 홈을
// 가졌는지를 계산한 뒤, 남은 매치업을 자동으로 생성합니다.
// ============================================================

// 팀 쌍(A,B)이 이미 몇 번, 누가 홈으로 붙었는지 계산
function computePlayedPairs() {
  const pairs = {}; // key: "A||B" (nameEn 알파벳순 정렬) -> { count, homes: [nameEn,...] }

  function keyFor(aEn, bEn) {
    return aEn < bEn ? `${aEn}||${bEn}` : `${bEn}||${aEn}`;
  }

  Object.keys(roundsData).forEach(roundKey => {
    roundsData[roundKey].forEach(m => {
      if (m.byeKo || m.byeEn) return; // 부전승 라운드는 스킵
      if (!m.homeEn || !m.awayEn) return;
      const key = keyFor(m.homeEn, m.awayEn);
      if (!pairs[key]) pairs[key] = { count: 0, homes: [] };
      pairs[key].count += 1;
      pairs[key].homes.push(m.homeEn);
    });
  });

  return pairs;
}

// 시즌 전체(각 팀 쌍이 홈/원정 한 번씩, 총 210경기) 기준으로 아직
// 열리지 않은 경기 목록을 만듭니다.
function generateRemainingFixtures() {
  const playedPairs = computePlayedPairs();
  const fixtures = [];

  for (let i = 0; i < leagueData.length; i++) {
    for (let j = i + 1; j < leagueData.length; j++) {
      const teamA = leagueData[i];
      const teamB = leagueData[j];
      const key = teamA.nameEn < teamB.nameEn
        ? `${teamA.nameEn}||${teamB.nameEn}`
        : `${teamB.nameEn}||${teamA.nameEn}`;
      const info = playedPairs[key] || { count: 0, homes: [] };

      if (info.count === 0) {
        // 아직 한 번도 안 붙음: 홈/원정 한 번씩 총 2경기 남음
        fixtures.push({ home: teamA, away: teamB });
        fixtures.push({ home: teamB, away: teamA });
      } else if (info.count === 1) {
        // 한 번 붙었음: 홈을 안 가졌던 팀이 홈으로 남은 한 경기
        const alreadyHome = info.homes[0];
        if (alreadyHome === teamA.nameEn) {
          fixtures.push({ home: teamB, away: teamA });
        } else {
          fixtures.push({ home: teamA, away: teamB });
        }
      }
      // count >= 2 면 이미 두 번 다 붙었으므로 남은 경기 없음
    }
  }

  return fixtures;
}

// 팀별 공격력/수비력 지수 (리그 평균 대비) 계산
function computeTeamStrengths() {
  let totalGoals = 0;
  let totalGames = 0;
  leagueData.forEach(t => {
    totalGoals += t.goalsFor;
    totalGames += t.played;
  });
  // 팀-경기당 평균 득점 (리그 전체 평균 공수 기준선)
  const leagueAvgGoals = totalGames > 0 ? totalGoals / totalGames : 1.3;

  const strengths = {};
  leagueData.forEach(t => {
    const gfpg = t.played > 0 ? t.goalsFor / t.played : leagueAvgGoals;
    const gapg = t.played > 0 ? t.goalsAgainst / t.played : leagueAvgGoals;
    strengths[t.nameEn] = {
      attack: Math.max(0.25, gfpg / leagueAvgGoals),
      defense: Math.max(0.25, gapg / leagueAvgGoals)
    };
  });

  return { strengths, leagueAvgGoals };
}

// Knuth 알고리즘 기반 포아송 난수 생성기
function poissonRandom(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

const HOME_ADVANTAGE = 1.15;
const AWAY_DISADVANTAGE = 0.87;

// 몬테카를로 시즌 시뮬레이션 실행
// iterations: 반복 횟수 (기본 4000회)
function runMonteCarloSimulation(iterations) {
  const N = iterations || 4000;
  const fixtures = generateRemainingFixtures();
  const { strengths, leagueAvgGoals } = computeTeamStrengths();

  const teams = leagueData.map(t => ({
    nameEn: t.nameEn,
    nameKo: t.nameKo,
    logoSrc: t.logoSrc
  }));
  const teamCount = teams.length;
  const rankCounts = {}; // nameEn -> [순위1횟수, 순위2횟수, ...]
  const champCount = {};
  const top3Count = {};
  const bottom3Count = {};
  const finalPtsSum = {};
  const finalRankSum = {};

  teams.forEach(t => {
    rankCounts[t.nameEn] = new Array(teamCount).fill(0);
    champCount[t.nameEn] = 0;
    top3Count[t.nameEn] = 0;
    bottom3Count[t.nameEn] = 0;
    finalPtsSum[t.nameEn] = 0;
    finalRankSum[t.nameEn] = 0;
  });

  // 시뮬레이션 시작 시점의 팀별 기록 스냅샷 (원본 변형 없음)
  const baseStats = {};
  leagueData.forEach(t => {
    baseStats[t.nameEn] = {
      pts: t.won * 3 + t.drawn * 1,
      gf: t.goalsFor,
      ga: t.goalsAgainst
    };
  });

  for (let sim = 0; sim < N; sim++) {
    const state = {};
    teams.forEach(t => {
      state[t.nameEn] = {
        pts: baseStats[t.nameEn].pts,
        gf: baseStats[t.nameEn].gf,
        ga: baseStats[t.nameEn].ga
      };
    });

    fixtures.forEach(fx => {
      const homeS = strengths[fx.home.nameEn];
      const awayS = strengths[fx.away.nameEn];

      const homeExpected = leagueAvgGoals * homeS.attack * awayS.defense * HOME_ADVANTAGE;
      const awayExpected = leagueAvgGoals * awayS.attack * homeS.defense * AWAY_DISADVANTAGE;

      const homeGoals = poissonRandom(homeExpected);
      const awayGoals = poissonRandom(awayExpected);

      const homeState = state[fx.home.nameEn];
      const awayState = state[fx.away.nameEn];

      homeState.gf += homeGoals;
      homeState.ga += awayGoals;
      awayState.gf += awayGoals;
      awayState.ga += homeGoals;

      if (homeGoals > awayGoals) {
        homeState.pts += 3;
      } else if (homeGoals < awayGoals) {
        awayState.pts += 3;
      } else {
        homeState.pts += 1;
        awayState.pts += 1;
      }
    });

    const standings = teams
      .map(t => ({
        nameEn: t.nameEn,
        pts: state[t.nameEn].pts,
        gd: state[t.nameEn].gf - state[t.nameEn].ga,
        gf: state[t.nameEn].gf
      }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });

    standings.forEach((s, idx) => {
      const rank = idx + 1;
      rankCounts[s.nameEn][idx] += 1;
      finalPtsSum[s.nameEn] += s.pts;
      finalRankSum[s.nameEn] += rank;
      if (rank === 1) champCount[s.nameEn] += 1;
      if (rank <= 3) top3Count[s.nameEn] += 1;
      if (rank > teamCount - 3) bottom3Count[s.nameEn] += 1;
    });
  }

  const results = teams.map(t => ({
    nameEn: t.nameEn,
    nameKo: t.nameKo,
    logoSrc: t.logoSrc,
    championPct: (champCount[t.nameEn] / N) * 100,
    top3Pct: (top3Count[t.nameEn] / N) * 100,
    bottom3Pct: (bottom3Count[t.nameEn] / N) * 100,
    avgFinalPts: finalPtsSum[t.nameEn] / N,
    avgFinalRank: finalRankSum[t.nameEn] / N
  }));

  results.sort((a, b) => b.championPct - a.championPct || a.avgFinalRank - b.avgFinalRank);

  return {
    results,
    iterations: N,
    remainingFixtureCount: fixtures.length
  };
}
