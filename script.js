
const imageInput = document.getElementById("imageInput");
const fileInfo = document.getElementById("fileInfo");
const inputPreview = document.getElementById("inputPreview");
const previewWrap = document.getElementById("previewWrap");
const defectType = document.getElementById("defectType");
const intensity = document.getElementById("intensity");
const intensityValue = document.getElementById("intensityValue");
const variationCount = document.getElementById("variationCount");
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const resultInfo = document.getElementById("resultInfo");
const message = document.getElementById("message");
const downloadAll = document.getElementById("downloadAll");

let sourceImage = null;
let sourceName = "product";
let generatedCanvases = [];

function showMessage(text) {
  message.textContent = text;
  message.classList.add("visible");
}

function clearMessage() {
  message.textContent = "";
  message.classList.remove("visible");
}

function clearResults() {
  resultsGrid.replaceChildren();
  generatedCanvases = [];
  downloadAll.disabled = true;
  emptyState.hidden = false;
  emptyState.style.display = "flex";
}

intensity.addEventListener("input", () => {
  intensityValue.textContent = intensity.value + "%";
});

imageInput.addEventListener("change", () => {
  clearMessage();

  const file = imageInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMessage("Please choose a valid image.");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();

    img.onload = () => {
      sourceImage = img;
      sourceName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "_") || "product";

      fileInfo.textContent =
        `${file.name} (${img.naturalWidth} × ${img.naturalHeight})`;

      inputPreview.src = reader.result;
      previewWrap.hidden = false;

      clearResults();
      resultInfo.textContent =
        "Image loaded. Choose settings and generate defects.";
    };

    img.onerror = () => showMessage("Image could not be opened.");
    img.src = reader.result;
  };

  reader.onerror = () => showMessage("Could not read the image.");
  reader.readAsDataURL(file);
});

function isProductPixel(data, width, height, x, y) {
  x = Math.round(x);
  y = Math.round(y);

  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }

  const i = (y * width + x) * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  return brightness < 220 ||
    (brightness < 242 && saturation > 18);
}

function randomProductPoint(data, width, height, random) {
  for (let i = 0; i < 400; i++) {
    const x = width * (0.10 + random() * 0.80);
    const y = height * (0.08 + random() * 0.84);

    if (isProductPixel(data, width, height, x, y)) {
      return { x, y };
    }
  }

  return null;
}

function addDefects(ctx, width, height, type, amount, seed) {
  const pixels = ctx.getImageData(0, 0, width, height).data;

  let state = (seed * 9301 + 49297) % 233280;

  function random() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  }

  const count = Math.max(
    35,
    Math.min(1400, Math.round(width * height / 1300 * amount))
  );

  function scratch() {
    const p = randomProductPoint(pixels, width, height, random);
    if (!p) return;

    const angle = random() * Math.PI * 2;
    const length = (5 + random() * 18) * (0.5 + amount);
    const x2 = p.x + Math.cos(angle) * length;
    const y2 = p.y + Math.sin(angle) * length;

    for (let t = 0; t <= 1; t += 0.1) {
      const x = p.x + (x2 - p.x) * t;
      const y = p.y + (y2 - p.y) * t;

      if (!isProductPixel(pixels, width, height, x, y)) {
        return;
      }
    }

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(18,12,8,${0.65 + amount * 0.3})`;
    ctx.lineWidth = 0.8 + random() * 1.7 * amount;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 1);
    ctx.lineTo(x2, y2 + 1);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function spot() {
    const p = randomProductPoint(pixels, width, height, random);
    if (!p) return;

    const r = 1.5 + random() * 5 * amount;

    ctx.beginPath();
    ctx.ellipse(
      p.x, p.y, r, r * (0.6 + random()),
      random(), 0, Math.PI * 2
    );

    ctx.fillStyle = `rgba(25,15,10,${0.55 + amount * 0.4})`;
    ctx.fill();
  }

  function crack() {
    const p = randomProductPoint(pixels, width, height, random);
    if (!p) return;

    let x = p.x;
    let y = p.y;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let j = 0; j < 5; j++) {
      const nx = x + (random() - 0.5) * 25 * amount;
      const ny = y + (random() - 0.5) * 25 * amount;

      if (!isProductPixel(pixels, width, height, nx, ny)) {
        break;
      }

      ctx.lineTo(nx, ny);
      x = nx;
      y = ny;
    }

    ctx.strokeStyle = `rgba(18,12,8,${0.7 + amount * 0.25})`;
    ctx.lineWidth = 0.8 + amount;
    ctx.stroke();
  }

  for (let i = 0; i < count; i++) {
    if (type === "scratches" || type === "mixed") {
      scratch();
    }

    if ((type === "spots" || type === "mixed") && i % 2 === 0) {
      spot();
    }

    if ((type === "cracks" || type === "mixed") && i % 12 === 0) {
      crack();
    }
  }
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    if (!blob) {
      showMessage("Could not export the image.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }, "image/png");
}

function makeCard(canvas, number) {
  const card = document.createElement("article");
  card.className = "result-card";

  const preview = document.createElement("canvas");
  preview.width = canvas.width;
  preview.height = canvas.height;
  preview.getContext("2d").drawImage(canvas, 0, 0);

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const title = document.createElement("strong");
  title.textContent = `Variation ${number}`;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "↓ PNG";

  button.addEventListener("click", () => {
    downloadCanvas(
      canvas,
      `${sourceName}_defect_${number}.png`
    );
  });

  footer.append(title, button);
  card.append(preview, footer);

  return card;
}

generateBtn.addEventListener("click", () => {
  clearMessage();

  if (!sourceImage) {
    showMessage("Please upload a product image first.");
    imageInput.click();
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const maxDimension = 900;

    const scale = Math.min(
      1,
      maxDimension / Math.max(
        sourceImage.naturalWidth,
        sourceImage.naturalHeight
      )
    );

    const width = Math.max(
      1, Math.round(sourceImage.naturalWidth * scale)
    );

    const height = Math.max(
      1, Math.round(sourceImage.naturalHeight * scale)
    );

    const amount = Number(intensity.value) / 100;
    const type = defectType.value;
    const total = Number(variationCount.value);

    clearResults();
    emptyState.hidden = true;
    emptyState.style.display = "none";

    for (let n = 1; n <= total; n++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(sourceImage, 0, 0, width, height);

      addDefects(ctx, width, height, type, amount, n * 17);

      generatedCanvases.push(canvas);
      resultsGrid.appendChild(makeCard(canvas, n));
    }

    resultInfo.textContent =
      `${total} variation(s) created · ${type} · ${intensity.value}% intensity`;

    downloadAll.disabled = false;

  } catch (error) {
    console.error("Defect generation error:", error);
    showMessage(
      "Generation failed. Refresh the page and try a smaller image."
    );

    emptyState.hidden = false;
    emptyState.style.display = "flex";

  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "✦ Generate defects";
  }
});

downloadAll.addEventListener("click", () => {
  generatedCanvases.forEach((canvas, index) => {
    setTimeout(() => {
      downloadCanvas(
        canvas,
        `${sourceName}_defect_${index + 1}.png`
      );
    }, index * 350);
  });
});

resetBtn.addEventListener("click", () => {
  clearResults();
  clearMessage();

  resultInfo.textContent = sourceImage
    ? "Image loaded. Choose settings and generate defects."
    : "Upload an image to get started.";
});

clearResults();
