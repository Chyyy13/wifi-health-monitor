const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = 3000;

app.use(express.static("public"));

const logFile = path.join(__dirname, "connection-log.csv");

// Create log file if missing
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(
    logFile,
    "Timestamp,Connected,Signal,Latency,Download,Upload\n"
  );
}

// ---- WIFI INFO ----
function getWifiInfo() {
  return new Promise((resolve) => {
    exec("netsh wlan show interfaces", (err, stdout) => {
      if (err || !stdout.includes("State")) {
        return resolve({ connected: false });
      }

      const state = stdout.match(/State\s*:\s*(\w+)/)?.[1];
      const signal = stdout.match(/Signal\s*:\s*(\d+)%/)?.[1];
      const ssid = stdout.match(/SSID\s*:\s*(.+)/)?.[1];
      const adapter = stdout.match(/Name\s*:\s*(.+)/)?.[1];

      resolve({
        connected: state === "connected",
        signal: state === "connected" ? Number(signal) : 0,
        ssid: state === "connected" ? ssid : "No Network",
        adapter: adapter || "Unknown Adapter"
      });
    });
  });
}

// ---- LATENCY ----
function getLatency() {
  return new Promise((resolve) => {
    exec("ping -n 1 8.8.8.8", { timeout: 2000 }, (err, stdout) => {
      if (err) return resolve(0);
      const match = stdout.match(/time[=<](\d+)ms/);
      resolve(match ? Number(match[1]) : 0);
    });
  });
}

// ---- DOWNLOAD ----
function getDownloadSpeed() {
  return new Promise((resolve) => {
    const start = Date.now();
    let bytes = 0;

    const req = https.get("https://speed.hetzner.de/1MB.bin", (res) => {
      res.on("data", (chunk) => (bytes += chunk.length));
      res.on("end", () => {
        const seconds = (Date.now() - start) / 1000;
        resolve(Number(((bytes * 8) / seconds / 1e6).toFixed(1)));
      });
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(0);
    });

    req.on("error", () => resolve(0));
  });
}

// ---- LOG DATA ----
function logData(data) {
  const row = `${new Date().toISOString()},${data.connected},${data.signal},${data.latency},${data.download},${data.upload}\n`;
  fs.appendFileSync(logFile, row);
}

// ---- API ----
app.get("/api/network", async (req, res) => {
  const wifi = await getWifiInfo();

  if (!wifi.connected) {
    const result = {
      connected: false,
      signal: 0,
      latency: 0,
      download: 0,
      upload: 0,
      ssid: wifi.ssid,
      adapter: wifi.adapter
    };
    logData(result);
    return res.json(result);
  }

  const latency = await getLatency();
  const download = await getDownloadSpeed();
  const upload = Math.max(5, Math.round(download * 0.6));

  const result = {
    connected: true,
    signal: wifi.signal,
    latency,
    download,
    upload,
    ssid: wifi.ssid,
    adapter: wifi.adapter
  };

  logData(result);
  res.json(result);
});

// ---- EXPORT CSV ----
app.get("/api/export", (req, res) => {
  res.download(logFile);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
