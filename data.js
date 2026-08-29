// 치웨미 인베스트먼트 NRFA 리그 원 - 26/27 시즌 데이터베이스

// ===== 시즌/라운드 날짜 정보 =====
// SEASON_START: 시즌 개막일 (참고용, 화면 로직에는 쓰이지 않음)
// "N주차" 표기와 다음 라운드 시작일은 이제 이 파일을 직접 수정할 필요가 없습니다.
// - 화면 상단의 "N주차" 는 roundsData(완료된 라운드 수)와 scheduledRounds(다음 라운드의 kickoffDate)를 보고
//   app.js에서 자동으로 계산합니다.
// - 라운드가 끝나면 지금처럼 해당 라운드를 scheduledRounds에서 roundsData로 옮기고 스코어만 채워주면,
//   주차 표기와 다음 라운드 시작일은 알아서 갱신됩니다.
const SEASON_START = '2026-07-12';

// ===== 리그 운영 방식 =====
// 15개 팀이 홈·원정으로 한 번씩 만나는 시즌이라 총 30라운드(팀당 28경기)입니다.
// 매직넘버는 이 값을 기준으로 남은 경기와 각 팀의 이론상 최대 승점을 계산합니다.
const SEASON_TOTAL_ROUNDS = 30;

// ===== 라운드별 경기 하이라이트 영상 링크 =====
// roundKey(round1, round2 ...)를 키로, 해당 라운드의 치주물루 경기 하이라이트 유튜브 링크를 담습니다.
const matchHighlights = {
  round1: 'https://www.youtube.com/watch?v=A5dGnTMTpw0',
  round2: 'https://www.youtube.com/watch?v=p5z6sYwoxJc&t=359s',
  round3: 'https://youtu.be/goM_m99MrDQ?si=coMD5rW48IhFYh0q'
};

// ===== 구단 유튜브 코너 - 채널 최신 영상 자동 연동 설정 =====
// "구단 유튜브 코너"는 더 이상 matchHighlights(라운드별 하이라이트)를 쓰지 않고,
// 아래 channelId 채널의 "최신 업로드 영상"을 YouTube Data API v3로 직접 가져와 보여줍니다.
//
// apiKey를 발급받는 방법 (무료):
// 1) https://console.cloud.google.com/ 접속 → 새 프로젝트 생성(또는 기존 프로젝트 선택)
// 2) 왼쪽 메뉴에서 "API 및 서비스" → "라이브러리" → "YouTube Data API v3" 검색 후 "사용 설정"
// 3) "API 및 서비스" → "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "API 키" 선택
// 4) 생성된 키를 아래 apiKey 자리에 붙여넣기
//    (선택) 키를 만든 뒤 "키 제한사항"에서 "API 제한"을 YouTube Data API v3로만 제한해두면 더 안전합니다.
//
// uploadsPlaylistId는 채널ID의 "UC"를 "UU"로 바꾼 값입니다(유튜브의 일반적인 규칙).
// 이미 계산해서 넣어뒀으니 따로 수정할 필요 없습니다.
const teamYoutubeChannel = {
  channelId: 'UC5JtIP2gExbPDMbNMFr3aHA', // 창박골 Changbakgol (@changbakgol)
  uploadsPlaylistId: 'UU5JtIP2gExbPDMbNMFr3aHA',
  apiKey: 'AIzaSyCKU3vHbw4uw3cCdhreXi4AnJU5htEauMQ', // 여기에 위에서 발급받은 YouTube Data API v3 키를 넣어주세요
  maxResults: 15
};

// ===== 치주물루 라운드별 상세 (포메이션/득점/교체/최근 상대전적) =====
// starters: 포지션별 선발. goals: 득점 시간(분) 배열. outMin: 교체 아웃 시간('HT'=하프타임)
// subsIn: 교체 투입 선수. pos로 어느 포지션에 들어왔는지 표시하며, 같은 pos를 가진 항목을
//   배열에 나온 순서대로 이어 붙여 이중/삼중 교체 체인을 구성합니다. 자신도 이후 교체되어
//   나갔다면 outMin을 추가로 적어주세요(다음 pos 일치 항목이 그 자리를 이어받습니다).
// subsUnused: 미출전 명단(등번호)
// recentHistory / historySummary: "최근 상대 전적" 표. 이제는 안 채워도 됩니다!
//   비워두면(필드 자체를 안 써도) 상세보기가 자동으로 다음을 합쳐서 채워줍니다:
//   [이번 경기 결과(roundsData/scheduledRounds에 채운 스코어에서 자동 계산)]
//   + [upcomingMatchHistory[해당 roundKey].recentHistory에 미리 적어둔 과거 시즌 상대전적(있다면)]
//   즉, 8주차부터는 그냥 아래처럼 formation/opponentKo/result/starters/subs만 채우면 끝입니다.
//   (과거처럼 특정 라운드에서 문구를 직접 다르게 쓰고 싶을 때만 recentHistory를 수동으로 적으면
//   그 값이 우선 사용됩니다.)
const matchLineups = {
  round1: {
    formation: "4-2-3-1",
    opponentKo: "치하메 올스타즈 FC",
    result: "3 : 1 승",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파" },
      { pos: "LW", number: 49, nameKo: "쿰부카니 바냐", outMin: "후반" },
      { pos: "CAM", number: 7, nameKo: "디킨스", goals: ["8'", "78'"], outMin: "후반" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 77, nameKo: "군도", captain: true },
      { pos: "RCM", number: 98, nameKo: "스티브", outMin: "후반" },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트", outMin: "후반" },
      { pos: "RB", number: 2, nameKo: "로날드", outMin: "후반" },
      { pos: "GK", number: 88, nameKo: "티나시" }
    ],
    subsIn: [
      { number: 11, nameKo: "해리", pos: "LW", inMin: "후반", goals: ["76'"] },
      { number: 80, nameKo: "스쿠카", pos: "CAM", inMin: "후반" },
      { number: 10, nameKo: "찰스", pos: "RCM", inMin: "후반" },
      { number: 15, nameKo: "만토", pos: "RCB", inMin: "후반" },
      { number: 3, nameKo: "음롱골라", pos: "RB", inMin: "후반" }
    ],
    subsUnused: [9, 20, 66, 90],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 1주차", score: "치주물루 3 : 1 치하메", result: "치주물루 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 23주차", score: "치하메 2 : 1 치주물루", result: "치하메 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 8주차", score: "치주물루 2 : 0 치하메", result: "치주물루 승" }
    ],
    historySummary: "최근 3경기 전적 2승 0무 1패로 우세"
  },
  round2: {
    formation: "4-2-3-1",
    opponentKo: "마푸 스타즈 FC",
    result: "0 : 1 패",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파" },
      { pos: "LW", number: 11, nameKo: "해리" },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민", outMin: "후반" },
      { pos: "LCM", number: 77, nameKo: "군도", outMin: "전반" },
      { pos: "RCM", number: 10, nameKo: "찰스", outMin: "후반" },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "RB", number: 25, nameKo: "모버트" },
      { pos: "GK", number: 88, nameKo: "티나시", outMin: "전반", injury: true }
    ],
    subsIn: [
      { number: 49, nameKo: "바냐", pos: "RW", inMin: "후반" },
      { number: 98, nameKo: "스티브", pos: "LCM", inMin: "전반" },
      { number: 80, nameKo: "스쿠카", pos: "RCM", inMin: "후반" },
      { number: 90, nameKo: "마야미코", pos: "GK", inMin: "전반" }
    ],
    subsUnused: [15, 20, 66],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 2주차", score: "마푸 1 : 0 치주물루", result: "마푸 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 27주차", score: "심보웨 4 : 2 치주물루", result: "심보웨 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 13주차", score: "치주물루 2 : 1 심보웨", result: "치주물루 승" }
    ],
    historySummary: "최근 3경기 전적 1승 0무 2패로 열세"
  },
  round3: {
    formation: "4-2-3-1",
    opponentKo: "라이플리 FC",
    result: "1 : 0 승",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파", goals: ["-"] },
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
      { comp: "26/27 시즌 NRFA 리그 원 3주차", score: "치주물루 1 : 0 라이플리", result: "치주물루 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 28주차", score: "치주물루 2 : 0 라이플리", result: "치주물루 승" },
      { comp: "2025-26 시즌 MNRF 심소 프리미어 리그 1주차", score: "라이플리 5 : 1 치주물루", result: "라이플리 승" }
    ],
    historySummary: "최근 3경기 전적 2승 0무 1패로 우세"
  },
  round4: {
    formation: "4-2-3-1",
    opponentKo: "루베 마스터즈 FC",
    result: "0 : 0 무",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파" },
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
      { number: 10, nameKo: "찰스", pos: "LW", inMin: "후반" },
      { number: 77, nameKo: "군도", pos: "RB", inMin: "후반" }
    ],
    subsUnused: [9, 20, 49, 66, 88],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 4주차", score: "루베 0 : 0 치주물루", result: "무승부" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 27주차", score: "치주물루 4 : 1 루베", result: "치주물루 승" },
      { comp: "2025-26 시즌 카스텔컵 지역 단계 3라운드", score: "치주물루 1 : 1 루베 (PSO 4:2)", result: "무승부" },
      { comp: "2025-26 시즌 MNRF 심소 프리미어 리그 2주차", score: "루베 3 : 2 치주물루", result: "루베 승" }
    ],
    historySummary: "최근 4경기 전적 1승 2무 1패로 백중세"
  },
  round5: {
    formation: "4-2-3-1",
    opponentKo: "에크웬데니 FC",
    result: "2 : 0 승",
    starters: [
      { pos: "ST", number: 9, nameKo: "음칸다위레", outMin: "전반" },
      { pos: "LW", number: 49, nameKo: "쿰부카니", goals: ["-"] },
      { pos: "CAM", number: 7, nameKo: "디킨스" },
      { pos: "RW", number: 6, nameKo: "벤자민", outMin: "후반" },
      { pos: "LCM", number: 98, nameKo: "스티브", goals: ["-"] },
      { pos: "RCM", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "LB", number: 20, nameKo: "프란시스", outMin: "전반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트" },
      { pos: "RB", number: 77, nameKo: "군도", outMin: "후반" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [
      { number: 22, nameKo: "티모시 카타파", pos: "ST", inMin: "전반" },
      { number: 10, nameKo: "찰스", pos: "RW", inMin: "후반" },
      { number: 5, nameKo: "라반", pos: "LB", inMin: "전반" },
      { number: 8, nameKo: "엑스퍼트", pos: "RB", inMin: "후반" }
    ],
    subsUnused: [11, 66, 80, 88],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 5주차", score: "치주물루 2 : 0 에크웬데니", result: "치주물루 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 28주차", score: "치주물루 5 : 1 에크웬데니", result: "치주물루 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 11주차", score: "에크웬데니 2 : 2 치주물루", result: "무승부" }
    ],
    historySummary: "최근 3경기 전적 2승 1무 0패로 우세"
  },
  round6: {
    formation: "4-2-3-1",
    opponentKo: "에우티니 베테랑스 FC",
    result: "0 : 1 패",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파" },
      { pos: "LW", number: 49, nameKo: "쿰부카니", outMin: "후반" },
      { pos: "CAM", number: 10, nameKo: "찰스", outMin: "전반" },
      { pos: "RW", number: 6, nameKo: "벤자민" },
      { pos: "LCM", number: 98, nameKo: "스티브", outMin: "후반" },
      { pos: "RCM", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "LB", number: 5, nameKo: "라반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 25, nameKo: "모버트" },
      { pos: "RB", number: 2, nameKo: "로날드" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [
      { number: 11, nameKo: "해리", pos: "LW", inMin: "후반", outMin: "후반" },
      { number: 7, nameKo: "디킨스", pos: "CAM", inMin: "전반" },
      { number: 8, nameKo: "엑스퍼트", pos: "LCM", inMin: "후반" },
      { number: 9, nameKo: "임마누엘", pos: "LW", inMin: "후반" }
    ],
    subsUnused: [66, 80, 88],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 6주차", score: "에우티니 1 : 0 치주물루", result: "에우티니 승" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 24주차", score: "치주물루 2 : 0 에우티니", result: "치주물루 승(몰수승)" },
      { comp: "2025-26 시즌 MNRF 심소 프리미어 리그 6주차", score: "에우티니 1 : 0 치주물루", result: "에우티니 승" }
    ],
    historySummary: "최근 3경기 전적 1승 0무 2패로 열세"
  },
  round7: {
    formation: "4-2-3-1",
    opponentKo: "젠다 유나이티드 FC",
    result: "4 : 0 승",
    starters: [
      { pos: "ST", number: 22, nameKo: "티모시 카타파", goals: ["-"], outMin: "후반" },
      { pos: "LW", number: 49, nameKo: "쿰부카니", outMin: "후반" },
      { pos: "CAM", number: 7, nameKo: "디킨스", goals: ["-"] },
      { pos: "RW", number: 6, nameKo: "벤자민", goals: ["-"], outMin: "전반" },
      { pos: "LCM", number: 98, nameKo: "스티브", goals: ["-"], outMin: "후반" },
      { pos: "RCM", number: 99, nameKo: "패트릭" },
      { pos: "LB", number: 5, nameKo: "라반", outMin: "후반" },
      { pos: "LCB", number: 13, nameKo: "조셉" },
      { pos: "RCB", number: 3, nameKo: "음롱골라", captain: true },
      { pos: "RB", number: 25, nameKo: "모버트" },
      { pos: "GK", number: 90, nameKo: "마야미코" }
    ],
    subsIn: [
      { number: 10, nameKo: "찰스", pos: "RW", inMin: "전반" },
      { number: 11, nameKo: "해리", pos: "LW", inMin: "후반" },
      { number: 66, nameKo: "조던", pos: "LB", inMin: "후반" },
      { number: 8, nameKo: "엑스퍼트", pos: "LCM", inMin: "후반" },
      { number: 80, nameKo: "스쿠카", pos: "ST", inMin: "후반" }
    ],
    subsUnused: [9, 20, 88],
    recentHistory: [
      { comp: "26/27 시즌 NRFA 리그 원 7주차", score: "치주물루 4 : 0 젠다", result: "치주물루 승" }
    ],
    historySummary: "최근 1경기 전적 1승 0무 0패로 우세"
  }
};

