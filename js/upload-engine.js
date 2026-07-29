/* ══════════════════════════════════════════
   js/upload-engine.js — محرك الرفع + بطاقة الرفع
   منقول من index.html بدون أي تغيير في المنطق —
   القسم ده مستقل تماماً (صفر اعتماد على db/auth/currentUser/toast).
══════════════════════════════════════════ */
function uploadToCloudinaryWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "university_upload");
    const xhr = new XMLHttpRequest();
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      const dl = e.loaded - lastLoaded;
      const speed = dt > 0 ? dl / dt : 0;
      lastLoaded = e.loaded;
      lastTime = now;
      const pct = Math.round((e.loaded / e.total) * 100);
      const remaining = speed > 0 ? (e.total - e.loaded) / speed : null;
      onProgress({ pct, loaded: e.loaded, total: e.total, speed, remaining, phase: "uploading" });
    });

    xhr.addEventListener("load", () => {
      onProgress({ pct: 100, phase: "processing" });
      try {
        const data = JSON.parse(xhr.responseText);
        if (!data.secure_url) { reject(new Error("Upload failed")); return; }
        const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");
        const url = isPDF ? data.secure_url.replace("/image/upload/", "/raw/upload/") : data.secure_url;
        resolve({ url, data });
      } catch(e) { reject(e); }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Aborted")));
    xhr.open("POST", "https://api.cloudinary.com/v1_1/dnbvvfita/auto/upload");
    xhr.send(formData);
  });
}

function _getFileCategory(file) {
  const t = file.type; const n = file.name.toLowerCase();
  if (t === "image/gif") return "gif";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (t.includes("word") || n.match(/\.(doc|docx)$/)) return "doc";
  if (t.includes("excel") || t.includes("spreadsheet") || n.match(/\.(xls|xlsx)$/)) return "doc";
  if (t.includes("presentation") || n.match(/\.(ppt|pptx)$/)) return "doc";
  if (n.match(/\.(zip|rar|7z|gz|tar)$/)) return "zip";
  return "file";
}

function _fileTypeIcon(cat) {
  const icons = { image:"fa-image", gif:"fa-image", audio:"fa-microphone", video:"fa-film",
    pdf:"fa-file-pdf", doc:"fa-file-word", zip:"fa-file-zipper", file:"fa-file" };
  return icons[cat] || "fa-file";
}

function _formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/(1024*1024)).toFixed(2) + " MB";
}

function _formatSpeed(bytesPerSec) {
  if (bytesPerSec < 1024) return Math.round(bytesPerSec) + " B/s";
  if (bytesPerSec < 1024*1024) return Math.round(bytesPerSec/1024) + " KB/s";
  return (bytesPerSec/(1024*1024)).toFixed(1) + " MB/s";
}

function _formatEta(sec) {
  if (!sec || sec < 1) return "";
  if (sec < 60) return Math.ceil(sec) + "ث";
  return Math.ceil(sec/60) + "د";
}

