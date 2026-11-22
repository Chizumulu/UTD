(function () {
  "use strict";

  var SNOOZE_KEY = "utd-match-alerts-prompt-snoozed-until";
  var NEVER_KEY = "utd-match-alerts-prompt-never";
  var SERVICE_WORKER_SCOPE = "/UTD/";

  function isStandalonePwa() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function isKorean() {
    return typeof window.isKorean === "boolean"
      ? window.isKorean
      : !/^en(?:-|$)/i.test(document.documentElement.lang || "ko");
  }

  function addPrompt() {
    if (document.getElementById("pwaMatchAlertsPrompt")) return;

    var korean = isKorean();
    var dialog = document.createElement("dialog");
    dialog.id = "pwaMatchAlertsPrompt";
    dialog.className = "match-alert-confirm";
    dialog.setAttribute("aria-labelledby", "pwaMatchAlertsTitle");
    dialog.setAttribute("aria-describedby", "pwaMatchAlertsDescription");
    dialog.innerHTML =
      '<h2 id="pwaMatchAlertsTitle"></h2>' +
      '<p id="pwaMatchAlertsDescription"></p>' +
      '<div class="match-alert-confirm-actions">' +
        '<button type="button" data-action="enable"></button>' +
        '<button type="button" data-action="snooze"></button>' +
        '<button type="button" data-action="never"></button>' +
      '</div>';

    dialog.querySelector("h2").textContent = korean
      ? "경기 알림을 받아보세요"
      : "Get match alerts";
    dialog.querySelector("p").textContent = korean
      ? "경기 시작 전 알림과 득점·경기 중 주요 상황, 경기 종료 및 최종 스코어를 알려드려요."
      : "Get pre-match reminders, goal and match updates, and the final score when the game ends.";
    dialog.querySelector('[data-action="enable"]').textContent = korean ? "알림 받기" : "Get alerts";
    dialog.querySelector('[data-action="enable"]').className = "match-alert-confirm-repair";
    dialog.querySelector('[data-action="snooze"]').textContent = korean ? "7일간 닫기" : "Close for 7 days";
    dialog.querySelector('[data-action="never"]').textContent = korean ? "다시 보지 않기" : "Don't show again";

    dialog.querySelector('[data-action="enable"]').addEventListener("click", function () {
      dialog.close();
      if (typeof window.enableMatchAlerts === "function") window.enableMatchAlerts();
    });
    dialog.querySelector('[data-action="snooze"]').addEventListener("click", function () {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      dialog.close();
    });
    dialog.querySelector('[data-action="never"]').addEventListener("click", function () {
      localStorage.setItem(NEVER_KEY, "1");
      dialog.close();
    });
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  async function shouldPrompt() {
    if (!isStandalonePwa() || !window.UTD_PUSH_API_URL) return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission === "denied") return false;
    if (localStorage.getItem(NEVER_KEY) === "1") return false;

    var snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snoozedUntil > Date.now()) return false;
    if (snoozedUntil) localStorage.removeItem(SNOOZE_KEY);

    var registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
    var subscription = registration && registration.pushManager
      ? await registration.pushManager.getSubscription()
      : null;
    return !subscription;
  }

  document.addEventListener("DOMContentLoaded", function () {
    window.setTimeout(async function () {
      try {
        if (await shouldPrompt()) {
          var dialog = addPrompt();
          if (dialog && typeof dialog.showModal === "function") dialog.showModal();
        }
      } catch (error) {
        console.warn("Could not check PWA match alert status:", error);
      }
    }, 1800);
  });
})();