const squadData = [
  { number: 2, position: "DF", nameKo: "로날드 은달라마", nameEn: "Ronald Ndalama", photoSrc: "no2.png" },
  { number: 3, position: "DF", nameKo: "알란 음롱골라", nameEn: "Allan Mlongola", isViceCaptain: true, photoSrc: "no3.png" },
  { number: 5, position: "DF", nameKo: "라반 롱웨", nameEn: "Laban Longwe", photoSrc: "no5.png" },
  { number: 6, position: "MF", nameKo: "벤자민 니렌다", nameEn: "Benjamin Nyirenda", photoSrc: "no6.png" },
  { number: 7, position: "MF", nameKo: "디킨스 니렌다", nameEn: "Dickies Nyirenda", photoSrc: "no7.png" },
  { number: 8, position: "MF", nameKo: "엑스퍼트 카망가", nameEn: "Expert Kamanga", photoSrc: "no8.png" },
  { number: 9, position: "FW", nameKo: "임마누엘 음칸다위레", nameEn: "Emmanuel Mkandawire", photoSrc: "no9.png" },
  { number: 10, position: "MF", nameKo: "찰스 데야", nameEn: "Charles Deya", photoSrc: "no10.png" },
  { number: 11, position: "FW", nameKo: "해리 바튼", nameEn: "Harry Barton", photoSrc: "no11.png" },
  { number: 13, position: "DF", nameKo: "조셉 반다", nameEn: "Joseph Banda", photoSrc: "no13.png" },
  { number: 15, position: "DF", nameKo: "만토 카망가", nameEn: "Mantoh Kamanga", isCaptain: true, photoSrc: "no15.png" },
  { number: 20, position: "DF", nameKo: "프란시스 피리", nameEn: "Francis Phiri", photoSrc: "no20.png" },
  { number: 22, position: "FW", nameKo: "티모시 카타파", nameEn: "Timothy Katapa", photoSrc: "no22.png" },
  { number: 25, position: "DF", nameKo: "모버트 카타파", nameEn: "Movert Katapa", photoSrc: "no25.png" },
  { number: 49, position: "FW", nameKo: "쿰부카니 바냐", nameEn: "Kumbukani Banya", photoSrc: "no49.png" },
  { number: 66, position: "DF", nameKo: "조던 칠와", nameEn: "Jordon Chirwa", photoSrc: "no66.png" },
  { number: 77, position: "DF", nameKo: "제임스 귄도안", nameEn: "James Gundogan", photoSrc: "no77.png" },
  { number: 80, position: "FW", nameKo: "다니엘 스쿠카", nameEn: "Daniel Scuka", photoSrc: "no80.png" },
  { number: 88, position: "GK", nameKo: "티나시 카삼발라", nameEn: "Tinashe Kasambala", photoSrc: "no88.png" },
  { number: 90, position: "GK", nameKo: "마야미코 치우시와", nameEn: "Mayamiko Chiusiwa", photoSrc: "no90.png" },
  { number: 98, position: "MF", nameKo: "스티브 피리", nameEn: "Steve Phiri", photoSrc: "no98.png" },
  { number: 99, position: "MF", nameKo: "패트릭 지야", nameEn: "Patrick Jiya", photoSrc: "no99.png" }
];

// ===== 스태프 명단 =====
const staffData = [
  { roleKo: "구단주", roleEn: "Chairman", people: [
    { nameKo: "이동훈", nameEn: "Lee Dong-hoon" }
  ]},
  { roleKo: "감독", roleEn: "Head Coach", people: [
    { nameKo: "맥팔른 마푸타", nameEn: "Mcfallen Mafuta" }
  ]},
  { roleKo: "어시스턴트 코치", roleEn: "Assistant Coach", people: [
    { nameKo: "맥슨 툰두", nameEn: "Mackson Thundu" }
  ]},
  { roleKo: "골키퍼 코치", roleEn: "Goalkeeper Coach", people: [
    { nameKo: "로버트 음지지망가", nameEn: "Robert Mzizimanga" }
  ]},
  { roleKo: "팀 닥터", roleEn: "Team Doctor", people: [
    { nameKo: "로버트 음지지망가", nameEn: "Robert Mzizimanga" },
    { nameKo: "베네딕토 칠와", nameEn: "Benedicto Chirwa" }
  ]},
  { roleKo: "키트마스터", roleEn: "Kit Master", people: [
    { nameKo: "해피 칠와", nameEn: "Happy Chirwa" },
    { nameKo: "레오나드 롱웨", nameEn: "Leonard Longwe" }
  ]},
  { roleKo: "미디어", roleEn: "Media", people: [
    { nameKo: "모스터 은코마", nameEn: "" }
  ]}
];

// ===== 스폰서 정보 (메인 / 키트 / 일반) =====
const sponsorData = {
  main: [
    { name: "", logo: "./스폰서2.webp" }
  ],
  kit: [
    { name: "", logo: "./스폰서1.webp" }
  ],
  general: [
    { name: "", logo: "./스폰서3.png" },
    { name: "", logo: "./스폰서4.webp" },
    { name: "", logo: "./스폰서5.png" },
    { name: "", logo: "./스폰서6.png" }
  ]
};

// ===== 26/27 시즌 유니폼 이미지 =====
const kitData = {
  home:   "./2627홈.webp",
  away:   "./2627어웨이.webp",
  gkHome: "./2627GK홈.webp",
  gkAway: "./2627GK어웨이.jpg"
};

// ===== 팀 수상 정보 (맨 오브 더 매치 / 이달의 선수 / 이달의 골) =====
// motm: 라운드별 맨 오브 더 매치 수상자. 값은 squadData의 등번호(number) 배열 (공동 수상 가능)
// playerOfTheMonth: 'YYYY-MM' 형식의 월별 이달의 선수 수상자. 값은 squadData의 등번호(number)
// goalOfTheMonth: 'YYYY-MM' 형식의 월별 이달의 골 수상자. 값은 squadData의 등번호(number)
const teamAwards = {
  motm: {
    round1: [13, 7],
    round3: [22, 6],
    round5: [49],
    round7: [98]
  },
  playerOfTheMonth: {
    '2026-07': 90
  },
  goalOfTheMonth: {
    '2026-07': 7
  }
};

// ============================================================
// 스쿼드 선수별 통산 기록 (squadPlayerStats) 자동 계산
// ------------------------------------------------------------
// matchLineups(라운드별 선발/교체/득점 기록)와 teamAwards.motm을 훑어서
// 치주물루 선수 개개인의 출전수/선발/교체/득점/주장/MOTM 횟수를 계산합니다.
// 새 라운드가 matchLineups에 추가되면 이 함수가 자동으로 반영하므로
// 이 파일을 따로 수정할 필요가 없습니다.
// 반환값: { [등번호]: { appearances, starts, subApps, goals, captainCount,
//           motmCount, unusedCount, history: [ {roundKey, weekNum, opponentKo,
//           result, wasStarter, goals, isCaptain, wasMotm}, ... ] } }
// ============================================================
function computeSquadPlayerStats() {
  const stats = {};

  function ensure(number) {
    if (!stats[number]) {
      stats[number] = {
        number,
        appearances: 0,
        starts: 0,
        subApps: 0,
        goals: 0,
        captainCount: 0,
        motmCount: 0,
        unusedCount: 0,
        history: []
      };
    }
    return stats[number];
  }

  const roundKeysSorted = Object.keys(matchLineups).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  roundKeysSorted.forEach((roundKey, idx) => {
    const weekNum = idx + 1;
    const lineup = matchLineups[roundKey];
    if (!lineup) return;

    const motmList = (teamAwards.motm && teamAwards.motm[roundKey]) || [];

    (lineup.starters || []).forEach(p => {
      const s = ensure(p.number);
      s.appearances++;
      s.starts++;
      const goalCount = (p.goals || []).length;
      s.goals += goalCount;
      if (p.captain) s.captainCount++;
      const wasMotm = motmList.includes(p.number);
      if (wasMotm) s.motmCount++;
      s.history.push({
        roundKey, weekNum,
        opponentKo: lineup.opponentKo, result: lineup.result,
        wasStarter: true, goals: goalCount,
        isCaptain: !!p.captain, wasMotm
      });
    });

    (lineup.subsIn || []).forEach(p => {
      const s = ensure(p.number);
      s.appearances++;
      s.subApps++;
      const goalCount = (p.goals || []).length;
      s.goals += goalCount;
      const wasMotm = motmList.includes(p.number);
      if (wasMotm) s.motmCount++;
      s.history.push({
        roundKey, weekNum,
        opponentKo: lineup.opponentKo, result: lineup.result,
        wasStarter: false, goals: goalCount,
        isCaptain: false, wasMotm
      });
    });

    (lineup.subsUnused || []).forEach(number => {
      const s = ensure(number);
      s.unusedCount++;
    });
  });

  return stats;
}

// 스쿼드 선수별 통산 기록 데이터 (matchLineups/teamAwards 로부터 자동 계산됨)
const squadPlayerStats = computeSquadPlayerStats();

// ============================================================
// 핵심 선수 출전/결장 영향도 (With & Without Stats)
// ------------------------------------------------------------
// matchLineups[].result("3 : 1 승" 형식, 항상 치주물루 스코어가 앞에 옴)를
// 라운드별로 파싱하고, 해당 라운드에 특정 선수가 "선발로 뛰었는지"
// "아예 결장(교체 출전조차 없이 미출전)했는지"를 나눠서 팀 성적을 비교합니다.
// - "선발 출전": starters 배열에 포함된 라운드
// - "결장(미출전)": starters에도 subsIn에도 없는 라운드 (subsUnused 포함,
//   즉 그 경기에서 단 1분도 뛰지 않은 라운드)
// - 교체로만 출전한 라운드는 두 그룹 어디에도 넣지 않고 비교에서 제외합니다
//   (선발 vs 완전 결장을 비교하는 게 목적이므로).
// ============================================================
function parseLineupResult(resultText) {
  const m = String(resultText || '').trim().match(/^(\d+)\s*:\s*(\d+)\s*(승|무|패)$/);
  if (!m) return null;
  const outcome = m[3] === '승' ? 'W' : (m[3] === '무' ? 'D' : 'L');
  return { ownGoals: parseInt(m[1], 10), oppGoals: parseInt(m[2], 10), outcome };
}

function emptyImpactGroup() {
  return { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function finalizeImpactGroup(g) {
  const pts = g.wins * 3 + g.draws;
  return Object.assign({}, g, {
    winRate: g.matches ? Math.round((g.wins / g.matches) * 100) : 0,
    ptsPerGame: g.matches ? +(pts / g.matches).toFixed(2) : 0,
    goalsForAvg: g.matches ? +(g.goalsFor / g.matches).toFixed(1) : 0,
    goalsAgainstAvg: g.matches ? +(g.goalsAgainst / g.matches).toFixed(1) : 0
  });
}

function computeKeyPlayerImpact(number) {
  const withG = emptyImpactGroup();
  const withoutG = emptyImpactGroup();

  const roundKeysSorted = Object.keys(matchLineups).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  roundKeysSorted.forEach(roundKey => {
    const lineup = matchLineups[roundKey];
    if (!lineup) return;
    const parsed = parseLineupResult(lineup.result);
    if (!parsed) return;

    const isStarter = (lineup.starters || []).some(p => p.number === number);
    const isSubIn = (lineup.subsIn || []).some(p => p.number === number);

    let target = null;
    if (isStarter) target = withG;
    else if (!isSubIn) target = withoutG; // subsUnused 포함, 완전 미출전

    if (!target) return; // 교체로만 출전한 라운드는 비교에서 제외

    target.matches++;
    target.goalsFor += parsed.ownGoals;
    target.goalsAgainst += parsed.oppGoals;
    if (parsed.outcome === 'W') target.wins++;
    else if (parsed.outcome === 'D') target.draws++;
    else target.losses++;
  });

  return { with: finalizeImpactGroup(withG), without: finalizeImpactGroup(withoutG) };
}

// 선발/결장 표본이 둘 다 최소 2경기 이상 쌓여 비교가 의미 있는 선수만 후보로 추립니다.
// (표본이 너무 적으면 제외; 그런 선수가 하나도 없으면 기준을 1경기로 완화합니다.)
function computeKeyPlayerImpactCandidates() {
  function buildList(minEach) {
    return squadData
      .map(p => ({ player: p, impact: computeKeyPlayerImpact(p.number) }))
      .filter(function(o) { return o.impact.with.matches >= minEach && o.impact.without.matches >= minEach; })
      .map(function(o) {
        return {
          number: o.player.number, nameKo: o.player.nameKo, nameEn: o.player.nameEn,
          position: o.player.position, photoSrc: o.player.photoSrc, impact: o.impact,
          // "영향력" = 선발 출전 시와 결장 시의 경기당 승점 차이. 클수록 이 선수가
          // 뛸 때 팀 성적이 더 크게 좋아진다는 뜻이라, 영향력이 큰 선수부터 정렬합니다.
          impactScore: +(o.impact.with.ptsPerGame - o.impact.without.ptsPerGame).toFixed(2)
        };
      })
      .sort(function(a, b) {
        return b.impactScore - a.impactScore ||
          (Math.min(b.impact.with.matches, b.impact.without.matches) -
           Math.min(a.impact.with.matches, a.impact.without.matches));
      });
  }
  const list = buildList(2);
  return list.length ? list : buildList(1);
}

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
  ],
  // 6주차는 전체 라운드가 종료되어 roundsData.round6로 옮겨졌습니다.
  // (이 매치 요약 텍스트는 결과 페이지 표시용으로 그대로 유지합니다.)
  round6: [
    {
      match: "음벨와 0 : 칠룸바 0",
      scorersHome: "없음",
      scorersAway: "없음"
    },
    {
      match: "루비리 3 : 치바비 0",
      scorersHome: "TYSON SOKO, KINGSLEY MKANDAWIRE, ABRAHAM MVULA",
      scorersAway: "없음"
    },
    {
      match: "치폴로폴로 2 : 비전 1",
      scorersHome: "CLEMENT MUNTHALI, RODRICK KASUDZA",
      scorersAway: "GEORGE MASEWO"
    },
    {
      match: "젠다 1 : 친테체 1",
      scorersHome: "CHISOMO MYEGHA",
      scorersAway: "TEMWA NDHLOVU"
    },
    {
      match: "에우티니 1 : 치주물루 0",
      scorersHome: "JOSEPH BANDA",
      scorersAway: "없음"
    },
    {
      match: "에크웬데니 1 : 치하메 1",
      scorersHome: "MPHATSO KUMWENDA",
      scorersAway: "JAMES ZONGA"
    },
    {
      match: "루베 2 : 마푸 1",
      scorersHome: "CHARLES KAMANGA, MAPALO GUMBO",
      scorersAway: "WANANGWA GAMA"
    }
  ],
  // 7주차는 전체 라운드가 종료되어 roundsData.round7로 옮겨졌으므로 matchDetails.round7을
  // 아래에 새로 추가했습니다. 마푸 vs 에크웬데니는 연기(postponed)라 스코어가 없어
  // matchDetails에는 넣지 않습니다 — 나중에 결과가 나오면 이 목록 맨 뒤에 추가해주세요.
  round7: [
    {
      match: "치주물루 4 : 젠다 0",
      scorersHome: "STEVEN PHIRI, DICKIES NYIRENDA, BENJAMIN NYIRENDA, TIMOTHY KATAPA",
      scorersAway: "없음"
    },
    {
      match: "라이플리 3 : 루베 0",
      scorersHome: "LIMBANI KAMANGA (2골), DAVIE NGOMA",
      scorersAway: "없음"
    },
    {
      match: "치하메 3 : 에우티니 1",
      scorersHome: "ROBIN CHIOKO, ACKIM GOMIRE, BABA NKHOMA",
      scorersAway: "DANIEL CHISOKWE"
    },
    {
      match: "친테체 1 : 치폴로폴로 2",
      scorersHome: "TEMWA NDHLOVU",
      scorersAway: "KING NYASULU, MIKE LUHANGA"
    },
    {
      match: "비전 2 : 루비리 0",
      scorersHome: "GIVEN MWANDIRA, JOMO PHIRI",
      scorersAway: "없음"
    },
    {
      match: "치바비 2 : 음벨와 1",
      scorersHome: "KINGSLEY MVULA, DANIEL SIWALE",
      scorersAway: "SHAIBU JALAH"
    }
  ]
};

