// ========================================================
// BACKGROUND VIDEO CANVAS SCROLL SCRUBBING
// ========================================================

const canvas = document.getElementById("hero-lightpass");
const context = canvas.getContext("2d");

const frameCount = 240;
const currentFramePath = index => 
  `video_frames_24fps_png/video_frames_24fps/frame_${index.toString().padStart(4, '0')}.png`;

const images = [];
let lastRenderedFrame = -1;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (lastRenderedFrame > 0 && images[lastRenderedFrame - 1]) {
    drawImageOnCanvas(images[lastRenderedFrame - 1]);
  }
}

function drawImageOnCanvas(img) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  
  const cWidth = canvas.width;
  const cHeight = canvas.height;
  
  // Calculate aspect ratio cover
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = cWidth / cHeight;
  
  let drawWidth, drawHeight, offsetX, offsetY;
  
  if (canvasRatio > imgRatio) {
    drawWidth = cWidth;
    drawHeight = cWidth / imgRatio;
    offsetX = 0;
    offsetY = (cHeight - drawHeight) / 2;
  } else {
    drawHeight = cHeight;
    drawWidth = cHeight * imgRatio;
    offsetX = (cWidth - drawWidth) / 2;
    offsetY = 0;
  }
  
  context.clearRect(0, 0, cWidth, cHeight);
  context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function renderFrame(frameIndex) {
  const index = Math.min(frameCount, Math.max(1, frameIndex));
  let img = images[index - 1];

  // If this frame is loaded and valid, draw it
  if (img && img.complete && img.naturalWidth !== 0) {
    drawImageOnCanvas(img);
    lastRenderedFrame = index;
    return;
  }

  // Fallback: draw nearest loaded preceding frame to prevent flickering
  for (let back = index - 1; back >= 1; back--) {
    const fallbackImg = images[back - 1];
    if (fallbackImg && fallbackImg.complete && fallbackImg.naturalWidth !== 0) {
      drawImageOnCanvas(fallbackImg);
      break;
    }
  }

  // If target image loads while we are still near this frame, draw it
  if (img) {
    img.onload = () => {
      if (Math.abs(getCurrentScrollFrame() - index) <= 2) {
        drawImageOnCanvas(img);
        lastRenderedFrame = index;
      }
    };
  }
}

// Preload all frames into memory
for (let i = 1; i <= frameCount; i++) {
  const img = new Image();
  img.src = currentFramePath(i);
  if (i === 1) {
    img.onload = () => {
      renderFrame(1);
    };
    if (img.complete && img.naturalWidth !== 0) {
      renderFrame(1);
    }
  }
  images.push(img);
}

function getCurrentScrollFrame() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const maxScrollTop = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;
  const scrollFraction = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
  const clampedFraction = Math.min(Math.max(scrollFraction, 0), 1);
  return Math.min(
    frameCount,
    Math.max(1, Math.round(clampedFraction * (frameCount - 1)) + 1)
  );
}

let isUpdating = false;

function onScroll() {
  if (!isUpdating) {
    isUpdating = true;
    requestAnimationFrame(() => {
      const target = getCurrentScrollFrame();
      renderFrame(target);
      isUpdating = false;
    });
  }
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  renderFrame(getCurrentScrollFrame());
});

// Initial draw attempts
renderFrame(1);
window.addEventListener("DOMContentLoaded", () => renderFrame(1));
window.addEventListener("load", () => renderFrame(1));