function _buildUploadCard(file) {
  const cat = _getFileCategory(file);
  const container = document.getElementById("chatMessages");
  const row = document.createElement("div");
  row.className = "upload-progress-row";
  row.id = "_uprow_" + Date.now();

  // Icon / preview inner HTML
  let iconInner = `<i class="fa-solid ${_fileTypeIcon(cat)}"></i>`;
  if (cat === "image" || cat === "gif") {
    const objUrl = URL.createObjectURL(file);
    iconInner = `<img class="up-thumb" src="${objUrl}" alt="" id="_upthumb_${row.id}">
      <div class="up-spin-overlay"><div class="up-spin-ring"></div></div>`;
    // Clean up obj URL after 30s
    setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
  } else if (cat === "audio") {
    iconInner = `<div class="up-audio-wave">
      <div class="up-wave-bar"></div><div class="up-wave-bar"></div>
      <div class="up-wave-bar"></div><div class="up-wave-bar"></div>
      <div class="up-wave-bar"></div><div class="up-wave-bar"></div>
    </div>`;
  } else if (cat === "pdf") {
    iconInner = `<i class="fa-solid fa-file-pdf"></i>
      <div class="up-pdf-pages">
        <div class="up-pdf-page"></div><div class="up-pdf-page"></div><div class="up-pdf-page"></div>
      </div>`;
  }

  row.innerHTML = `
    <div class="upload-progress-card uploading" id="_upcard_${row.id}">
      <div class="up-file-row">
        <div class="up-icon-wrap type-${cat}">${iconInner}</div>
        <div class="up-info">
          <div class="up-filename">${file.name}</div>
          <div class="up-meta-row">
            <span class="up-filesize">${_formatSize(file.size)}</span>
            <span class="up-separator">·</span>
            <span class="up-speed" id="_upspeed_${row.id}">—</span>
            <span class="up-separator" id="_upsepeta_${row.id}">·</span>
            <span class="up-eta" id="_upeta_${row.id}"></span>
          </div>
        </div>
      </div>
      <div class="up-progress-wrap">
        <div class="up-progress-track">
          <div class="up-progress-fill" id="_upbar_${row.id}" style="width:0%"></div>
        </div>
        <div class="up-progress-row">
          <span class="up-pct" id="_uppct_${row.id}">0%</span>
          <span class="up-status-text" id="_upstatus_${row.id}">جاري الرفع...</span>
        </div>
      </div>
    </div>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  return {
    rowId: row.id,
    update(prog) {
      const bar    = document.getElementById(`_upbar_${row.id}`);
      const pct    = document.getElementById(`_uppct_${row.id}`);
      const status = document.getElementById(`_upstatus_${row.id}`);
      const speed  = document.getElementById(`_upspeed_${row.id}`);
      const eta    = document.getElementById(`_upeta_${row.id}`);
      if (!bar) return;
      if (prog.phase === "processing") {
        bar.style.width = "100%";
        pct.textContent = "100%";
        status.textContent = "معالجة الملف...";
        speed.textContent = "—";
        if (eta) eta.textContent = "";
        return;
      }
      bar.style.width = prog.pct + "%";
      pct.textContent = prog.pct + "%";
      if (prog.speed > 0) speed.textContent = _formatSpeed(prog.speed);
      if (prog.remaining != null) {
        const etaTxt = _formatEta(prog.remaining);
        if (eta) { eta.textContent = etaTxt ? "متبقي " + etaTxt : ""; }
        const sep = document.getElementById(`_upsepeta_${row.id}`);
        if (sep) sep.style.display = etaTxt ? "" : "none";
      }
      status.textContent = "جاري الرفع...";
    },
    markDone() {
      const card = document.getElementById(`_upcard_${row.id}`);
      const status = document.getElementById(`_upstatus_${row.id}`);
      const bar  = document.getElementById(`_upbar_${row.id}`);
      const pct  = document.getElementById(`_uppct_${row.id}`);
      if (!card) return;
      card.classList.remove("uploading");
      card.classList.add("done");
      if (bar) bar.style.width = "100%";
      if (pct) pct.innerHTML = `<span class="up-done-icon"><i class="fa-solid fa-check"></i></span>`;
      if (status) status.textContent = "اكتمل الإرسال ✓";
      // fade out and remove after transition
      setTimeout(() => {
        if (card) card.classList.add("fade-out");
        setTimeout(() => { row.remove(); }, 450);
      }, 1400);
    },
    markFailed(reason) {
      const card = document.getElementById(`_upcard_${row.id}`);
      const status = document.getElementById(`_upstatus_${row.id}`);
      const pct  = document.getElementById(`_uppct_${row.id}`);
      if (!card) return;
      card.classList.remove("uploading");
      card.classList.add("failed");
      if (pct) pct.textContent = "✗";
      if (status) status.textContent = "فشل الإرسال" + (reason ? ": " + reason : "");
      setTimeout(() => {
        if (card) card.classList.add("fade-out");
        setTimeout(() => { row.remove(); }, 450);
      }, 3000);
    }
  };
}

window.uploadToCloudinaryWithProgress = uploadToCloudinaryWithProgress;
window._buildUploadCard = _buildUploadCard;
window._getFileCategory = _getFileCategory;
window._formatSize = _formatSize;