// ===== 아직 안 치른(예정된) 경기의 사전 상대전적 메모 =====
// matchLineups[].recentHistory는 라운드가 끝난 뒤(포메이션/득점 등과 함께) 채우는 값이라
// 예정된 라운드에는 아직 없습니다. 다음 경기 프리뷰에서 H2H를 보여주려면 이렇게
// roundKey(scheduledRounds 기준)를 키로 미리 적어두면 됩니다. 라운드가 실제로 끝나면
// 이 항목은 지우고 matchLineups[roundKey].recentHistory로 옮겨주세요.
const upcomingMatchHistory = {
  round8: {
    recentHistory: [
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 29주차", score: "치주물루 2 : 0 치폴로폴로", result: "치주물루 승(몰수승)" },
      { comp: "2025-26 시즌 음벨와 노던 리전 풋볼 리그 12주차", score: "치폴로폴로 4 : 4 치주물루", result: "무승부" }
    ],
    historySummary: "최근 2경기 전적 2전 1승 1무 0패로 우세"
  }
};

// ===== 예정된(아직 안 치른) 라운드 일정 =====
// 결과가 확정되면 이 라운드를 roundsData로 옮기고 스코어를 채워주세요.
const scheduledRounds = {
  round8: [
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", kickoffDate: "2026-08-29", kickoffTime: "14:30" },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", kickoffDate: "2026-08-29", kickoffTime: "14:30" },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", kickoffDate: "2026-08-29", kickoffTime: "14:30" },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", kickoffDate: "2026-08-30", kickoffTime: "14:30" },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", kickoffDate: "2026-08-30", kickoffTime: "14:30" },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", kickoffDate: "2026-08-30", kickoffTime: "14:30" },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", kickoffDate: "2026-08-30", kickoffTime: "14:30" },
    { byeKo: "루베 마스터즈 FC", byeEn: "Lube Masters FC" }
  ],
  round9: [
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "루비리 FC", awayEn: "Luviri FC", kickoffDate: "2026-09-04", kickoffTime: "15:00" },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", kickoffDate: "2026-09-05", kickoffTime: "14:30" },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", kickoffDate: "2026-09-05", kickoffTime: "14:30" },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", kickoffDate: "2026-09-06", kickoffTime: "14:30" },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", kickoffDate: "2026-09-06", kickoffTime: "14:30" },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", kickoffDate: "2026-09-06", kickoffTime: "14:30" },
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", kickoffDate: "2026-09-06", kickoffTime: "14:30" },
    { byeKo: "치바비 리얼 스타스 FC", byeEn: "Chibavi Real Stars FC" }
  ],
  round10: [
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", kickoffDate: "2026-09-12", kickoffTime: "14:30" },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", kickoffDate: "2026-09-12", kickoffTime: "14:30" },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", kickoffDate: "2026-09-12", kickoffTime: "14:30" },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", kickoffDate: "2026-09-13", kickoffTime: "14:30" },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", kickoffDate: "2026-09-13", kickoffTime: "14:30" },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", kickoffDate: "2026-09-13", kickoffTime: "14:30" },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", kickoffDate: "2026-09-13", kickoffTime: "14:30" },
    { byeKo: "에크웬데니 FC", byeEn: "Ekwendeni FC" }
  ],
  round11: [
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", kickoffDate: "2026-09-18", kickoffTime: "15:00" },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", kickoffDate: "2026-09-19", kickoffTime: "14:30" },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", kickoffDate: "2026-09-19", kickoffTime: "14:30" },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", kickoffDate: "2026-09-19", kickoffTime: "14:30" },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "루비리 FC", awayEn: "Luviri FC", kickoffDate: "2026-09-20", kickoffTime: "14:30" },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", kickoffDate: "2026-09-20", kickoffTime: "14:30" },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", kickoffDate: "2026-09-20", kickoffTime: "14:30" },
    { byeKo: "비전 S 아카데미", byeEn: "Vision S Academy" }
  ],
  round12: [
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", kickoffDate: "2026-09-26", kickoffTime: "14:30" },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", kickoffDate: "2026-09-26", kickoffTime: "14:30" },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", kickoffDate: "2026-09-26", kickoffTime: "14:30" },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", kickoffDate: "2026-09-27", kickoffTime: "14:30" },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", kickoffDate: "2026-09-27", kickoffTime: "14:30" },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", kickoffDate: "2026-09-27", kickoffTime: "14:30" },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", kickoffDate: "2026-09-27", kickoffTime: "14:30" },
    { byeKo: "에우티니 베테랑스 FC", byeEn: "Euthini Veterans FC" }
  ],
  round13: [
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", kickoffDate: "2026-10-02", kickoffTime: "15:00" },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", kickoffDate: "2026-10-03", kickoffTime: "14:30" },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "루비리 FC", awayEn: "Luviri FC", kickoffDate: "2026-10-03", kickoffTime: "14:30" },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", kickoffDate: "2026-10-03", kickoffTime: "14:30" },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", kickoffDate: "2026-10-04", kickoffTime: "14:30" },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", kickoffDate: "2026-10-04", kickoffTime: "14:30" },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", kickoffDate: "2026-10-04", kickoffTime: "14:30" },
    { byeKo: "친테체 유나이티드 FC", byeEn: "Chintheche United FC" }
  ],
  round14: [
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", kickoffDate: "2026-10-10", kickoffTime: "14:30" },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", kickoffDate: "2026-10-10", kickoffTime: "14:30" },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", kickoffDate: "2026-10-10", kickoffTime: "14:30" },
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", kickoffDate: "2026-10-11", kickoffTime: "14:30" },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", kickoffDate: "2026-10-11", kickoffTime: "14:30" },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", kickoffDate: "2026-10-11", kickoffTime: "14:30" },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", kickoffDate: "2026-10-11", kickoffTime: "14:30" },
    { byeKo: "젠다 유나이티드 FC", byeEn: "Jenda United FC" }
  ],
  round15: [
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", kickoffDate: "2026-10-17", kickoffTime: "14:30" },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "루비리 FC", awayEn: "Luviri FC", kickoffDate: "2026-10-17", kickoffTime: "14:30" },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", kickoffDate: "2026-10-17", kickoffTime: "14:30" },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", kickoffDate: "2026-10-18", kickoffTime: "14:30" },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", kickoffDate: "2026-10-18", kickoffTime: "14:30" },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", kickoffDate: "2026-10-18", kickoffTime: "14:30" },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", kickoffDate: "2026-10-18", kickoffTime: "14:30" },
    { byeKo: "치주물루 유나이티드 FC", byeEn: "Chizumulu United FC" }
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
    { byeKo: "치폴로폴로 보이즈 FC", byeEn: "Chipolopolo Boys FC" }
  ],
  round2: [
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", homeScore: 1, awayScore: 2 },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", homeScore: 0, awayScore: 0 },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "루비리 FC", awayEn: "Luviri FC", homeScore: 3, awayScore: 1 },
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
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", homeScore: 1, awayScore: 1 },
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", homeScore: 1, awayScore: 0 },
    { byeKo: "루비리 FC", byeEn: "Luviri FC" }
  ],
  round4: [
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", homeScore: 0, awayScore: 0 },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", homeScore: 7, awayScore: 0 },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", homeScore: 1, awayScore: 0 },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", homeScore: 1, awayScore: 0 },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", homeScore: 0, awayScore: 0 },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", homeScore: 2, awayScore: 1 },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", homeScore: 4, awayScore: 2 },
    { byeKo: "마푸 스타즈 FC", byeEn: "Mafu Stars FC" }
  ],
  round5: [
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "라이플리 FC", awayEn: "Raiply FC", homeScore: 1, awayScore: 1 },
    { homeKo: "칠룸바 배럭스 FC", homeEn: "Chilumba Barracks FC", awayKo: "루비리 FC", awayEn: "Luviri FC", homeScore: 1, awayScore: 0 },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", homeScore: 2, awayScore: 0 },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", homeScore: 4, awayScore: 1 },
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", homeScore: 2, awayScore: 4 },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", homeScore: 4, awayScore: 2 },
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", homeScore: 2, awayScore: 0 },
    { byeKo: "음벨와 워리어스 FC", byeEn: "M'mbelwa Warriors FC" }
  ],
  round6: [
    { homeKo: "음벨와 워리어스 FC", homeEn: "M'mbelwa Warriors FC", awayKo: "칠룸바 배럭스 FC", awayEn: "Chilumba Barracks FC", homeScore: 0, awayScore: 0 },
    { homeKo: "루비리 FC", homeEn: "Luviri FC", awayKo: "치바비 리얼 스타스 FC", awayEn: "Chibavi Real Stars FC", homeScore: 3, awayScore: 0 },
    { homeKo: "치폴로폴로 보이즈 FC", homeEn: "Chipolopolo Boys FC", awayKo: "비전 S 아카데미", awayEn: "Vision S Academy", homeScore: 2, awayScore: 1 },
    { homeKo: "젠다 유나이티드 FC", homeEn: "Jenda United FC", awayKo: "친테체 유나이티드 FC", awayEn: "Chintheche United FC", homeScore: 1, awayScore: 1 },
    { homeKo: "에우티니 베테랑스 FC", homeEn: "Euthini Veterans FC", awayKo: "치주물루 유나이티드 FC", awayEn: "Chizumulu United FC", homeScore: 1, awayScore: 0 },
    { homeKo: "에크웬데니 FC", homeEn: "Ekwendeni FC", awayKo: "치하메 올스타즈 FC", awayEn: "Chihame All Stars FC", homeScore: 1, awayScore: 1 },
    { homeKo: "루베 마스터즈 FC", homeEn: "Lube Masters FC", awayKo: "마푸 스타즈 FC", awayEn: "Mafu Stars FC", homeScore: 2, awayScore: 1 },
    { byeKo: "라이플리 FC", byeEn: "Raiply FC" }
  ],
  // 7주차는 전체 라운드가 종료되어 roundsData.round7로 옮겨졌습니다.
  // 단, 마푸 vs 에크웬데니 경기는 연기(postponed)되어 스코어가 아직 없습니다.
  // 이렇게 라운드는 끝났지만 그 안에 연기된 경기가 남아있는 경우, 그 경기는
  // homeScore/awayScore 없이 postponed: true만 넣어두면 됩니다 — 라운드 결과 화면에는
  // "예정 경기(연기)" 카드로, 연기된 경기 모아보기에는 계속 표시되고, 스코어가
  // 채워지기 전까지는 순위/기록 집계에서 자동으로 제외됩니다.
  round7: [
    { homeKo: "치주물루 유나이티드 FC", homeEn: "Chizumulu United FC", awayKo: "젠다 유나이티드 FC", awayEn: "Jenda United FC", kickoffDate: "2026-08-21", kickoffTime: "15:00", homeScore: 4, awayScore: 0, scorersHome: "STEVEN PHIRI, DICKIES NYIRENDA, BENJAMIN NYIRENDA, TIMOTHY KATAPA", scorersAway: "없음" },
    { homeKo: "라이플리 FC", homeEn: "Raiply FC", awayKo: "루베 마스터즈 FC", awayEn: "Lube Masters FC", kickoffDate: "2026-08-27", kickoffTime: "14:30", homeScore: 3, awayScore: 0, scorersHome: "LIMBANI KAMANGA (2골), DAVIE NGOMA", scorersAway: "없음" },
    { homeKo: "마푸 스타즈 FC", homeEn: "Mafu Stars FC", awayKo: "에크웬데니 FC", awayEn: "Ekwendeni FC", postponed: true },
    { homeKo: "치하메 올스타즈 FC", homeEn: "Chihame All Stars FC", awayKo: "에우티니 베테랑스 FC", awayEn: "Euthini Veterans FC", kickoffDate: "2026-08-22", kickoffTime: "14:30", homeScore: 3, awayScore: 1, scorersHome: "ROBIN CHIOKO, ACKIM GOMIRE, BABA NKHOMA", scorersAway: "DANIEL CHISOKWE" },
    { homeKo: "친테체 유나이티드 FC", homeEn: "Chintheche United FC", awayKo: "치폴로폴로 보이즈 FC", awayEn: "Chipolopolo Boys FC", kickoffDate: "2026-08-23", kickoffTime: "14:30", homeScore: 1, awayScore: 2, scorersHome: "TEMWA NDHLOVU", scorersAway: "KING NYASULU, MIKE LUHANGA" },
    { homeKo: "비전 S 아카데미", homeEn: "Vision S Academy", awayKo: "루비리 FC", awayEn: "Luviri FC", kickoffDate: "2026-08-23", kickoffTime: "14:30", homeScore: 2, awayScore: 0, scorersHome: "GIVEN MWANDIRA, JOMO PHIRI", scorersAway: "없음" },
    { homeKo: "치바비 리얼 스타스 FC", homeEn: "Chibavi Real Stars FC", awayKo: "음벨와 워리어스 FC", awayEn: "M'mbelwa Warriors FC", kickoffDate: "2026-08-23", kickoffTime: "14:30", homeScore: 2, awayScore: 1, scorersHome: "KINGSLEY MVULA, DANIEL SIWALE", scorersAway: "SHAIBU JALAH" },
    { byeKo: "칠룸바 배럭스 FC", byeEn: "Chilumba Barracks FC" }
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

  const history = []; // [{ week, ranks: { nameEn: rank }, points: { nameEn: pts } }]

  function applyMatches(matches) {
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (!m.homeEn || !m.awayEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
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
  }

  function pushSnapshot(week) {
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
    const points = {};
    standings.forEach(s => { points[s.nameEn] = s.pts; });

    history.push({ week, ranks, points });
  }

  roundKeys.forEach((roundKey, idx) => {
    applyMatches(roundsData[roundKey]);
    pushSnapshot(idx + 1);
  });

  // 다음 라운드가 아직 완전히 끝나지 않아 scheduledRounds에 남아있어도,
  // 그 안에 스코어가 채워진 경기가 있으면(=일부만 먼저 끝난 경우) 그만큼 반영해서
  // 순위 변동 그래프에 그 주차를 미리 보여줍니다.
  const nextRoundKey = 'round' + (roundKeys.length + 1);
  const nextRoundMatches = (scheduledRounds && scheduledRounds[nextRoundKey]) || [];
  const hasPartialResult = nextRoundMatches.some(m =>
    !m.byeKo && !m.byeEn && typeof m.homeScore === 'number' && typeof m.awayScore === 'number'
  );
  if (hasPartialResult) {
    applyMatches(nextRoundMatches);
    pushSnapshot(roundKeys.length + 1);
  }

  return history;
}

// leagueData: 팀 고유 정보(이름/로고/구장)만 담습니다.
// played/won/drawn/lost/goalsFor/goalsAgainst/cleanSheets/failedToScore/form/nextMatch는
// 더 이상 여기서 손으로 관리하지 않습니다 — 아래 applyComputedLeagueStats()가
// roundsData(확정 라운드) + scheduledRounds(예정/부분 확정 라운드)를 읽어서
// 자동으로 계산해 각 팀 객체에 채워 넣습니다.
// 즉, 경기 결과는 roundsData/scheduledRounds에만 입력하면 되고,
// 승점/득실/폼/다음 경기 정보는 이 파일을 저장하는 순간 자동으로 갱신됩니다.
const leagueData = [
  {
    nameKo: "치바비 리얼 스타스 FC", nameEn: "Chibavi Real Stars FC", logoSrc: "치바비.webp",
    venue: { nameKo: "치바비 그라운드", nameEn: "Chibavi Ground", lat: -11.443131740663798, lng: 34.00202271076014 }
  },
  {
    nameKo: "젠다 유나이티드 FC", nameEn: "Jenda United FC", logoSrc: "젠다.webp",
    venue: { nameKo: "젠다 커뮤니티 그라운드", nameEn: "Jenda Community Ground", lat: -12.353220994618397, lng: 33.55134047659975 }
  },
  {
    nameKo: "치주물루 유나이티드 FC", nameEn: "Chizumulu United FC", logoSrc: "dd.svg",
    venue: { nameKo: "치테코 커뮤니티 그라운드", nameEn: "Chiteko Community Ground", lat: -12.013520053363743, lng: 34.61472198075732 }
  },
  {
    nameKo: "친테체 유나이티드 FC", nameEn: "Chintheche United FC", logoSrc: "친테체.webp",
    venue: { nameKo: "친테체 그라운드", nameEn: "Chintheche Ground", lat: -11.82971083972567, lng: 34.1693308131396 }
  },
  {
    nameKo: "칠룸바 배럭스 FC", nameEn: "Chilumba Barracks FC", logoSrc: "칠룸바.webp",
    venue: { nameKo: "마잘리로 그라운드", nameEn: "Majaliro Ground", lat: -10.437859548225552, lng: 34.244529365527434 }
  },
  {
    nameKo: "마푸 스타즈 FC", nameEn: "Mafu Stars FC", logoSrc: "마푸스타즈.webp",
    venue: { nameKo: "망캄비라 그라운드", nameEn: "Mankhambira Ground", lat: -11.722050060500038, lng: 34.296560298979976 }
  },
  {
    nameKo: "음벨와 워리어스 FC", nameEn: "M'mbelwa Warriors FC", logoSrc: "음벨와.webp",
    venue: { nameKo: "치반자 그라운드", nameEn: "Chibanja Ground", lat: -11.459634955492291, lng: 34.00871941636782 }
  },
  {
    nameKo: "치폴로폴로 보이즈 FC", nameEn: "Chipolopolo Boys FC", logoSrc: "치폴로폴로.webp",
    venue: { nameKo: "루지 그라운드", nameEn: "Luzi Ground", lat: -10.996973616990681, lng: 33.95852479021444 }
  },
  {
    nameKo: "에크웬데니 FC", nameEn: "Ekwendeni FC", logoSrc: "에크웬데니.webp",
    venue: { nameKo: "에크웬데니 커뮤니티 그라운드", nameEn: "Ekwendeni Community Ground", lat: -11.361646682489035, lng: 33.878772291009554 }
  },
  {
    nameKo: "루베 마스터즈 FC", nameEn: "Lube Masters FC", logoSrc: "루베.webp",
    venue: { nameKo: "치바비 그라운드", nameEn: "Chibavi Ground", lat: -11.443131740663798, lng: 34.00202271076014 }
  },
  {
    nameKo: "치하메 올스타즈 FC", nameEn: "Chihame All Stars FC", logoSrc: "치하메.webp",
    venue: { nameKo: "마강가 그라운드", nameEn: "Maganga Ground", lat: -11.606119833712514, lng: 34.28363798021556 }
  },
  {
    nameKo: "라이플리 FC", nameEn: "Raiply FC", logoSrc: "라이플리.webp",
    venue: { nameKo: "라이플리 그라운드", nameEn: "Raiply Ground", lat: -11.872442758508145, lng: 33.79948562470589 }
  },
  {
    nameKo: "에우티니 베테랑스 FC", nameEn: "Euthini Veterans FC", logoSrc: "에우티니.webp",
    venue: { nameKo: "에우티니 그라운드", nameEn: "Euthini CDSS Ground", lat: -11.452676853336099, lng: 33.41946042830683 }
  },
  {
    nameKo: "비전 S 아카데미", nameEn: "Vision S Academy", logoSrc: "비전아카데미.webp",
    venue: { nameKo: "보타닉 그라운드", nameEn: "Votanic Ground", lat: -11.396261544531715, lng: 34.00939476359461 }
  },
  {
    nameKo: "루비리 FC", nameEn: "Luviri FC", logoSrc: "루비리.webp",
    venue: { nameKo: "루비리 그라운드", nameEn: "Luviri Ground", lat: -12.198627593817912, lng: 33.66767272397456 }
  }
];

// ============================================================
// 팀별 성적(승점표/폼/다음경기) 자동 계산 (applyComputedLeagueStats)
// ------------------------------------------------------------
// roundsData(확정된 라운드)는 전부 결과로 반영하고, scheduledRounds
// (아직 안 끝난 라운드)는 스코어가 채워진 경기만 결과로 반영합니다.
// 각 팀의 "다음 경기"는 scheduledRounds를 라운드 순서대로 훑다가
// 처음 만나는, 아직 스코어가 없는 경기(또는 부전승)로 정합니다.
// roundsData/scheduledRounds에 스코어만 입력하면 이 함수가
// played/won/drawn/lost/goalsFor/goalsAgainst/cleanSheets/failedToScore/
// form/nextMatch를 전부 자동으로 다시 계산해서 leagueData에 채워 넣습니다.
// ============================================================
function applyComputedLeagueStats() {
  const byRoundNum = (a, b) => parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  const roundKeysSorted = Object.keys(roundsData).sort(byRoundNum);
  const scheduledKeysSorted = Object.keys(scheduledRounds || {})
    .filter(k => !roundsData[k])
    .sort(byRoundNum);

  const stats = {};
  leagueData.forEach(t => {
    stats[t.nameEn] = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0, failedToScore: 0, form: [] };
  });
  const nextMatchFound = {};

  function accumulate(m) {
    if (m.byeKo || m.byeEn) return;
    if (!m.homeEn || !m.awayEn) return;
    if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
    const home = stats[m.homeEn], away = stats[m.awayEn];
    if (home) {
      home.played++; home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
      if (m.awayScore === 0) home.cleanSheets++;
      if (m.homeScore === 0) home.failedToScore++;
      if (m.homeScore > m.awayScore) { home.won++; home.form.push('W'); }
      else if (m.homeScore < m.awayScore) { home.lost++; home.form.push('L'); }
      else { home.drawn++; home.form.push('D'); }
    }
    if (away) {
      away.played++; away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;
      if (m.homeScore === 0) away.cleanSheets++;
      if (m.awayScore === 0) away.failedToScore++;
      if (m.awayScore > m.homeScore) { away.won++; away.form.push('W'); }
      else if (m.awayScore < m.homeScore) { away.lost++; away.form.push('L'); }
      else { away.drawn++; away.form.push('D'); }
    }
  }

  // 1) 확정된 라운드는 전부 결과로 반영 (지나간 라운드이므로 다음 경기 후보 아님)
  roundKeysSorted.forEach(roundKey => {
    (roundsData[roundKey] || []).forEach(accumulate);
  });

  // 2) 예정된 라운드: 스코어가 이미 채워진 경기는 결과 반영,
  //    스코어 없는 경기/부전승은 각 팀의 "다음 경기" 후보(라운드 순으로 처음 만나는 것)
  scheduledKeysSorted.forEach(roundKey => {
    (scheduledRounds[roundKey] || []).forEach(m => {
      if (m.byeKo || m.byeEn) {
        const nameEn = m.byeEn;
        if (nameEn && stats[nameEn] && !nextMatchFound[nameEn]) {
          nextMatchFound[nameEn] = { isBye: true };
        }
        return;
      }
      if (!m.homeEn || !m.awayEn) return;
      const hasScore = typeof m.homeScore === 'number' && typeof m.awayScore === 'number';
      if (hasScore) {
        accumulate(m);
      } else {
        if (!nextMatchFound[m.homeEn]) {
          nextMatchFound[m.homeEn] = { isBye: false, homeAway: 'H', oppKo: m.awayKo, oppEn: m.awayEn, kickoffDate: m.kickoffDate, kickoffTime: m.kickoffTime };
        }
        if (!nextMatchFound[m.awayEn]) {
          nextMatchFound[m.awayEn] = { isBye: false, homeAway: 'A', oppKo: m.homeKo, oppEn: m.homeEn, kickoffDate: m.kickoffDate, kickoffTime: m.kickoffTime };
        }
      }
    });
  });

  leagueData.forEach(t => {
    const s = stats[t.nameEn];
    t.played = s.played; t.won = s.won; t.drawn = s.drawn; t.lost = s.lost;
    t.goalsFor = s.goalsFor; t.goalsAgainst = s.goalsAgainst;
    t.cleanSheets = s.cleanSheets; t.failedToScore = s.failedToScore;
    t.form = s.form;

    const nm = nextMatchFound[t.nameEn];
    if (!nm) {
      t.nextMatch = null;
    } else if (nm.isBye) {
      t.nextMatch = { isBye: true };
    } else {
      const oppTeam = leagueData.find(x => x.nameEn === nm.oppEn);
      t.nextMatch = {
        isBye: false, homeAway: nm.homeAway,
        oppKo: nm.oppKo, oppEn: nm.oppEn,
        oppLogo: oppTeam ? oppTeam.logoSrc : undefined,
        kickoffDate: nm.kickoffDate, kickoffTime: nm.kickoffTime
      };
    }
  });
}

