(function () {
  "use strict";

  var API_BASE = (window.UTD_PUSH_API_URL || "").trim().replace(/\/+$/, "");
  var SERVICE_WORKER_URL = "/UTD/OneSignalSDKWorker.js";
  var SERVICE_WORKER_SCOPE = "/UTD/";
  var cachedConfig = null;
  var buttonStatusRequest = 0;

  function isKoreanUi() {
    return typeof window.isKorean === "undefined" ? true : !!window.isKorean;
  }

  function setLabel(label, ko, en) {
    if (!label) return;
    label.setAttribute("data-ko", ko);
    label.setAttribute("data-en", en);
    label.textContent = isKoreanUi() ? ko : en;
  }

  function notice(titleKo, titleEn, bodyKo, bodyEn, detail) {
    var title = isKoreanUi() ? titleKo : titleEn;
    var body = isKoreanUi() ? bodyKo : bodyEn;
    if (typeof window.showNoticeSheet === "function") {
      window.showNoticeSheet({ title: title, desc: body, detail: detail || "" });
    } else {
      window.alert([title, body, detail].filter(Boolean).join("\n\n"));
    }
  }

  function toast(ko, en) {
    var message = isKoreanUi() ? ko : en;
    if (typeof window.showToast === "function") window.showToast(message);
    else window.alert(message);
  }

  async function api(path, options) {
    if (!API_BASE) throw new Error("Push API URL is not configured.");
    var response = await fetch(API_BASE + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      mode: "cors",
      cache: "no-store"
    }, options || {}));
    var value = null;
    try { value = await response.json(); } catch (_error) {}
    if (!response.ok) throw new Error((value && value.error) || ("HTTP " + response.status));
    return value;
  }

  async function getConfig() {
    if (!cachedConfig) cachedConfig = await api("/api/push/config", { method: "GET" });
    if (!cachedConfig || !cachedConfig.publicKey) throw new Error("Push server did not return a VAPID public key.");
    return cachedConfig;
  }

  function base64UrlToBytes(value) {
    var padding = "=".repeat((4 - value.length % 4) % 4);
    var base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var result = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) result[i] = raw.charCodeAt(i);
    return result;
  }

  function arrayBufferToBase64Url(value) {
    var bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    var binary = "";
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function subscriptionUsesKey(subscription, publicKey) {
    try {
      var currentKey = subscription.options && subscription.options.applicationServerKey;
      return !!currentKey && arrayBufferToBase64Url(currentKey) === publicKey;
    } catch (_error) {
      return false;
    }
  }

  async function getRegistration(registerIfMissing) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push.");
    }
    var registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
    if (!registration && registerIfMissing) {
      registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE });
      await navigator.serviceWorker.ready;
      registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE) || registration;
    }
    return registration;
  }

  async function getMatchingSubscription(config) {
    var registration = await getRegistration(false);
    if (!registration || !registration.pushManager) return null;
    var subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;
    if (!subscriptionUsesKey(subscription, config.publicKey)) return null;
    return subscription;
  }

  function sendSubscription(path, subscription) {
    return api("/api/push/" + path, {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
  }

  async function hasRegisteredMatchAlerts() {
    if (Notification.permission === "denied") return false;
    var config = await getConfig();
    var subscription = await getMatchingSubscription(config);
    if (!subscription) return false;
    var status = await sendSubscription("subscriptions/status", subscription);
    if (!status || typeof status.registered !== "boolean") {
      throw new Error("Push server did not return the subscription status.");
    }
    return status.registered;
  }

  async function registerSubscription(subscription) {
    var result = await sendSubscription("subscriptions", subscription);
    if (!result || result.ok !== true) {
      throw new Error("Push server did not confirm registration.");
    }
    buttonStatusRequest += 1;
    renderButton(true, null);
  }

  function renderButton(on, error) {
    var button = document.getElementById("pushAlertBtn");
    var label = document.getElementById("pushAlertLbl");
    if (!button || !label) return;
    if (!API_BASE || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      button.style.display = "none";
      return;
    }
    if (error) {
      setLabel(label, "알림 서버에 연결할 수 없음", "Push server unavailable");
      button.disabled = true;
      button.title = error;
    } else {
      var blocked = Notification.permission === "denied";
      setLabel(
        label,
        blocked ? "알림 차단됨 (브라우저 설정)" : (on ? "경기 알림 켜짐" : "경기 알림 받기"),
        blocked ? "Blocked in browser settings" : (on ? "Match alerts on" : "Match alerts")
      );
      button.disabled = blocked;
      button.title = "";
    }
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-on", !!on);
    button.style.display = "";
  }

  async function refreshButton() {
    if (!API_BASE || !("Notification" in window) ||
        !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    var request = ++buttonStatusRequest;
    try {
      var registered = await hasRegisteredMatchAlerts();
      if (request === buttonStatusRequest) renderButton(registered, null);
    } catch (error) {
      if (request === buttonStatusRequest) {
        renderButton(false, error && error.message ? error.message : String(error));
      }
    }
  }

  async function toggleMatchAlerts() {
    if (!API_BASE) {
      notice("알림 서버가 아직 설정되지 않았어요", "Push server is not configured", "관리자가 Cloudflare Worker 주소를 연결해야 합니다.", "The site maintainer must connect the Cloudflare Worker URL.");
      return;
    }
    try {
      var registered = await hasRegisteredMatchAlerts();
      var dialog = document.getElementById(registered ? "disableMatchAlertsDialog" : "enableMatchAlertsDialog");
      if (dialog && typeof dialog.showModal === "function") {
        dialog.showModal();
      } else if (window.confirm(registered ? "경기 알림을 끄시겠어요?" : "득점과 경기 상태 알림을 받으시겠어요?")) {
        if (registered) await confirmDisableMatchAlerts();
        else await enableMatchAlerts();
      }
    } catch (error) {
      notice("알림 상태를 확인하지 못했어요", "Could not check alert status", "잠시 후 다시 시도해 주세요.", "Please try again in a moment.", error.message || String(error));
    }
  }

  function closeEnableMatchAlertsDialog() {
    var dialog = document.getElementById("enableMatchAlertsDialog");
    if (dialog && dialog.open) dialog.close();
  }

  function closeDisableMatchAlertsDialog() {
    var dialog = document.getElementById("disableMatchAlertsDialog");
    if (dialog && dialog.open) dialog.close();
  }

  async function enableMatchAlerts() {
    closeEnableMatchAlertsDialog();
    if (Notification.permission === "denied") {
      notice("브라우저에서 알림이 차단돼 있어요", "Notifications are blocked", "브라우저 설정에서 이 사이트의 알림을 허용해 주세요.", "Allow notifications for this site in your browser settings.");
      return;
    }

    try {
      var permission = Notification.permission;
      if (permission !== "granted") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refreshButton();
        return;
      }

      var config = await getConfig();
      var registration = await getRegistration(true);
      var subscription = await registration.pushManager.getSubscription();
      if (subscription && !subscriptionUsesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(config.publicKey)
        });
      }

      await registerSubscription(subscription);
      toast("이 기기에서 경기 알림을 받습니다.", "Match alerts are enabled on this device.");
    } catch (error) {
      console.error("Web Push subscription failed:", error);
      await refreshButton();
      notice("알림을 켜지 못했어요", "Could not enable alerts", "잠시 후 다시 시도해 주세요.", "Please try again in a moment.", error.message || String(error));
    }
  }

  async function confirmDisableMatchAlerts() {
    closeDisableMatchAlertsDialog();
    try {
      var config = await getConfig();
      var subscription = await getMatchingSubscription(config);
      if (subscription) {
        try {
          await api("/api/push/subscriptions", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        } finally {
          await subscription.unsubscribe();
        }
      }
      await refreshButton();
      toast("이 기기의 경기 알림을 껐어요.", "Match alerts are off on this device.");
    } catch (error) {
      await refreshButton();
      notice("알림을 끄지 못했어요", "Could not turn off alerts", "잠시 후 다시 시도해 주세요.", "Please try again in a moment.", error.message || String(error));
    }
  }

  async function repairMatchAlerts() {
    closeDisableMatchAlertsDialog();
    try {
      var config = await getConfig();
      var registration = await getRegistration(true);
      var subscription = await registration.pushManager.getSubscription();
      if (subscription && !subscriptionUsesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        await enableMatchAlerts();
        return;
      }
      await registerSubscription(subscription);
      toast("이 기기의 알림 연결을 새로 고쳤어요.", "This device's push registration was refreshed.");
    } catch (error) {
      await refreshButton();
      notice("알림 연결을 복구하지 못했어요", "Could not repair push", "잠시 후 다시 시도해 주세요.", "Please try again in a moment.", error.message || String(error));
    }
  }

  window.toggleMatchAlerts = toggleMatchAlerts;
  window.hasRegisteredMatchAlerts = hasRegisteredMatchAlerts;
  window.enableMatchAlerts = enableMatchAlerts;
  window.confirmDisableMatchAlerts = confirmDisableMatchAlerts;
  window.repairMatchAlerts = repairMatchAlerts;
  window.closeEnableMatchAlertsDialog = closeEnableMatchAlertsDialog;
  window.closeDisableMatchAlertsDialog = closeDisableMatchAlertsDialog;
  window.matchAlertNotice = notice;
  window.matchAlertToast = toast;
  window.subscribeMatchAlerts = toggleMatchAlerts;

  document.addEventListener("DOMContentLoaded", refreshButton);
})();
