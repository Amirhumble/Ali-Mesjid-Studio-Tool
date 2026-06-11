import { Caption, CaptionDisplayMode, CaptionStyle } from "../types";

export function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num: number, size: number) => num.toString().padStart(size, "0");
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

export function formatTimeVTT(seconds: number): string {
  return formatTimeSRT(seconds).replace(",", ".");
}

export function formatVideoTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function generateSRT(captions: Caption[], mode: CaptionDisplayMode): string {
  return captions
    .map((caption, idx) => {
      let text = "";
      if (mode === "amharic") text = caption.amharic;
      else if (mode === "original") text = caption.original;
      else text = `${caption.original}\n${caption.amharic}`;

      return `${idx + 1}\n${formatTimeSRT(caption.start)} --> ${formatTimeSRT(caption.end)}\n${text}\n`;
    })
    .join("\n");
}

export function generateWebVTT(captions: Caption[], mode: CaptionDisplayMode): string {
  const header = "WEBVTT\n\n";
  const body = captions
    .map((caption, idx) => {
      let text = "";
      if (mode === "amharic") text = caption.amharic;
      else if (mode === "original") text = caption.original;
      else text = `${caption.original}\n${caption.amharic}`;

      return `${idx + 1}\n${formatTimeVTT(caption.start)} --> ${formatTimeVTT(caption.end)}\n${text}\n`;
    })
    .join("\n");
  return header + body;
}

export function generateTXT(captions: Caption[], mode: CaptionDisplayMode): string {
  return captions
    .map((c) => {
      const timeTag = `[${formatVideoTime(c.start)} - ${formatVideoTime(c.end)}]`;
      if (mode === "amharic") return `${timeTag} ${c.amharic}`;
      if (mode === "original") return `${timeTag} ${c.original}`;
      return `${timeTag}\nOriginal: ${c.original}\nAmharic:  ${c.amharic}\n`;
    })
    .join("\n");
}

export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function drawCanvasSubtitle(
  ctx: CanvasRenderingContext2D,
  caption: Caption,
  canvasWidth: number,
  canvasHeight: number,
  mode: CaptionDisplayMode,
  style: CaptionStyle
) {
  const lines: string[] = [];
  const weight = style.fontWeight === "bold" ? "bold" : 
                 style.fontWeight === "semibold" ? "600" : 
                 style.fontWeight === "900" ? "900" : "normal";
  const fontSizeScalar = (canvasWidth / 640) * style.fontSize;
  const finalFontSize = Math.max(8, Math.min(fontSizeScalar, 120));

  const fontFamily = style.fontFamily || '"Noto Sans Ethiopic", "Inter", sans-serif';
  ctx.font = `${weight} ${finalFontSize}px ${fontFamily}`;
  ctx.textAlign = style.align;
  ctx.textBaseline = "middle";

  const paddingMultiplier = 0.9;
  const maxTextWidth = canvasWidth * paddingMultiplier;

  if (mode === "original" || mode === "dual") {
    const originalWrapped = wrapCanvasText(ctx, caption.original, maxTextWidth);
    lines.push(...originalWrapped);
  }
  if (mode === "amharic" || mode === "dual") {
    const amharicWrapped = wrapCanvasText(ctx, caption.amharic, maxTextWidth);
    lines.push(...amharicWrapped);
  }

  if (lines.length === 0) return;

  const lineHeight = finalFontSize * (style.lineHeight || 1.2);
  const totalTextHeight = lines.length * lineHeight;
  
  // Calculate X position
  let x = canvasWidth / 2 + (style.horizontalOffset / 100) * canvasWidth;
  if (style.align === "left") {
    x = (canvasWidth * 0.05) + (style.horizontalOffset / 100) * canvasWidth;
  } else if (style.align === "right") {
    x = (canvasWidth * 0.95) + (style.horizontalOffset / 100) * canvasWidth;
  }

  // Calculate Y position - style.verticalOffset is 0 at bottom, 100 at top
  const verticalPos = canvasHeight - (canvasHeight * (style.verticalOffset / 100)) - (totalTextHeight / 2);
  const verticalBoxPadding = style.padding !== undefined ? style.padding : finalFontSize * 0.3;
  const horizontalBoxPadding = style.padding !== undefined ? style.padding * 1.5 : finalFontSize * 0.6;

  if (style.bgOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = style.bgOpacity;
    ctx.fillStyle = style.bgColor;

    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const boxWidth = Math.min(maxLineWidth + horizontalBoxPadding * 2, canvasWidth - 10);
    const boxHeight = totalTextHeight + verticalBoxPadding * 2;

    let boxX = x - (boxWidth / 2);
    if (style.align === "left") boxX = x - horizontalBoxPadding;
    else if (style.align === "right") boxX = x - boxWidth + horizontalBoxPadding;

    const boxY = verticalPos - (totalTextHeight / 2) - verticalBoxPadding;

    ctx.beginPath();
    const radius = style.borderRadius !== undefined ? style.borderRadius : 8;
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
    } else {
      ctx.rect(boxX, boxY, boxWidth, boxHeight);
    }
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = style.color;
  
  if (style.letterSpacing) {
    ctx.canvas.style.letterSpacing = `${style.letterSpacing}px`;
  }

  lines.forEach((line, index) => {
    const lineY = verticalPos - (totalTextHeight / 2) + (index * lineHeight) + (lineHeight / 2);
    
    // Draw Shadow
    if (style.shadowColor && style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur;
      ctx.shadowOffsetX = style.shadowOffsetX || 0;
      ctx.shadowOffsetY = style.shadowOffsetY || 0;
    }

    // Draw Stroke
    if (style.strokeWidth > 0 && style.strokeColor) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = (style.strokeWidth / 10) * (finalFontSize / 10);
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, lineY);
    }

    // Reset shadow for main text fill to avoid "double" shadow if stroke also had it
    // Actually, usually we want shadow on the whole thing
    ctx.fillText(line, x, lineY);
  });

  ctx.restore();
}