applyComputedLeagueStats();

// ============================================================
// 상대전적(H2H) 통산 기록 (h2hHistory) 계산
// ------------------------------------------------------------
// roundsData(이번 시즌에 치주물루 유나이티드가 실제로 치른 경기)와
// matchLineups[].recentHistory(라운드 상세 화면에 함께 실리는, 과거 시즌
// 상대전적 메모)를 합쳐서 상대팀별 통산 승/무/패와 득실차를 계산합니다.
// - recentHistory 안의 상대팀 이름은 "치하메", "루베" 처럼 줄임말로 적혀
//   있을 수 있어서, leagueData의 정식 팀명과 접두어가 일치하면 그 팀의
//   정식 명칭/로고로 연결합니다. 지금 리그에 없는 과거 상대(예: 심보웨)는
//   이름을 그대로 사용합니다.
// - "(PSO 4:2)" 같은 승부차기 표기는 정규시간 스코어만 승/무/패 판정에
//   사용하고 무시합니다.
// 새 라운드가 roundsData/matchLineups에 추가되면 자동으로 반영되므로
// 이 파일을 따로 수정할 필요가 없습니다.
// 반환값: 상대팀별 배열(경기 수가 많은 순으로 정렬), 각 항목:
// { key, nameKo, nameEn, logoSrc, isCurrentLeagueTeam,
//   played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff,
//   matches: [ { source: 'season'|'history', myGoals, oppGoals, result, ... } ] }
// ============================================================
function isOurTeamLabel(label) {
  if (!label) return false;
  const t = String(label).trim();
  return t.indexOf('치주물루') !== -1 || t.toLowerCase().indexOf('chizumulu') !== -1;
}

// recentHistory 안에서 지금은 다른 이름으로 불리는(또는 옛 명칭인) 상대팀을
// leagueData의 정식 팀명으로 동일시해주는 별칭 매핑입니다.
// 예: "심보웨"는 "마푸 스타즈 FC"의 옛 팀명이라 마푸 스타즈 FC 전적에 합산합니다.
// 새로운 별칭이 필요하면 이 목록에 한 줄만 추가하면 됩니다.
const h2hOpponentAliases = {
  "심보웨": "마푸 스타즈 FC"
};

// recentHistory에 적힌 상대팀 이름(줄임말 가능)을 leagueData의 정식 팀과 연결합니다.
function resolveH2HOpponent(rawKo) {
  const raw = (rawKo || '').trim();
  const aliased = h2hOpponentAliases[raw] || raw;
  const teams = (typeof leagueData !== 'undefined') ? leagueData : [];
  const found = teams.find(t => t.nameKo && (t.nameKo === aliased || t.nameKo.indexOf(aliased) === 0));
  if (found) {
    return {
      key: found.nameEn, nameKo: found.nameKo, nameEn: found.nameEn,
      logoSrc: found.logoSrc || null, isCurrentLeagueTeam: true
    };
  }
  // 현재 리그 소속이 아닌(과거 시즌에만 있었던) 상대팀은 이름 그대로 사용
  return { key: 'hist:' + aliased, nameKo: aliased, nameEn: aliased, logoSrc: null, isCurrentLeagueTeam: false };
}

function computeH2HHistory() {
  const table = {};

  function ensure(info) {
    if (!table[info.key]) {
      table[info.key] = {
        key: info.key, nameKo: info.nameKo, nameEn: info.nameEn,
        logoSrc: info.logoSrc, isCurrentLeagueTeam: info.isCurrentLeagueTeam,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, matches: []
      };
    }
    return table[info.key];
  }

  function applyResult(rec, myGoals, oppGoals, extra) {
    rec.played++;
    rec.goalsFor += myGoals;
    rec.goalsAgainst += oppGoals;
    let result;
    if (myGoals > oppGoals) { rec.won++; result = 'W'; }
    else if (myGoals < oppGoals) { rec.lost++; result = 'L'; }
    else { rec.drawn++; result = 'D'; }
    rec.matches.push(Object.assign({ myGoals, oppGoals, result }, extra));
  }

  // 1) 이번 시즌 roundsData (확정된 라운드만)
  function scanMatchesForUs(matches, roundKey, weekNum, source) {
    (matches || []).forEach(m => {
      if (m.byeKo || m.byeEn) return;
      const homeIsUs = m.homeKo === '치주물루 유나이티드 FC' || m.homeEn === 'Chizumulu United FC';
      const awayIsUs = m.awayKo === '치주물루 유나이티드 FC' || m.awayEn === 'Chizumulu United FC';
      if (!homeIsUs && !awayIsUs) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

      const oppKo = homeIsUs ? m.awayKo : m.homeKo;
      const oppEn = homeIsUs ? m.awayEn : m.homeEn;
      const myGoals = homeIsUs ? m.homeScore : m.awayScore;
      const oppGoals = homeIsUs ? m.awayScore : m.homeScore;

      const info = resolveH2HOpponent(oppKo);
      if (!info.isCurrentLeagueTeam && oppEn) info.nameEn = oppEn;
      const rec = ensure(info);
      applyResult(rec, myGoals, oppGoals, {
        source, roundKey, weekNum, homeAway: homeIsUs ? 'H' : 'A'
      });
    });
  }

  const roundKeysSorted = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });
  roundKeysSorted.forEach((roundKey, idx) => {
    scanMatchesForUs(roundsData[roundKey], roundKey, idx + 1, 'season');
  });

  // 1b) 아직 라운드 전체가 끝나지 않아 scheduledRounds에 남아있지만,
  // 치주물루 경기 자체는 이미 스코어가 채워진 경우(예: round7 젠다전)도
  // 라운드가 roundsData로 옮겨지길 기다리지 않고 상대전적에 바로 반영합니다.
  // (roundsData에 이미 있는 라운드는 중복 집계를 막기 위해 건너뜁니다.)
  if (typeof scheduledRounds !== 'undefined') {
    const scheduledKeysSorted = Object.keys(scheduledRounds).sort((a, b) => {
      return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
    });
    scheduledKeysSorted.forEach((roundKey, idx) => {
      if (roundsData[roundKey]) return; // 이미 확정 라운드로 옮겨졌으면 건너뜁니다
      scanMatchesForUs(scheduledRounds[roundKey], roundKey, roundKeysSorted.length + idx + 1, 'season');
    });
  }

  // recentHistory 배열 하나(h.score 형식: "A 2 : 1 B")를 파싱해서 H2H 테이블에 반영하는
  // 공용 헬퍼. matchLineups(치른 라운드)와 upcomingMatchHistory(예정 라운드)가 형식이
  // 같아서 이 함수 하나로 둘 다 처리합니다.
  function applyRecentHistoryList(recentHistory, roundKey, source) {
    (recentHistory || []).forEach(h => {
      const scoreText = (h.score || '').trim();
      const parsed = /^(.+?)\s+(\d+)\s*:\s*(\d+)\s+(.+)$/.exec(scoreText);
      if (!parsed) return;

      const leftRaw = parsed[1];
      const leftScore = parseInt(parsed[2], 10);
      const rightScore = parseInt(parsed[3], 10);
      const rightRaw = parsed[4].replace(/\s*\(.*\)\s*$/, '').trim();

      let myGoals, oppGoals, oppRaw;
      if (isOurTeamLabel(leftRaw)) {
        myGoals = leftScore; oppGoals = rightScore; oppRaw = rightRaw;
      } else if (isOurTeamLabel(rightRaw)) {
        myGoals = rightScore; oppGoals = leftScore; oppRaw = leftRaw;
      } else {
        return; // 치주물루가 언급되지 않은 기록은 건너뜁니다
      }

      const info = resolveH2HOpponent(oppRaw);
      const rec = ensure(info);
      applyResult(rec, myGoals, oppGoals, { source, roundKey, comp: h.comp, scoreText });
    });
  }

  // 2) matchLineups[].recentHistory (치른 라운드의 상대전적 메모)
  Object.keys(matchLineups).forEach(roundKey => {
    const lineup = matchLineups[roundKey];
    if (!lineup) return;
    applyRecentHistoryList(lineup.recentHistory, roundKey, 'history');
  });

  // 3) upcomingMatchHistory[].recentHistory (아직 안 치른 라운드에 미리 적어둔 상대전적 메모)
  if (typeof upcomingMatchHistory !== 'undefined') {
    Object.keys(upcomingMatchHistory).forEach(roundKey => {
      const entry = upcomingMatchHistory[roundKey];
      if (!entry) return;
      applyRecentHistoryList(entry.recentHistory, roundKey, 'upcoming');
    });
  }

  const list = Object.keys(table).map(k => {
    const rec = table[k];
    rec.goalDiff = rec.goalsFor - rec.goalsAgainst;
    return rec;
  });

  list.sort((a, b) => {
    if (b.played !== a.played) return b.played - a.played;
    return (a.nameKo || '').localeCompare(b.nameKo || '', 'ko');
  });

  return list;
}

