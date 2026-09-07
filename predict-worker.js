// ===== 리그 예측 전용 Web Worker (Monte Carlo Simulation) =====
// 메인 스레드(=화면)를 막지 않도록, 몬테카를로 시뮬레이션(runMonteCarloSimulation)과
// 그 안에서 쓰이는 Dixon-Coles ρ 추정 등 무거운 수학 연산을 이 워커에서 돌립니다.
//
// data.js는 document/window/localStorage 등 브라우저 DOM API를 전혀 쓰지 않는
// 순수 계산 + 데이터 리터럴이라, 워커 스레드에서도 수정 없이 그대로 불러와 재사용할 수
// 있습니다(importScripts). leagueData, computeAiPredictionTrackRecord,
// generateRemainingFixtures 등 runMonteCarloSimulation이 참조하는 모든 것이
// 이 한 줄로 함께 로드됩니다.
//
// 워커(자기 자신)의 버전과, 워커 안에서 불러올 data.js의 버전은 서로 다를 수 있어서
// (실제로 두 파일을 따로 배포 중) app.js가 워커를 생성할 때 URL에 각각
// ?v=<워커버전>&dataV=<data.js버전> 형태로 함께 실어 보냅니다. index.html의
// window.ASSET_VERSIONS가 그 값들의 유일한 출처이고, 이 파일은 그 값을 그대로
// 넘겨받아 쓸 뿐이라 data.js 버전이 바뀌어도 이 파일은 수정할 필요가 없습니다.
const DATA_VERSION = (function() {
  const match = self.location.search.match(/[?&]dataV=([^&]+)/);
  return match ? match[1] : '007'; // 파라미터가 없는 극히 드문 경우를 위한 폴백
})();
importScripts('data.js?v=' + DATA_VERSION);

self.onmessage = function (e) {
  const { requestId, iterations } = e.data || {};
  try {
    const result = runMonteCarloSimulation(iterations);
    self.postMessage({ requestId, result });
  } catch (err) {
    self.postMessage({ requestId, error: (err && err.message) || String(err) });
  }
};
