async function updateDashboard() {
  const res = await fetch("/api/network");
  const data = await res.json();

  const status = document.querySelector(".status");

  if (!data.connected) {
    status.textContent = "No Network Connection";
    status.style.background = "#ef4444";
  } else {
    status.textContent = "Connected";
    status.style.background = "#0ea5e9";
  }

  document.getElementById("ssid").textContent = data.ssid;
  document.getElementById("adapter").textContent = data.adapter;

  signal.textContent = data.signal;
  latency.textContent = data.latency;
  download.textContent = data.download;
  upload.textContent = data.upload;

  const quality = Math.max(
    0,
    Math.min(100, Math.round(data.signal * 0.5 + data.download - data.latency * 0.3))
  );

  document.getElementById("qualityScore").textContent = quality;
  document.getElementById("qualityLabel").textContent =
    quality >= 70 ? "Excellent" : quality >= 40 ? "Good" : "Poor";

  const max = 440;
  document.querySelector(".progress").style.strokeDashoffset =
    max - (quality / 100) * max;
}

function exportLog() {
  window.location.href = "/api/export";
}

updateDashboard();
setInterval(updateDashboard, 8000);