// ============================================================
// 폼 가이드 / 연승·무패 스트릭 (computeFormGuide) 계산
// ------------------------------------------------------------
// roundsData(확정된 라운드)를 주차 순서대로 훑어서 특정 팀의 W/D/L
// 결과열을 만들고, 그 결과열로부터
//  - 최근 5경기 폼(recentForm)
//  - 역대(시즌 전체) 최다 연승 기록(longestWinStreak)
//  - 역대 최다 무패(승+무) 기록(longestUnbeatenStreak)
//  - 지금 이 순간까지 이어지고 있는 연승/무패 행진(currentWinStreak/
//    currentUnbeatenStreak)
// 을 계산합니다. nameEn/nameKo만 넘기면 어떤 팀에도 재사용할 수 있습니다.
// ============================================================
function computeFormGuide(nameEn, nameKo) {
  // roundsData(완전히 끝난 라운드)뿐 아니라, 아직 라운드 전체가 끝나지 않아
  // scheduledRounds에 남아있어도 개별 경기에 스코어가 이미 채워져 있으면
  // 그 경기도 "치른 경기"로 함께 훑습니다. (roundHasAnyResult / buildRoundMatches와 동일한 패턴)
  const roundKeysSorted = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });
  const scheduledKeysSorted = Object.keys(scheduledRounds || {})
    .filter(k => !roundsData[k])
    .sort((a, b) => parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10));
  const allKeysSorted = [...roundKeysSorted, ...scheduledKeysSorted].sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  const sequence = [];
  allKeysSorted.forEach((roundKey, idx) => {
    const weekNum = idx + 1;
    const matches = roundsData[roundKey] || (scheduledRounds && scheduledRounds[roundKey]) || [];
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
      const isHome = m.homeEn === nameEn || m.homeKo === nameKo;
      const isAway = m.awayEn === nameEn || m.awayKo === nameKo;
      if (!isHome && !isAway) return;

      const myGoals = isHome ? m.homeScore : m.awayScore;
      const oppGoals = isHome ? m.awayScore : m.homeScore;
      let result;
      if (myGoals > oppGoals) result = 'W';
      else if (myGoals < oppGoals) result = 'L';
      else result = 'D';

      sequence.push({
        weekNum, roundKey, result,
        homeAway: isHome ? 'H' : 'A',
        oppKo: isHome ? m.awayKo : m.homeKo,
        oppEn: isHome ? m.awayEn : m.homeEn,
        myGoals, oppGoals
      });
    });
  });

  // predicate를 만족하는 가장 긴 연속 구간(및 그 시작/끝 주차)을 찾습니다.
  // 동률(같은 길이)이 여러 번 나오면 가장 처음(오래된) 기록을 유지합니다.
  function longestStreak(predicate) {
    let best = { count: 0, startWeek: null, endWeek: null };
    let currentCount = 0;
    let currentStart = null;
    sequence.forEach(m => {
      if (predicate(m.result)) {
        if (currentCount === 0) currentStart = m.weekNum;
        currentCount++;
        if (currentCount > best.count) {
          best = { count: currentCount, startWeek: currentStart, endWeek: m.weekNum };
        }
      } else {
        currentCount = 0;
        currentStart = null;
      }
    });
    return best;
  }

  // 가장 최근 경기부터 거슬러 올라가며 predicate가 끊기지 않고 이어지는 길이
  function currentStreak(predicate) {
    let count = 0;
    for (let i = sequence.length - 1; i >= 0; i--) {
      if (predicate(sequence[i].result)) count++;
      else break;
    }
    return count;
  }

  const isWin = r => r === 'W';
  const isUnbeaten = r => r === 'W' || r === 'D';

  return {
    sequence,
    recentForm: sequence.slice(-5),
    longestWinStreak: longestStreak(isWin),
    longestUnbeatenStreak: longestStreak(isUnbeaten),
    currentWinStreak: currentStreak(isWin),
    currentUnbeatenStreak: currentStreak(isUnbeaten)
  };
}

// ============================================================
// 골키퍼 개인 무실점(클린시트) 기록 (computeGoalkeeperRecords) 계산
// ------------------------------------------------------------
// matchLineups(라운드별 선발 명단 + 스코어)를 훑어서, 그 라운드 선발로
// 출전한 골키퍼별로 출전 수 / 무실점(클린시트) 횟수 / 실점 / 승수를
// 집계합니다. matchLineups는 우리 팀(치주물루) 경기만 있으므로
// 이 기록도 우리 팀 골키퍼 한정입니다.
// 참고: 경기 중 골키퍼가 교체된 경우(부상 등)에도 그 경기의 실점/클린시트는
// 편의상 "선발 골키퍼" 기준으로 집계합니다.
// ============================================================
function computeGoalkeeperRecords() {
  const byRoundNum = (a, b) => parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  const roundKeysSorted = Object.keys(matchLineups || {}).sort(byRoundNum);

  const records = {}; // number -> record

  roundKeysSorted.forEach(roundKey => {
    const lineup = matchLineups[roundKey];
    if (!lineup) return;
    const gk = (lineup.starters || []).find(p => p.pos === 'GK');
    if (!gk) return;

    const parsed = /^(\d+)\s*:\s*(\d+)/.exec((lineup.result || '').trim());
    if (!parsed) return;
    const myScore = parseInt(parsed[1], 10);
    const oppScore = parseInt(parsed[2], 10);

    if (!records[gk.number]) {
      records[gk.number] = {
        number: gk.number,
        nameKo: gk.nameKo,
        appearances: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        wins: 0,
        roundKeys: []
      };
    }
    const rec = records[gk.number];
    rec.appearances++;
    rec.goalsConceded += oppScore;
    if (oppScore === 0) rec.cleanSheets++;
    if (myScore > oppScore) rec.wins++;
    rec.roundKeys.push(roundKey);
  });

  return Object.values(records).sort((a, b) => {
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    return a.goalsConceded - b.goalsConceded;
  });
}

// ============================================================
// 다음 경기 프리뷰 (computeNextMatchPreview) 계산
// ------------------------------------------------------------
// scheduledRounds(아직 안 치른 라운드)를 훑어서 특정 팀의 다음 라운드
// 매치업(부전승이면 부전승 여부)을 찾고, 상대가 있다면
//  - 홈/원정 여부(homeAway)
//  - 그 상대와의 H2H(상대전적) 요약 (computeH2HHistory 재사용)
// 을 한 번에 묶어서 돌려줍니다. kickoffDate/kickoffTime은 말라위 표준시
// (CAT, UTC+2 고정, 서머타임 없음) 기준이라, 카운트다운 등에서 이 값으로
// UTC 시각을 그대로 계산할 수 있습니다.
// ============================================================
function computeNextMatchPreview(nameEn, nameKo) {
  if (typeof scheduledRounds === 'undefined') return null;

  const scheduledKeysSorted = Object.keys(scheduledRounds).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  for (let i = 0; i < scheduledKeysSorted.length; i++) {
    const roundKey = scheduledKeysSorted[i];
    const matches = scheduledRounds[roundKey] || [];

    const byeEntry = matches.find(m => (m.byeKo || m.byeEn) && (m.byeEn === nameEn || m.byeKo === nameKo));
    if (byeEntry) {
      return { isBye: true, roundKey };
    }

    const found = matches.find(m => !(m.byeKo || m.byeEn) &&
      (m.homeEn === nameEn || m.homeKo === nameKo || m.awayEn === nameEn || m.awayKo === nameKo));
    if (!found) continue;

    // 진행 중인 라운드(scheduledRounds)에는 이미 끝난 경기의 스코어가 먼저 채워지는 경우가 있습니다.
    // (그 라운드의 다른 경기들은 아직 예정 상태로 남아있는 동안) 이렇게 이미 스코어가 있는 경기는
    // "다음 경기"가 아니라 이미 끝난 경기이므로, 건너뛰고 그다음 라운드에서 진짜 다음 경기를 찾습니다.
    const alreadyPlayed = typeof found.homeScore === 'number' && typeof found.awayScore === 'number';
    if (alreadyPlayed) continue;

    const isHome = found.homeEn === nameEn || found.homeKo === nameKo;
    const oppKo = isHome ? found.awayKo : found.homeKo;
    const oppEn = isHome ? found.awayEn : found.homeEn;
    const oppTeam = (typeof leagueData !== 'undefined') ? leagueData.find(t => t.nameEn === oppEn) : null;

    const h2hAll = (typeof computeH2HHistory === 'function') ? computeH2HHistory() : [];
    const h2h = h2hAll.find(r => r.nameEn === oppEn || r.nameKo === oppKo) || null;

    return {
      isBye: false,
      roundKey,
      homeAway: isHome ? 'H' : 'A',
      oppKo, oppEn,
      oppLogo: oppTeam ? oppTeam.logoSrc : null,
      kickoffDate: found.kickoffDate,
      kickoffTime: found.kickoffTime,
      h2h
    };
  }

  return null; // 남은 예정 라운드가 없음
}

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
  "ZACHARIAH MPHAMBA": "ZAKARIA MPHAMBA",
  "CLEMENT MUNTHALI": "CLEMENT KASEKA",
  "CLEMENT MTHALI": "CLEMENT KASEKA",
  "CHISOMO MYEGHA": "CHISOMO MYGHA"
};

// 영문 이름(대문자) -> 한글/영문 표기 사전. matchDetails 에 새 득점자가
// 나오면 이 사전에 한 줄만 추가하면 나머지는 자동으로 계산됩니다.
const playerDirectory = {
  "GIVEN MWANDIRA": { nameKo: "기븐 므완디라", nameEn: "Given Mwandira" },
  "JOMO PHIRI": { nameKo: "조모 피리", nameEn: "Jomo Phiri" },
  "ROBIN CHIOKO": { nameKo: "로빈 치오코", nameEn: "Robin Chioko" },
  "ACKIM GOMIRE": { nameKo: "아킴 고미레", nameEn: "Ackim Gomire" },
  "BABA NKHOMA": { nameKo: "바바 은코마", nameEn: "Baba Nkhoma" },
  "DANIEL CHISOKWE": { nameKo: "다니엘 치소크웨", nameEn: "Daniel Chisokwe" },
  "KINGSLEY MVULA": { nameKo: "킹슬리 음불라", nameEn: "Kingsley Mvula" },
  "DANIEL SIWALE": { nameKo: "다니엘 시왈레", nameEn: "Daniel Siwale" },
  "SHAIBU JALAH": { nameKo: "샤이부 잘라", nameEn: "Shaibu Jalah" },
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
  "DAVIE NGOMA": { nameKo: "데이비 응고마", nameEn: "Davie Ngoma" },
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
  "STEVEN PHIRI": { nameKo: "스티브 피리", nameEn: "Steve Phiri" },
  "BENJAMIN NYIRENDA": { nameKo: "벤자민 니렌다", nameEn: "Benjamin Nyirenda" },
  "KUMBUKANI BANYA": { nameKo: "쿰부카니 바냐", nameEn: "Kumbukani Banya" },
  "BABA NKHOMA": { nameKo: "바바 은코마", nameEn: "Baba Nkhoma" },
  "SAMANI NYIRENDA": { nameKo: "사마니 니렌다", nameEn: "Samani Nyirenda" },
  "TAIMON GOMEKA": { nameKo: "타이몬 고메카", nameEn: "Taimon Gomeka" },
  "FRANK MWALE": { nameKo: "프랭크 므왈레", nameEn: "Frank Mwale" },
  "MIKE LUHANGA": { nameKo: "마이크 루항가", nameEn: "Mike Luhanga" },
  "KING NYASULU": { nameKo: "킹 니야술루", nameEn: "King Nyasulu" },
  "TYSON KAUNDA": { nameKo: "타이슨 카운다", nameEn: "Tyson Kaunda" },
  "CLEMENT KASEKA": { nameKo: "클레멘트 카세카", nameEn: "Clement Kaseka" },
  "JERPHASON KANYENDA": { nameKo: "제르파손 칸옌다", nameEn: "Jerphason Kanyenda" },
  "GOMEZGANI SIBALE": { nameKo: "고메즈가니 시발레", nameEn: "Gomezgani Sibale" },
  "RODRICK KASUDZA": { nameKo: "로드릭 카수자", nameEn: "Rodrick Kasudza" },
  "GEORGE MASEWO": { nameKo: "조지 마세워", nameEn: "George Masewo" },
  "TYSON SOKO": { nameKo: "타이슨 소코", nameEn: "Tyson Soko" },
  "KINGSLEY MKANDAWIRE": { nameKo: "킹슬리 음칸다위레", nameEn: "Kingsley Mkandawire" },
  "ABRAHAM MVULA": { nameKo: "아브라함 음불라", nameEn: "Abraham Mvula" },
  "JOSEPH BANDA": { nameKo: "조셉 반다", nameEn: "Joseph Banda" },
  "JAMES ZONGA": { nameKo: "제임스 존가", nameEn: "James Zonga" },
  "CHARLES KAMANGA": { nameKo: "찰스 카망가", nameEn: "Charles Kamanga" },
  "WANANGWA GAMA": { nameKo: "와낭과 가마", nameEn: "Wanangwa Gama" }
};

