const video = document.getElementById("cameraVideo");
const canvas = document.getElementById("photoCanvas");
const context = canvas.getContext("2d");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const downloadBtn = document.getElementById("downloadBtn");
const cameraStatus = document.getElementById("cameraStatus");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const liveTag = document.getElementById("liveTag");
const message = document.getElementById("message");
const identificationInput = document.getElementById("identification");
const effectSelect = document.getElementById("effectSelect");
const resultImage = document.getElementById("resultImage");
const resultEmpty = document.getElementById("resultEmpty");
const outputBadge = document.getElementById("outputBadge");

let cameraStream = null;
let lastImageUrl = null;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function cameraIsRunning() {
  return Boolean(cameraStream && cameraStream.getVideoTracks().some(track => track.readyState === "live"));
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMessage("Este navegador não oferece acesso à câmera. Use uma versão atualizada em HTTPS ou localhost.", true);
    return;
  }

  toggleCameraBtn.disabled = true;
  setMessage("Solicitando acesso à câmera...");

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = cameraStream;
    await video.play();

    cameraPlaceholder.hidden = true;
    liveTag.classList.add("is-visible");
    cameraStatus.classList.add("is-on");
    cameraStatus.innerHTML = '<span class="status-dot"></span> Câmera ativa';
    toggleCameraBtn.innerHTML = '<span aria-hidden="true">■</span> Desligar câmera';
    captureBtn.disabled = false;
    setMessage("Câmera ativa. Ajuste a identificação e o efeito antes de capturar.");
  } catch (error) {
    stopCamera(false);

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      setMessage("A permissão da câmera foi negada. Autorize o acesso nas configurações do navegador e tente novamente.", true);
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      setMessage("Nenhuma câmera foi encontrada neste dispositivo. Conecte uma câmera e tente novamente.", true);
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      setMessage("A câmera não está disponível ou está sendo usada por outro aplicativo. Feche outros aplicativos e tente novamente.", true);
    } else {
      setMessage("Não foi possível iniciar a câmera. Verifique a permissão e tente novamente.", true);
    }
  } finally {
    toggleCameraBtn.disabled = false;
  }
}

function stopCamera(showMessage = true) {
  if (cameraStream) {
    // Encerra todas as tracks; esconder o vídeo sozinho não libera a câmera.
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  video.pause();
  video.srcObject = null;
  cameraPlaceholder.hidden = false;
  liveTag.classList.remove("is-visible");
  cameraStatus.classList.remove("is-on");
  cameraStatus.innerHTML = '<span class="status-dot"></span> Câmera desligada';
  toggleCameraBtn.innerHTML = '<span aria-hidden="true">◉</span> Ativar câmera';
  captureBtn.disabled = true;

  if (showMessage) setMessage("Câmera desligada. Você pode ativá-la novamente quando quiser.");
}

function getCanvasFilter(effect) {
  switch (effect) {
    case "grayscale": return "grayscale(100%)";
    case "sepia": return "sepia(85%)";
    case "contrast": return "contrast(1.35) saturate(1.12)";
    default: return "none";
  }
}

function drawOverlay(width, height, name, dateText) {
  const padding = Math.max(18, Math.round(width * 0.035));
  const bandHeight = Math.max(76, Math.round(height * 0.19));

  // Faixa translúcida para manter a identificação legível sobre a foto.
  context.fillStyle = "rgba(5, 8, 10, 0.76)";
  context.fillRect(0, height - bandHeight, width, bandHeight);

  context.fillStyle = "#c8f169";
  context.fillRect(padding, height - bandHeight + padding, 4, bandHeight - padding * 2);

  const titleSize = Math.max(18, Math.round(width * 0.033));
  const dateSize = Math.max(12, Math.round(width * 0.019));
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = "#ffffff";
  context.font = `700 ${titleSize}px Arial, sans-serif`;
  context.fillText(name, padding + 16, height - bandHeight + padding - 1, width - padding * 2 - 20);

  context.fillStyle = "#c8f169";
  context.font = `500 ${dateSize}px Arial, sans-serif`;
  context.fillText(dateText, padding + 16, height - bandHeight + padding + titleSize + 9, width - padding * 2 - 20);

  context.fillStyle = "rgba(255,255,255,.75)";
  context.font = `500 ${Math.max(10, Math.round(width * 0.013))}px Arial, sans-serif`;
  context.textAlign = "right";
  context.fillText("CAMERA PFE STUDIO", width - padding, height - 13);
}

function capturePhoto() {
  if (!cameraIsRunning() || !video.videoWidth || !video.videoHeight) {
    setMessage("Não é possível capturar a foto: ative a câmera e aguarde o vídeo aparecer.", true);
    return;
  }

  const name = identificationInput.value.trim() || "Captura sem identificação";
  const now = new Date();
  const dateText = now.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });

  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;

  // Mantém a composição espelhada para corresponder à prévia da câmera.
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.filter = getCanvasFilter(effectSelect.value);
  context.drawImage(video, 0, 0, width, height);
  context.restore();
  context.filter = "none";

  drawOverlay(width, height, name, `Capturado em ${dateText}`);

  if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
  canvas.toBlob(blob => {
    if (!blob) {
      setMessage("O navegador não conseguiu processar a imagem. Tente novamente.", true);
      return;
    }

    lastImageUrl = URL.createObjectURL(blob);
    resultImage.src = lastImageUrl;
    resultImage.hidden = false;
    resultEmpty.hidden = true;
    downloadBtn.disabled = false;
    outputBadge.textContent = "FOTO PRONTA";
    outputBadge.classList.add("is-ready");
    setMessage("Foto capturada e processada com sucesso. A identificação e a data/hora fazem parte da imagem.");
  }, "image/png");
}

toggleCameraBtn.addEventListener("click", () => {
  if (cameraIsRunning()) {
    stopCamera();
  } else {
    startCamera();
  }
});

captureBtn.addEventListener("click", capturePhoto);

downloadBtn.addEventListener("click", () => {
  if (!lastImageUrl) {
    setMessage("Faça uma captura antes de tentar baixar a imagem.", true);
    return;
  }

  const link = document.createElement("a");
  link.href = lastImageUrl;
  link.download = `camera-pfe-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
});

window.addEventListener("pagehide", () => {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
});