// ========================================================
// MICRO-INTERACTIONS (Interactive 3D Cards Tilt & Hover)
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".service-card, .phone-card");

  cards.forEach(card => {
    card.addEventListener("mousemove", e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
});

// ========================================================
// FLOATING HERO-RIGHT NAV PILLS — ZIGZAG INDEPENDENT ANIMATION
// "right" pills float with phase 0, π — they go up while
// "left" pills use phase π/2, 3π/2 — creating an alternating
// zigzag wave across the column. Hover blends in smoothly.
// ========================================================
(function initFloatingPills() {
  const pills = Array.from(document.querySelectorAll(".feature-pill"));
  if (!pills.length) return;

  const AMP_Y  = 11;       // px vertical amplitude
  const AMP_X  = 5;        // px extra horizontal sway
  const SPEED  = 0.00080;  // rad/ms → ~7.8s period

  // Each pill gets a distinct phase so they never move in sync
  // 0°, 90°, 180°, 270° → clearly distinct positions at all times
  const PHASE_Y = pills.map((_, i) => i * (Math.PI / 2));
  // Horizontal sway: left-zag pills sway opposite to right-zag
  const PHASE_X = pills.map(p =>
    p.dataset.zag === "left" ? Math.PI : 0
  );

  // Hover easing state per pill
  const hovered = new Array(pills.length).fill(false);
  const easeX   = new Array(pills.length).fill(0);
  const easeS   = new Array(pills.length).fill(1);
  const EASE    = 0.10;

  pills.forEach((pill, i) => {
    pill.addEventListener("mouseenter", () => { hovered[i] = true;  });
    pill.addEventListener("mouseleave", () => { hovered[i] = false; });
  });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick(t) {
    pills.forEach((pill, i) => {
      const floatY = AMP_Y * Math.sin(SPEED * t + PHASE_Y[i]);
      const floatX = AMP_X * Math.sin(SPEED * t * 0.6 + PHASE_X[i]);

      // Hover easing
      easeX[i] = lerp(easeX[i], hovered[i] ? -12 : 0,    EASE);
      easeS[i] = lerp(easeS[i], hovered[i] ?  1.06 : 1,  EASE);

      pill.style.transform =
        `translateY(${floatY.toFixed(2)}px)` +
        ` translateX(${(floatX + easeX[i]).toFixed(2)}px)` +
        ` scale(${easeS[i].toFixed(4)})`;
    });
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();


// ========================================================
// TECH SIDE CANVAS — CIRCUIT BOARD AESTHETIC
// ========================================================
(function initTechDecorations() {
  const CRIMSON    = "rgba(229,9,20,";
  const WHITE_DIM  = "rgba(255,255,255,";
  const TEAL       = "rgba(0,220,200,";

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(canvas.offsetWidth  * dpr);
    canvas.height = Math.round(canvas.offsetHeight * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
  }

  // --- Seeded pseudo-random for deterministic layout ---
  function seededRand(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function buildCircuit(canvasEl, side) {
    const W = canvasEl.offsetWidth;
    const H = canvasEl.offsetHeight;
    const ctx = setupCanvas(canvasEl);
    const rand = seededRand(side === "left" ? 42 : 137);

    // --- Generate nodes ---
    const nodeCount = 22;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: rand() * W,
        y: rand() * H,
        r: 2.5 + rand() * 3,
        pulse: rand() * Math.PI * 2,  // phase
        speed: 0.025 + rand() * 0.02,
        color: rand() < 0.4 ? CRIMSON : rand() < 0.7 ? WHITE_DIM : TEAL,
      });
    }

    // --- Connect nearby nodes with lines ---
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          edges.push({ a: i, b: j, dist });
        }
      }
    }

    // --- Binary text snippets floating along the sides ---
    const binarySnippets = [];
    const snippetCount = 8;
    const binaryPool = ["01101", "10010", "11001", "00110", "10101", "01110", "11010", "00011", "10001", "01011"];
    for (let i = 0; i < snippetCount; i++) {
      binarySnippets.push({
        text: binaryPool[Math.floor(rand() * binaryPool.length)],
        x: rand() * (W - 30) + 5,
        y: rand() * H,
        speed: 0.18 + rand() * 0.12,
        opacity: 0.12 + rand() * 0.18,
      });
    }

    let scrollOffset = 0;
    window.addEventListener("scroll", () => {
      scrollOffset = window.scrollY * 0.08;
    }, { passive: true });

    let t = 0;

    function draw() {
      const w = canvasEl.offsetWidth;
      const h = canvasEl.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Subtle gradient veil on each side
      const grad = ctx.createLinearGradient(side === "left" ? 0 : w, 0, side === "left" ? w : 0, 0);
      grad.addColorStop(0, "rgba(8,8,8,0.85)");
      grad.addColorStop(1, "rgba(8,8,8,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const scrollShift = scrollOffset % h;

      // --- Draw edges ---
      edges.forEach(edge => {
        const na = nodes[edge.a];
        const nb = nodes[edge.b];
        const alpha = 0.08 + 0.06 * Math.sin(t * 0.8 + edge.a);
        ctx.beginPath();
        const sy = (scrollShift + na.y) % h;
        const dy = (scrollShift + nb.y) % h;
        ctx.moveTo(na.x, sy);
        ctx.lineTo(nb.x, dy);
        ctx.strokeStyle = WHITE_DIM + alpha.toFixed(2) + ")";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });

      // --- Draw nodes ---
      nodes.forEach(node => {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * node.speed + node.pulse));
        const ny = (scrollShift + node.y) % h;
        ctx.beginPath();
        ctx.arc(node.x, ny, node.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = node.color + (0.5 * pulse).toFixed(2) + ")";
        ctx.fill();

        // Glow ring
        ctx.beginPath();
        ctx.arc(node.x, ny, node.r * pulse * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = node.color + (0.12 * pulse).toFixed(2) + ")";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // --- Draw binary text ---
      ctx.font = "9px 'Courier New', monospace";
      binarySnippets.forEach(snip => {
        const sy = (scrollShift * snip.speed + snip.y) % h;
        ctx.fillStyle = CRIMSON + (snip.opacity * (0.7 + 0.3 * Math.sin(t * 0.5))).toFixed(2) + ")";
        ctx.fillText(snip.text, snip.x, sy);
      });

      t += 0.04;
      requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener("resize", () => {
      setupCanvas(canvasEl);
      draw();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const leftCanvas  = document.getElementById("tech-canvas-left");
    const rightCanvas = document.getElementById("tech-canvas-right");
    if (leftCanvas)  buildCircuit(leftCanvas,  "left");
    if (rightCanvas) buildCircuit(rightCanvas, "right");
  });
})();