function toTitleCase(upperName) {
  return upperName
    .split(" ")
    .map(w => (w.length ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// ============================================================
// 득점자 텍스트("STEVEN PHIRI, DICKIES NYIRENDA" 등)를 화면 언어에 맞춰
// playerDirectory 기준으로 번역해주는 공용 함수.
// - "없음" / 빈 값은 그대로 반환합니다.
// - "(2골)" 같은 괄호 메모는 그대로 유지한 채 이름만 바꿉니다.
// - playerDirectory에 없는 이름은 원문 그대로 둡니다.
// ============================================================
function formatScorerNames(scorerText, isKorean) {
  if (!scorerText || scorerText === "없음") return scorerText;

  return scorerText.split(",").map(rawSegment => {
    const segment = rawSegment.trim();
    if (!segment) return segment;

    const parenMatch = segment.match(/^(.+?)\s*(\([^)]*\))?\s*$/);
    const rawName = (parenMatch ? parenMatch[1] : segment).trim();
    const note = (parenMatch && parenMatch[2]) ? parenMatch[2] : "";

    let key = rawName.toUpperCase();
    if (typeof nameAliases !== 'undefined' && nameAliases[key]) key = nameAliases[key];

    const info = (typeof playerDirectory !== 'undefined') ? playerDirectory[key] : null;
    const displayName = info ? (isKorean ? info.nameKo : info.nameEn) : rawName;

    return note ? `${displayName} ${note}` : displayName;
  }).join(", ");
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

  // 1) 완전히 끝나 roundsData로 옮겨진 라운드는 matchDetails의 "match" 텍스트로 팀을 찾습니다.
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

  // 2) 아직 진행 중인 라운드(scheduledRounds)에서 이미 스코어/득점자가 채워진
  //    개별 경기는 homeEn/awayEn으로 바로 팀을 찾아 집계합니다. 라운드 전체가
  //    끝나 roundsData로 옮겨진 뒤에도 scheduledRounds에 남아있을 경우를 대비해
  //    roundsData에 이미 있는 라운드는 건너뛰어 중복 집계를 막습니다.
  if (typeof scheduledRounds !== 'undefined' && scheduledRounds) {
    Object.keys(scheduledRounds).forEach(roundKey => {
      if (roundsData[roundKey]) return; // 이미 matchDetails 쪽에서 집계됨
      scheduledRounds[roundKey].forEach(m => {
        if (m.byeKo || m.byeEn) return;
        if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

        const homeTeam = findTeamByNameEn(m.homeEn);
        const awayTeam = findTeamByNameEn(m.awayEn);

        addScorers(m.scorersHome, homeTeam);
        addScorers(m.scorersAway, awayTeam);
      });
    });
  }

  return Object.keys(goalsByPlayer)
    .map(key => {
      const { goals, team } = goalsByPlayer[key];
      const info = playerDirectory[key] || { nameKo: toTitleCase(key), nameEn: toTitleCase(key) };

      // 치주물루 유나이티드 소속 선수라면 squadData 에서 선수 사진을 찾아 연결합니다
      // (팀 정보 탭의 선수단 카드와 동일한 조건: photoSrc 가 있으면 사진을 사용).
      let photoSrc = null;
      if (team.nameEn === 'Chizumulu United FC') {
        const squadMatch = squadData.find(p => p.nameEn.toUpperCase() === info.nameEn.toUpperCase());
        if (squadMatch && squadMatch.photoSrc) photoSrc = squadMatch.photoSrc;
      }

      return {
        key,
        nameKo: info.nameKo,
        nameEn: info.nameEn,
        teamKo: team.nameKo,
        teamEn: team.nameEn,
        teamLogo: team.logoSrc,
        photoSrc,
        goals
      };
    })
    .sort((a, b) => b.goals - a.goals);
}

// 득점 순위 데이터 (matchDetails 로부터 자동 계산됨. 더 이상 직접 수정할 필요 없음)
const topScorersData = computeTopScorers();

// ============================================================
// 포지션별 득점 기여도 (Goals by Position)
// ------------------------------------------------------------
// topScorersData(득점 순위, computeTopScorers로 이미 계산됨) 중 치주물루
// 소속 선수만 골라서, squadData의 position(FW/MF/DF/GK)과 이름으로 연결한 뒤
// 포지션별 득점을 합산합니다. topScorersData가 바뀔 때마다(=matchDetails에
// 라운드가 추가될 때마다) 자동으로 갱신되므로 따로 손댈 필요가 없습니다.
// ============================================================
const GOALS_BY_POSITION_ORDER = ['FW', 'MF', 'DF', 'GK'];
const GOALS_BY_POSITION_LABEL = {
  FW: { ko: '공격수', en: 'Forwards' },
  MF: { ko: '미드필더', en: 'Midfielders' },
  DF: { ko: '수비수', en: 'Defenders' },
  GK: { ko: '골키퍼', en: 'Goalkeepers' }
};

function computeGoalsByPositionData() {
  const byPosition = {}; // position -> { goals, players: [{nameKo, nameEn, goals, number, photoSrc}] }

  topScorersData
    .filter(p => p.teamEn === 'Chizumulu United FC')
    .forEach(scorer => {
      const squadMatch = squadData.find(p => p.nameEn.toUpperCase() === scorer.nameEn.toUpperCase());
      const position = squadMatch ? squadMatch.position : null;
      if (!position) return; // 스쿼드에서 포지션을 못 찾으면 집계 제외

      if (!byPosition[position]) byPosition[position] = { position, goals: 0, players: [] };
      byPosition[position].goals += scorer.goals;
      byPosition[position].players.push({
        number: squadMatch.number, nameKo: scorer.nameKo, nameEn: scorer.nameEn,
        goals: scorer.goals, photoSrc: squadMatch.photoSrc || null
      });
    });

  const totalGoals = Object.values(byPosition).reduce((sum, g) => sum + g.goals, 0);

  const groups = GOALS_BY_POSITION_ORDER
    .filter(pos => byPosition[pos])
    .map(pos => {
      const g = byPosition[pos];
      g.players.sort((a, b) => b.goals - a.goals);
      return Object.assign({}, g, {
        labelKo: GOALS_BY_POSITION_LABEL[pos].ko, labelEn: GOALS_BY_POSITION_LABEL[pos].en,
        pct: totalGoals ? Math.round((g.goals / totalGoals) * 100) : 0
      });
    })
    .sort((a, b) => b.goals - a.goals);

  return { totalGoals, groups };
}

const goalsByPositionData = computeGoalsByPositionData();

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

  // 3) 아직 진행 중인 라운드(scheduledRounds)에서 이미 스코어/득점자가 채워진
  //    개별 경기도 타임라인에 포함합니다. (computeTopScorers()의 2)번 로직과 동일한 이유:
  //    라운드 전체가 끝나 roundsData로 옮겨진 뒤에도 scheduledRounds에 남아있을 경우를
  //    대비해 roundsData에 이미 있는 라운드는 건너뛰어 중복 집계를 막습니다.
  if (typeof scheduledRounds !== 'undefined' && scheduledRounds) {
    const scheduledRoundKeysSorted = Object.keys(scheduledRounds).sort((a, b) => {
      return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
    });

    scheduledRoundKeysSorted.forEach(roundKey => {
      if (roundsData[roundKey]) return; // 이미 위에서 집계됨
      const weekNum = parseInt(roundKey.replace('round', ''), 10);

      scheduledRounds[roundKey].forEach(m => {
        if (m.byeKo || m.byeEn) return;
        if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

        const homeTeam = findTeamByNameEn(m.homeEn);
        const awayTeam = findTeamByNameEn(m.awayEn);

        addEntry(m.scorersHome, {
          roundKey, weekNum,
          teamEn: m.homeEn, teamKo: m.homeKo,
          oppEn: m.awayEn, oppKo: m.awayKo,
          oppLogo: awayTeam ? awayTeam.logoSrc : '',
          homeAway: 'H', homeScore: m.homeScore, awayScore: m.awayScore
        });
        addEntry(m.scorersAway, {
          roundKey, weekNum,
          teamEn: m.awayEn, teamKo: m.awayKo,
          oppEn: m.homeEn, oppKo: m.homeKo,
          oppLogo: homeTeam ? homeTeam.logoSrc : '',
          homeAway: 'A', homeScore: m.homeScore, awayScore: m.awayScore
        });
      });
    });
  }

  return timelines;
}

// 선수별 득점 타임라인 데이터 (matchDetails/roundsData 로부터 자동 계산됨)
const playerGoalTimelines = computePlayerGoalTimelines();

// ============================================================
// 경기 예측 (몬테카를로 시뮬레이션)
// ------------------------------------------------------------
// 15팀이 더블 라운드로빈(각 팀과 홈/원정 한 번씩, 총 210경기)으로
// 붙는 리그 구조입니다. 1라운드(1~15주차)는 scheduledRounds에 실제
// 매치업이 이미 정해져 있으므로 그걸 그대로 사용하고, 아직 일정이
// 나오지 않은 2라운드(16~30주차, 홈/원정을 뒤집은 재대결)는 각 팀
// 쌍의 1라운드 매치업을 뒤집어 자동으로 만들어냅니다.
// ============================================================

// 팀 쌍(A,B)의 1라운드(1~15주차) 매치업에서 누가 홈이었는지 계산합니다.
// roundsData(이미 끝난 라운드)와 scheduledRounds(아직 안 끝난 라운드) 둘 다 훑습니다.
function computeLeg1Homes() {
  const homes = {}; // key: "A||B" (nameEn 알파벳순 정렬) -> 홈이었던 팀의 nameEn

  function keyFor(aEn, bEn) {
    return aEn < bEn ? `${aEn}||${bEn}` : `${bEn}||${aEn}`;
  }

  function scan(source) {
    Object.keys(source || {}).forEach(roundKey => {
      (source[roundKey] || []).forEach(m => {
        if (m.byeKo || m.byeEn) return;
        if (!m.homeEn || !m.awayEn) return;
        homes[keyFor(m.homeEn, m.awayEn)] = m.homeEn;
      });
    });
  }

  scan(roundsData);
  scan(scheduledRounds);

  return homes;
}

// 아직 열리지 않은 경기 목록(1라운드 잔여분 + 2라운드 전체)을 만듭니다.
function generateRemainingFixtures() {
  const teamByEn = {};
  leagueData.forEach(t => { teamByEn[t.nameEn] = t; });

  const fixtures = [];

  // 1라운드 잔여분: roundsData로 아직 안 옮겨진(=결과가 안 나온) scheduledRounds 라운드를 그대로 사용
  Object.keys(scheduledRounds || {}).forEach(roundKey => {
    if (roundsData[roundKey]) return; // 이미 결과가 확정된 라운드는 제외
    (scheduledRounds[roundKey] || []).forEach(m => {
      if (m.byeKo || m.byeEn) return;
      // 라운드가 통째로 끝나지 않았어도, 개별 경기에 이미 스코어가 채워져 있으면
      // (=그 경기만 먼저 끝난 경우) 이미 leagueData에 반영된 결과이므로 제외합니다.
      if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') return;
      const home = teamByEn[m.homeEn];
      const away = teamByEn[m.awayEn];
      if (home && away) fixtures.push({ home, away });
    });
  });

  // 2라운드(재대결) 전체: 1라운드에서 홈이었던 팀을 원정으로 뒤집어 생성
  const leg1Homes = computeLeg1Homes();
  for (let i = 0; i < leagueData.length; i++) {
    for (let j = i + 1; j < leagueData.length; j++) {
      const teamA = leagueData[i];
      const teamB = leagueData[j];
      const key = teamA.nameEn < teamB.nameEn
        ? `${teamA.nameEn}||${teamB.nameEn}`
        : `${teamB.nameEn}||${teamA.nameEn}`;
      const leg1Home = leg1Homes[key];
      if (!leg1Home) continue; // 1라운드 매치업 정보가 없으면 스킵 (있을 수 없는 경우)
      if (leg1Home === teamA.nameEn) {
        fixtures.push({ home: teamB, away: teamA });
      } else {
        fixtures.push({ home: teamA, away: teamB });
      }
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

// 홈/원정 득점 배율 — 이 리그의 실제 경기 기록(roundsData) 기준으로 산출한 값입니다.
// 지금까지 치른 44경기 기준 평균 득점이 홈 1.96골 : 원정 0.91골(약 2.15배 차이)로,
// 일반적인 축구 리그 평균(약 1.3배)보다 홈 어드밴티지가 훨씬 큽니다.
// 아래 값은 44경기 실측 평균(홈 1.365배 / 원정 0.635배)을 그대로 반영한 것입니다.
// 표본이 아직 작으므로 시즌이 더 진행되며 결과가 쌓이면 이 값도 다시 확인해보는 게 좋습니다.
const HOME_ADVANTAGE = 1.365;
const AWAY_DISADVANTAGE = 0.635;

// ============================================================
// AI 예측 자동 보정 (Auto-Correction)
// ------------------------------------------------------------
// AI 예측 성적표(computeAiPredictionTrackRecord)가 쌓아온 "기대 득점 vs 실제 득점"
// 오차 패턴을 살펴서, 앞으로 열릴 경기 예측(predictSingleMatch, runMonteCarloSimulation)에
// 자동으로 반영합니다. 예를 들어 실제 홈 득점이 모델 기대치보다 계속 높게 나오는
// 패턴이 있으면 보정 계수가 1보다 커지면서 다음 예측의 홈 기대 득점을 그만큼
// 끌어올립니다. 반대로 실제 득점이 모델보다 낮았다면 계수는 1보다 작아집니다.
//
// - 표본이 AUTO_CORRECTION_MIN_SAMPLES 경기 미만이면 보정을 적용하지 않습니다
//   (초반 몇 경기만으로 보정하면 우연한 이상치에 흔들리기 쉬워서요).
// - 보정 폭은 ±AUTO_CORRECTION_MAX_ADJUST 로 제한합니다(한두 경기의 튀는 결과로
//   모델이 과도하게 휘둘리지 않도록 하는 안전장치입니다).
// - computeAiPredictionTrackRecord는 각 라운드를 예측할 때 그 라운드 '직전'까지
//   쌓인 오차만으로 보정 계수를 다시 계산(walk-forward)하므로, 트랙레코드 표에
//   나오는 "보정 적용 시" 성적도 미래 결과를 미리 들여다보지 않은 정직한
//   백테스트입니다.
// ============================================================
const AUTO_CORRECTION_MIN_SAMPLES = 8;
const AUTO_CORRECTION_MAX_ADJUST = 0.2; // ±20%

function clampCorrectionFactor(factor) {
  return Math.min(1 + AUTO_CORRECTION_MAX_ADJUST, Math.max(1 - AUTO_CORRECTION_MAX_ADJUST, factor));
}

// totals: { expHome, actHome, expAway, actAway, n } 형태로, 지금까지 쌓인
// "모델 기대 득점 합"과 "실제 득점 합"을 담습니다. n은 집계에 포함된 경기 수입니다
// (개막 라운드처럼 양 팀 다 이전 데이터가 없던 경기는 애초에 집계에서 제외됩니다).
function computeCorrectionFromTotals(totals) {
  const n = totals ? totals.n : 0;
  if (!totals || n < AUTO_CORRECTION_MIN_SAMPLES) {
    return { homeFactor: 1, awayFactor: 1, n, active: false };
  }
  const rawHomeFactor = totals.expHome > 0 ? totals.actHome / totals.expHome : 1;
  const rawAwayFactor = totals.expAway > 0 ? totals.actAway / totals.expAway : 1;
  return {
    homeFactor: clampCorrectionFactor(rawHomeFactor),
    awayFactor: clampCorrectionFactor(rawAwayFactor),
    n, active: true
  };
}

// 지금 시점까지 쌓인 전체 경기 결과를 기준으로 한 "현재" 자동 보정 계수를 반환합니다.
// predictSingleMatch / runMonteCarloSimulation처럼 앞으로 열릴 경기를 예측할 때 씁니다.
// (computeAiPredictionTrackRecord가 라운드별로 walk-forward 계산을 하면서 얻은
// 최신 누적치를 그대로 재사용합니다.)
function getAutoCorrectionFactors() {
  if (typeof computeAiPredictionTrackRecord !== 'function') {
    return { homeFactor: 1, awayFactor: 1, n: 0, active: false };
  }
  const track = computeAiPredictionTrackRecord();
  return track.currentCorrection || { homeFactor: 1, awayFactor: 1, n: 0, active: false };
}

// ============================================================
// 팀별 홈/원정 스플릿 (computeHomeAwaySplit) 계산
// ------------------------------------------------------------
// roundsData(확정된 라운드)를 훑어서 특정 팀의 홈 성적과 원정 성적을
// 각각 승/무/패·득실·승점으로 나눠 계산합니다.
// 여기에 더해, 몬테카를로 시뮬레이션(runMonteCarloSimulation)에서 쓰는
// 것과 동일한 HOME_ADVANTAGE/AWAY_DISADVANTAGE 배율과 computeTeamStrengths
// 로직을 그대로 재사용해서, "평균적인 팀"을 상대할 때의 홈/원정 기대 득점도
// 함께 계산해 실제 득점과 비교할 수 있게 해줍니다.
// ============================================================
function computeHomeAwaySplit(nameEn, nameKo) {
  function emptySide() {
    return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  }
  const home = emptySide();
  const away = emptySide();

  // computeFormGuide와 동일하게, 아직 라운드가 안 끝나 scheduledRounds에 남아있어도
  // 스코어가 채워진 경기는 함께 집계합니다.
  const roundKeysSorted = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });
  const scheduledKeysSorted = Object.keys(scheduledRounds || {})
    .filter(k => !roundsData[k])
    .sort((a, b) => parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10));
  const allKeysSorted = [...roundKeysSorted, ...scheduledKeysSorted];

  allKeysSorted.forEach(roundKey => {
    const matches = roundsData[roundKey] || (scheduledRounds && scheduledRounds[roundKey]) || [];
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
      const isHome = m.homeEn === nameEn || m.homeKo === nameKo;
      const isAway = m.awayEn === nameEn || m.awayKo === nameKo;
      if (isHome) {
        home.played++;
        home.goalsFor += m.homeScore;
        home.goalsAgainst += m.awayScore;
        if (m.homeScore > m.awayScore) home.won++;
        else if (m.homeScore < m.awayScore) home.lost++;
        else home.drawn++;
      } else if (isAway) {
        away.played++;
        away.goalsFor += m.awayScore;
        away.goalsAgainst += m.homeScore;
        if (m.awayScore > m.homeScore) away.won++;
        else if (m.awayScore < m.homeScore) away.lost++;
        else away.drawn++;
      }
    });
  });

  [home, away].forEach(side => {
    side.points = side.won * 3 + side.drawn;
    side.ppg = side.played > 0 ? side.points / side.played : 0;
    side.gpg = side.played > 0 ? side.goalsFor / side.played : 0;
    side.gapg = side.played > 0 ? side.goalsAgainst / side.played : 0;
    side.gd = side.goalsFor - side.goalsAgainst;
  });

  // 몬테카를로와 동일한 로직(리그 평균 득점 × 공격/수비 지수 × 홈/원정 배율)으로
  // '평균적인 상대(공격/수비 지수 1.0)'를 만났을 때의 기대 득점을 계산합니다.
  const { strengths, leagueAvgGoals } = computeTeamStrengths();
  const myStrength = strengths[nameEn] || { attack: 1, defense: 1 };
  const expectedHomeGoals = leagueAvgGoals * myStrength.attack * HOME_ADVANTAGE;
  const expectedAwayGoals = leagueAvgGoals * myStrength.attack * AWAY_DISADVANTAGE;

  return {
    home, away,
    expectedHomeGoals, expectedAwayGoals,
    homeAdvantageMultiplier: HOME_ADVANTAGE,
    awayDisadvantageMultiplier: AWAY_DISADVANTAGE
  };
}

