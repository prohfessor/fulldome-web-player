"use strict";

/**
 * Application bootstrap and JCEF bridge.
 *
 * FullDomeRenderer.js contains projection and playback logic. This file owns
 * page startup, playlist source resolution and communication with Java.
 */

// These globals form part of the legacy function-based renderer API.
var curVideoEl;
var oldVideoEl;
var curVideoNum = 0;
var vtexture;
var flagStopVideo = false;
var numVideo = 0;
var query = parseQuery();
var is = 0;

/** Sends an event to Java when the page is hosted by JCEF. */
function sendMessage(message) {
    if (typeof window.cefQuery !== "function") return;
    window.cefQuery({
        request: message,
        onSuccess: function () {},
        onFailure: function (code, error) {
            console.error("JCEF query failed:", code, error);
        }
    });
}

function setCount() {
    if (typeof i_slide !== "undefined") sendMessage("cmd:count;" + i_slide);
}

function setTimes(times) {
    sendMessage("cmd:times;" + times);
}

async function readPlaylistText(path) {
    var response = await fetch(path, {cache: "no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status + ": " + path);
    return response.text();
}

/** Resolves a playlist URL or creates one playlist row for a direct media URL. */
async function resolveVideoSource(location) {
    var search = location.search || "";
    var params = new URLSearchParams(search);
    var playlist = params.get("playlist");
    if (playlist) return readPlaylistText(playlist);

    var raw = search.length > 1
        ? decodeURIComponent(search.substring(1))
        : "test.js";
    var lower = raw.toLowerCase();
    if (lower.endsWith(".js") || lower.endsWith(".dome")) {
        return readPlaylistText(raw.replace(/\\/g, "/"));
    }

    var normalized = raw.replace(/\\/g, "/");
    var webRoot = normalized.toLowerCase().indexOf("/www/");
    var url = webRoot >= 0 ? normalized.substring(webRoot + 4) : normalized;
    return "0,0,0,0,," + (url.startsWith("/") ? url : "/" + url);
}

async function startPlayer() {
    var playlistText = await resolveVideoSource(window.location);
    if (!playlistText.trim()) throw new Error("Плейлист пуст");

    videos = new setVideos(playlistText);
    startAnimation();
    document.body.onkeydown = nextSlide;
    document.body.onkeyup = keyup;
    sendMessage("cmd:onload;");
}

// Expose startup helpers for browser diagnostics and future unit tests.
window.PlayerBootstrap = {
    readPlaylistText: readPlaylistText,
    resolveVideoSource: resolveVideoSource,
    startPlayer: startPlayer
};

document.addEventListener("DOMContentLoaded", function () {
    startPlayer().catch(function (error) {
        console.error("Не удалось запустить плеер:", error);
        sendMessage("cmd:error;" + error.message);
    });
});