// 임의의 두 팀 사이의 "이번 시즌" 맞대결 기록을 찾습니다(1경기제 리그이므로 최대 1건).
// roundsData(확정 라운드) + scheduledRounds(라운드 전체는 안 끝났어도 그 경기 자체는
// 스코어가 채워진 경우)를 모두 훑습니다. 아직 안 만났으면 null을 반환합니다.
function computeTeamSeasonH2H(nameEnA, nameKoA, nameEnB, nameKoB) {
  const roundKeysSorted = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });
  const scheduledKeysSorted = Object.keys(scheduledRounds || {})
    .filter(k => !roundsData[k])
    .sort((a, b) => parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10));
  const allKeysSorted = [...roundKeysSorted, ...scheduledKeysSorted];

  for (let i = 0; i < allKeysSorted.length; i++) {
    const roundKey = allKeysSorted[i];
    const weekNum = i + 1;
    const matches = roundsData[roundKey] || (scheduledRounds && scheduledRounds[roundKey]) || [];
    const found = matches.find(m => {
      if (m.byeKo || m.byeEn) return false;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return false;
      const isAHome = m.homeEn === nameEnA || m.homeKo === nameKoA;
      const isBAway = m.awayEn === nameEnB || m.awayKo === nameKoB;
      const isBHome = m.homeEn === nameEnB || m.homeKo === nameKoB;
      const isAAway = m.awayEn === nameEnA || m.awayKo === nameKoA;
      return (isAHome && isBAway) || (isBHome && isAAway);
    });
    if (!found) continue;

    const aIsHome = found.homeEn === nameEnA || found.homeKo === nameKoA;
    return {
      roundKey, weekNum,
      aIsHome,
      aScore: aIsHome ? found.homeScore : found.awayScore,
      bScore: aIsHome ? found.awayScore : found.homeScore
    };
  }
  return null;
}


// ===== 상세보기(경기 상세) 모달의 "최근 상대 전적" 자동 생성 =====
// matchLineups[roundKey]에 recentHistory를 수동으로 채워두지 않아도, 이번 경기 결과(방금
// 라운드 데이터에 채운 스코어)와 upcomingMatchHistory[roundKey]에 미리 적어둔 과거 시즌
// 상대전적 메모를 합쳐서 자동으로 만들어줍니다.
// - matchLineups[roundKey].recentHistory를 직접 채워두면(과거처럼) 그 값을 그대로 우선 사용합니다(수동 오버라이드).
// - 안 채워져 있으면: [이번 경기 자동 생성 1건] + [upcomingMatchHistory[roundKey].recentHistory(있다면)] 를 합쳐서 사용합니다.
// 따라서 8, 9, 10주차... 이후로는 라운드가 끝나서 roundsData/scheduledRounds에 스코어만
// 채워주면(그리고 미리 upcomingMatchHistory에 과거 상대전적 메모를 적어뒀다면) 이 함수가
// 상세보기의 "최근 상대 전적" 표를 알아서 채워줍니다.
function buildAutoMatchEntry(roundKey, weekNum, lineup) {
  const ourKo = '치주물루 유나이티드 FC';
  const ourEn = 'Chizumulu United FC';
  const matches = (typeof roundsData !== 'undefined' && roundsData[roundKey])
    || (typeof scheduledRounds !== 'undefined' && scheduledRounds[roundKey])
    || [];
  const found = matches.find(m => {
    if (m.byeKo || m.byeEn) return false;
    const isHomeUs = m.homeKo === ourKo || m.homeEn === ourEn;
    const isAwayUs = m.awayKo === ourKo || m.awayEn === ourEn;
    if (!isHomeUs && !isAwayUs) return false;
    const oppKo = isHomeUs ? m.awayKo : m.homeKo;
    return oppKo === lineup.opponentKo;
  });
  if (!found || typeof found.homeScore !== 'number' || typeof found.awayScore !== 'number') return null;

  const shortKo = nameKo => (nameKo || '').trim().split(' ')[0];
  const homeShort = (found.homeKo === ourKo) ? '치주물루' : shortKo(found.homeKo);
  const awayShort = (found.awayKo === ourKo) ? '치주물루' : shortKo(found.awayKo);
  const comp = `26/27 시즌 NRFA 리그 원 ${weekNum}주차`;
  const score = `${homeShort} ${found.homeScore} : ${found.awayScore} ${awayShort}`;
  let result;
  if (found.homeScore === found.awayScore) {
    result = '무승부';
  } else {
    const winnerShort = found.homeScore > found.awayScore ? homeShort : awayShort;
    result = `${winnerShort} 승`;
  }
  return { comp, score, result };
}

// 상세보기에서 실제로 사용할 "최근 상대 전적" 리스트 + 요약 문구를 반환합니다.
function getEffectiveRoundHistory(roundKey, weekNum, lineup) {
  if (lineup.recentHistory && lineup.recentHistory.length) {
    return { list: lineup.recentHistory, summary: lineup.historySummary || '' };
  }

  const autoEntry = buildAutoMatchEntry(roundKey, weekNum, lineup);
  const priorList = (typeof upcomingMatchHistory !== 'undefined'
    && upcomingMatchHistory[roundKey]
    && upcomingMatchHistory[roundKey].recentHistory) || [];
  const list = autoEntry ? [autoEntry, ...priorList] : priorList.slice();
  if (!list.length) return { list: [], summary: '' };

  let w = 0, d = 0, l = 0;
  list.forEach(h => {
    const r = String(h.result || '');
    if (r.indexOf('무승부') !== -1) d++;
    else if (r.indexOf('치주물루') !== -1) w++;
    else l++;
  });
  const tone = w > l ? '우세' : (w < l ? '열세' : '백중세');
  const summary = `최근 ${list.length}경기 전적 ${w}승 ${d}무 ${l}패로 ${tone}`;
  return { list, summary };
}

function runMonteCarloSimulation(iterations) {
  const N = iterations || 4000;
  const fixtures = generateRemainingFixtures();
  const { strengths, leagueAvgGoals } = computeTeamStrengths();
  // AI 예측 성적표에 쌓인 오차 패턴을 남은 경기 시뮬레이션에도 그대로 반영합니다.
  const correction = getAutoCorrectionFactors();

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

      const homeExpected = leagueAvgGoals * homeS.attack * awayS.defense * HOME_ADVANTAGE * correction.homeFactor;
      const awayExpected = leagueAvgGoals * awayS.attack * homeS.defense * AWAY_DISADVANTAGE * correction.awayFactor;

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
    remainingFixtureCount: fixtures.length,
    correctionApplied: correction.active,
    homeCorrectionFactor: correction.homeFactor,
    awayCorrectionFactor: correction.awayFactor,
    correctionSampleSize: correction.n
  };
}

// ============================================================
// 개별 경기 "AI 예측" (predictSingleMatch)
// ------------------------------------------------------------
// 몬테카를로 시뮬레이션과 동일한 공격/수비 지수 + 홈/원정 배율로 기대 득점을
// 구한 뒤, 무작위 시뮬레이션 대신 포아송 분포를 직접 계산(grid)해서
// 승/무/패 확률과 유력 스코어를 결정론적으로 산출합니다.
// (같은 두 팀이면 새로고침해도 항상 같은 확률이 나옵니다.)
// ============================================================
function poissonPmf(k, lambda) {
  // k! 를 직접 구하지 않고 누적곱으로 계산해 큰 수에서도 안전합니다.
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// 기대 득점(람다) 두 개를 넣으면 포아송 분포로 승/무/패 확률과 가장 유력한
// 스코어를 결정론적으로 계산해줍니다. predictSingleMatch와
// computeAiPredictionTrackRecord가 공통으로 사용하는 핵심 계산 로직입니다.
function computePoissonGrid(expectedHomeGoals, expectedAwayGoals, maxGoals) {
  const MAX_GOALS = maxGoals || 8; // 8골 초과 스코어는 확률이 무시 가능한 수준이라 컷오프
  const grid = [];
  let homeWinP = 0, drawP = 0, awayWinP = 0;
  let bestP = -1, bestH = 0, bestA = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poissonPmf(h, expectedHomeGoals);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph * poissonPmf(a, expectedAwayGoals);
      grid.push({ h, a, p });
      if (h > a) homeWinP += p;
      else if (h < a) awayWinP += p;
      else drawP += p;
      if (p > bestP) { bestP = p; bestH = h; bestA = a; }
    }
  }
  const total = homeWinP + drawP + awayWinP || 1;
  return {
    grid, total,
    homeWinPct: (homeWinP / total) * 100,
    drawPct: (drawP / total) * 100,
    awayWinPct: (awayWinP / total) * 100,
    bestH, bestA
  };
}

function predictSingleMatch(homeEn, homeKo, awayEn, awayKo) {
  const { strengths, leagueAvgGoals } = computeTeamStrengths();
  const homeS = strengths[homeEn] || { attack: 1, defense: 1 };
  const awayS = strengths[awayEn] || { attack: 1, defense: 1 };

  const rawExpectedHomeGoals = leagueAvgGoals * homeS.attack * awayS.defense * HOME_ADVANTAGE;
  const rawExpectedAwayGoals = leagueAvgGoals * awayS.attack * homeS.defense * AWAY_DISADVANTAGE;

  // AI 예측 성적표에 쌓인 "기대 득점 vs 실제 득점" 오차 패턴을 반영해
  // 기대 득점을 자동으로 보정합니다(표본이 부족하면 보정 계수는 1로 유지됩니다).
  const correction = getAutoCorrectionFactors();
  const expectedHomeGoals = rawExpectedHomeGoals * correction.homeFactor;
  const expectedAwayGoals = rawExpectedAwayGoals * correction.awayFactor;

  const { grid, total, homeWinPct, drawPct, awayWinPct } = computePoissonGrid(expectedHomeGoals, expectedAwayGoals);

  const sortedGrid = grid.slice().sort((a, b) => b.p - a.p);
  const topScorelines = sortedGrid.slice(0, 3).map(g => ({
    home: g.h, away: g.a, pct: (g.p / total) * 100
  }));

  return {
    expectedHomeGoals, expectedAwayGoals,
    rawExpectedHomeGoals, rawExpectedAwayGoals,
    homeWinPct, drawPct, awayWinPct,
    topScorelines,
    predictedHomeGoals: topScorelines[0].home,
    predictedAwayGoals: topScorelines[0].away,
    homeAttack: homeS.attack, homeDefense: homeS.defense,
    awayAttack: awayS.attack, awayDefense: awayS.defense,
    leagueAvgGoals,
    correctionApplied: correction.active,
    homeCorrectionFactor: correction.homeFactor,
    awayCorrectionFactor: correction.awayFactor,
    correctionSampleSize: correction.n
  };
}

// 위 확률 계산 결과 + 순위/최근폼을 엮어서 자연어 코멘트를 자동 생성합니다.
// (진짜 LLM이 아니라, 수치 차이 구간에 따라 미리 정해둔 표현을 조합하는 규칙 기반 코멘트입니다.)
function buildAiPredictionNarrative(params) {
  const {
    homeName, awayName, pred, homeRank, awayRank, homeForm, awayForm, isKorean
  } = params;

  const favPct = Math.max(pred.homeWinPct, pred.drawPct, pred.awayWinPct);
  const isDrawFav = pred.drawPct === favPct;
  const homeFav = !isDrawFav && pred.homeWinPct >= pred.awayWinPct;
  const favName = isDrawFav ? null : (homeFav ? homeName : awayName);
  const favPctRounded = Math.round(favPct);

  function formWDL(form) {
    if (!form || !form.recentForm || !form.recentForm.length) return null;
    let w = 0, d = 0, l = 0;
    form.recentForm.forEach(m => {
      if (m.result === 'W') w++; else if (m.result === 'D') d++; else l++;
    });
    return { w, d, l, n: form.recentForm.length };
  }
  const hForm = formWDL(homeForm);
  const aForm = formWDL(awayForm);

  const lines = [];

  if (isDrawFav) {
    lines.push(isKorean
      ? `두 팀의 전력이 팽팽해 무승부 확률(${favPctRounded}%)이 가장 높게 나옵니다.`
      : `Both sides look evenly matched — a draw is the single most likely result (${favPctRounded}%).`);
  } else if (favPctRounded < 45) {
    lines.push(isKorean
      ? `${favName} 쪽이 근소하게 앞서지만(승률 ${favPctRounded}%) 어느 쪽으로도 기울 수 있는 접전으로 보입니다.`
      : `${favName} has a slight edge (${favPctRounded}% win chance), but this looks like a close, even contest.`);
  } else if (favPctRounded < 60) {
    lines.push(isKorean
      ? `${favName}이(가) 다소 우세한 것으로 예측됩니다(승률 ${favPctRounded}%).`
      : `${favName} is projected as the moderate favorite (${favPctRounded}% win chance).`);
  } else {
    lines.push(isKorean
      ? `${favName}의 우세가 뚜렷한 경기입니다(승률 ${favPctRounded}%).`
      : `${favName} looks like a clear favorite here (${favPctRounded}% win chance).`);
  }

  // 공수 지수 비교
  const atkDiff = pred.homeAttack - pred.awayAttack;
  if (Math.abs(atkDiff) >= 0.15) {
    const strongerAtk = atkDiff > 0 ? homeName : awayName;
    lines.push(isKorean
      ? `${strongerAtk}의 공격력 지수가 리그 평균 대비 더 높아 득점 기대치를 끌어올립니다.`
      : `${strongerAtk}'s attack rating sits well above league average, lifting its expected goals.`);
  }
  const defDiff = pred.awayDefense - pred.homeDefense; // 값이 낮을수록(실점 적을수록) 수비가 좋음
  if (Math.abs(defDiff) >= 0.15) {
    const strongerDef = defDiff > 0 ? homeName : awayName;
    lines.push(isKorean
      ? `${strongerDef}의 실점률이 낮은 편이라 상대 공격을 억제할 가능성이 있습니다.`
      : `${strongerDef} concedes at a below-average rate, which could keep the opposition quiet.`);
  }

  // 순위 비교
  if (homeRank && awayRank && homeRank !== awayRank) {
    const higher = homeRank < awayRank ? homeName : awayName;
    const gap = Math.abs(homeRank - awayRank);
    if (gap >= 3) {
      lines.push(isKorean
        ? `순위상으로도 ${higher}이(가) ${gap}계단 앞서 있어 이변이 없다면 순위대로 흐를 가능성이 있습니다.`
        : `${higher} also sits ${gap} places higher in the table, so the standings favor the same outcome.`);
    }
  }

  // 최근 폼 비교
  if (hForm && aForm) {
    const hGood = hForm.w >= Math.ceil(hForm.n * 0.6);
    const aGood = aForm.w >= Math.ceil(aForm.n * 0.6);
    if (hGood && !aGood) {
      lines.push(isKorean
        ? `${homeName}은(는) 최근 ${hForm.n}경기 ${hForm.w}승으로 상승세라는 점도 긍정적인 요소입니다.`
        : `${homeName} also arrives in good form, with ${hForm.w} wins in its last ${hForm.n} games.`);
    } else if (aGood && !hGood) {
      lines.push(isKorean
        ? `${awayName}은(는) 최근 ${aForm.n}경기 ${aForm.w}승으로 상승세라는 점도 변수입니다.`
        : `${awayName} arrives in good form too, with ${aForm.w} wins in its last ${aForm.n} games — a potential upset factor.`);
    }
  }

  lines.push(isKorean
    ? `예상 스코어는 ${homeName} ${pred.predictedHomeGoals} : ${pred.predictedAwayGoals} ${awayName}입니다.`
    : `Most likely scoreline: ${homeName} ${pred.predictedHomeGoals} - ${pred.predictedAwayGoals} ${awayName}.`);

  return lines;
}

// ============================================================
// AI 예측 적중률 트래커 (computeAiPredictionTrackRecord)
// ------------------------------------------------------------
// "지금까지 쌓인 실제 결과를 바탕으로, 그 경기가 열리기 '직전'까지의
// 데이터만 가지고 predictSingleMatch와 동일한 포아송 모델을 돌렸다면
// 어떤 예측이 나왔을까"를 라운드 순서대로 재현(백테스트)한 뒤,
// 실제 스코어와 비교해 적중률을 계산합니다.
//
// 별도 저장소 없이도 매번 roundsData 전체를 훑어 재계산하기 때문에,
// 새 라운드 결과가 roundsData에 추가되기만 하면 트랙레코드도 자동으로
// 함께 늘어납니다.
//
// 반환값:
//   rows: 경기별 { weekNum, home/away 정보, 예측 확률/스코어,
//                  실제 스코어, wdlCorrect, exactScoreCorrect,
//                  goalErrorHome/Away, lowConfidence }
//   summary: 표본이 아직 부족한(=두 팀 다 이전 경기 데이터가 0경기인)
//            개막 라운드를 제외한 통계
//   summaryAll: 개막 라운드까지 포함한 전체 통계(참고용)
// ============================================================
function computeAiPredictionTrackRecord() {
  const state = {};
  leagueData.forEach(t => { state[t.nameEn] = { played: 0, gf: 0, ga: 0 }; });

  const roundKeys = Object.keys(roundsData).sort((a, b) => {
    return parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10);
  });

  function strengthsFromState() {
    let totalGoals = 0, totalGames = 0;
    Object.values(state).forEach(s => { totalGoals += s.gf; totalGames += s.played; });
    const leagueAvgGoals = totalGames > 0 ? totalGoals / totalGames : 1.3;
    const strengths = {};
    Object.keys(state).forEach(nameEn => {
      const s = state[nameEn];
      const gfpg = s.played > 0 ? s.gf / s.played : leagueAvgGoals;
      const gapg = s.played > 0 ? s.ga / s.played : leagueAvgGoals;
      strengths[nameEn] = {
        attack: Math.max(0.25, gfpg / leagueAvgGoals),
        defense: Math.max(0.25, gapg / leagueAvgGoals)
      };
    });
    return { strengths, leagueAvgGoals };
  }

  const rows = [];
  // 자동 보정 계수를 그 라운드 '직전'까지 쌓인 오차만으로 다시 계산하기 위한
  // 누적치입니다(walk-forward). lowConfidence 경기(개막 라운드처럼 양 팀 다
  // 데이터가 없던 경기)는 모델이 자기 자신을 보정할 근거로 삼기엔 신뢰도가
  // 낮으므로 애초에 집계에서 제외합니다.
  const correctionTotals = { expHome: 0, actHome: 0, expAway: 0, actAway: 0, n: 0 };

  roundKeys.forEach((roundKey, idx) => {
    const weekNum = idx + 1;
    const matches = roundsData[roundKey] || [];
    // 이 라운드가 시작되기 '직전'까지 누적된 데이터로 강도 지수를 계산합니다.
    const { strengths, leagueAvgGoals } = strengthsFromState();
    // 이 라운드를 예측하는 시점의 자동 보정 계수 — 역시 이 라운드 이전까지
    // 쌓인 오차만 사용하므로 미래 결과를 미리 들여다보지 않습니다.
    const correctionForThisRound = computeCorrectionFromTotals(correctionTotals);

    const roundRows = [];

    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (!m.homeEn || !m.awayEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

      const homeHasHistory = state[m.homeEn] && state[m.homeEn].played > 0;
      const awayHasHistory = state[m.awayEn] && state[m.awayEn].played > 0;
      // 두 팀 다 이전 경기 기록이 전혀 없는 개막 라운드는 사실상
      // "홈 어드밴티지만 반영된" 예측이라 통계에서는 참고용으로만 취급합니다.
      const lowConfidence = !(homeHasHistory && awayHasHistory);

      const homeS = strengths[m.homeEn] || { attack: 1, defense: 1 };
      const awayS = strengths[m.awayEn] || { attack: 1, defense: 1 };

      const expectedHomeGoals = leagueAvgGoals * homeS.attack * awayS.defense * HOME_ADVANTAGE;
      const expectedAwayGoals = leagueAvgGoals * awayS.attack * homeS.defense * AWAY_DISADVANTAGE;

      const raw = computePoissonGrid(expectedHomeGoals, expectedAwayGoals);
      const actualResult = m.homeScore > m.awayScore ? 'H' : (m.homeScore < m.awayScore ? 'A' : 'D');
      let predictedResult = 'D';
      if (raw.homeWinPct >= raw.drawPct && raw.homeWinPct >= raw.awayWinPct) predictedResult = 'H';
      else if (raw.awayWinPct >= raw.drawPct && raw.awayWinPct >= raw.homeWinPct) predictedResult = 'A';

      // 같은 경기를 그 시점까지 쌓인 자동 보정 계수로 다시 예측했다면 어땠을지도
      // 함께 계산해서, 트랙레코드에서 "보정 적용 시" 성적을 비교할 수 있게 합니다.
      const correctedExpectedHomeGoals = expectedHomeGoals * correctionForThisRound.homeFactor;
      const correctedExpectedAwayGoals = expectedAwayGoals * correctionForThisRound.awayFactor;
      const corrected = computePoissonGrid(correctedExpectedHomeGoals, correctedExpectedAwayGoals);
      let correctedPredictedResult = 'D';
      if (corrected.homeWinPct >= corrected.drawPct && corrected.homeWinPct >= corrected.awayWinPct) correctedPredictedResult = 'H';
      else if (corrected.awayWinPct >= corrected.drawPct && corrected.awayWinPct >= corrected.homeWinPct) correctedPredictedResult = 'A';

      roundRows.push({
        roundKey, weekNum,
        homeEn: m.homeEn, homeKo: m.homeKo, awayEn: m.awayEn, awayKo: m.awayKo,
        homeScore: m.homeScore, awayScore: m.awayScore,
        predictedHomeGoals: raw.bestH, predictedAwayGoals: raw.bestA,
        homeWinPct: raw.homeWinPct, drawPct: raw.drawPct, awayWinPct: raw.awayWinPct,
        predictedResult, actualResult,
        wdlCorrect: predictedResult === actualResult,
        exactScoreCorrect: raw.bestH === m.homeScore && raw.bestA === m.awayScore,
        expectedHomeGoals, expectedAwayGoals,
        goalErrorHome: Math.abs(expectedHomeGoals - m.homeScore),
        goalErrorAway: Math.abs(expectedAwayGoals - m.awayScore),
        lowConfidence,
        // ----- 자동 보정 적용 시 (walk-forward, 이 라운드 이전 데이터만 사용) -----
        correctionActive: correctionForThisRound.active,
        homeCorrectionFactor: correctionForThisRound.homeFactor,
        awayCorrectionFactor: correctionForThisRound.awayFactor,
        correctedPredictedHomeGoals: corrected.bestH,
        correctedPredictedAwayGoals: corrected.bestA,
        correctedPredictedResult,
        correctedWdlCorrect: correctedPredictedResult === actualResult,
        correctedExactScoreCorrect: corrected.bestH === m.homeScore && corrected.bestA === m.awayScore,
        correctedGoalErrorHome: Math.abs(correctedExpectedHomeGoals - m.homeScore),
        correctedGoalErrorAway: Math.abs(correctedExpectedAwayGoals - m.awayScore)
      });
    });

    rows.push(...roundRows);

    // 예측이 끝난 뒤에야 이번 라운드 결과를 팀 상태와 보정 누적치에 반영합니다.
    // (다음 라운드부터는 이 결과까지 포함해 다시 예측 + 다시 보정)
    roundRows.forEach(r => {
      if (r.lowConfidence) return;
      correctionTotals.expHome += r.expectedHomeGoals;
      correctionTotals.actHome += r.homeScore;
      correctionTotals.expAway += r.expectedAwayGoals;
      correctionTotals.actAway += r.awayScore;
      correctionTotals.n += 1;
    });
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (!m.homeEn || !m.awayEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
      const home = state[m.homeEn], away = state[m.awayEn];
      if (!home || !away) return;
      home.played += 1; away.played += 1;
      home.gf += m.homeScore; home.ga += m.awayScore;
      away.gf += m.awayScore; away.ga += m.homeScore;
    });
  });

  function summarize(list, corrected) {
    const n = list.length;
    if (!n) return null;
    const wdlKey = corrected ? 'correctedWdlCorrect' : 'wdlCorrect';
    const exactKey = corrected ? 'correctedExactScoreCorrect' : 'exactScoreCorrect';
    const errHomeKey = corrected ? 'correctedGoalErrorHome' : 'goalErrorHome';
    const errAwayKey = corrected ? 'correctedGoalErrorAway' : 'goalErrorAway';
    const wdlCorrectCount = list.filter(r => r[wdlKey]).length;
    const exactCount = list.filter(r => r[exactKey]).length;
    const avgGoalError = list.reduce((sum, r) => sum + (r[errHomeKey] + r[errAwayKey]) / 2, 0) / n;
    return {
      n,
      wdlAccuracyPct: (wdlCorrectCount / n) * 100,
      exactScoreAccuracyPct: (exactCount / n) * 100,
      avgGoalError
    };
  }

  const confidentRows = rows.filter(r => !r.lowConfidence);

  return {
    rows,
    summary: summarize(confidentRows, false),
    summaryAll: summarize(rows, false),
    // "만약 자동 보정을 계속 켜뒀다면" 시나리오의 walk-forward 백테스트 성적.
    summaryCorrected: summarize(confidentRows, true),
    summaryAllCorrected: summarize(rows, true),
    // 지금 이 순간, 앞으로의 예측(predictSingleMatch/runMonteCarloSimulation)에
    // 실제로 적용될 최신 보정 계수입니다(전체 데이터 기준).
    currentCorrection: computeCorrectionFromTotals(correctionTotals)
  };
}
