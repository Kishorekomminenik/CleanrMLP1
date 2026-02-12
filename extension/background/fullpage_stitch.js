import { createBitmapFromAny } from "../shared/image_utils.js";

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function drawFramesToCanvas({
  ctx,
  frames,
  offsetY = 0,
  heightLimit = null,
  onProgress,
  targetWidth = null,
}) {
  let completed = 0;
  for (const frame of frames) {
    const frameTop = frame.y + frame.clipTop;
    const frameBottom = frameTop + frame.clipHeight;
    const tileTop = offsetY;
    const tileBottom =
      heightLimit !== null ? offsetY + heightLimit : Number.POSITIVE_INFINITY;
    if (frameBottom <= tileTop || frameTop >= tileBottom) {
      completed += 1;
      continue;
    }
    const drawTop = Math.max(frameTop, tileTop);
    const drawBottom = Math.min(frameBottom, tileBottom);
    const drawHeight = Math.max(0, drawBottom - drawTop);
    if (drawHeight <= 0) {
      completed += 1;
      continue;
    }
    const bmp = await createBitmapFromAny(frame.dataUrl || frame);
    const srcY = frame.clipTop + (drawTop - frameTop);
    const frameWidth = frame.width || targetWidth || ctx.canvas.width;
    ctx.drawImage(
      bmp,
      0,
      srcY,
      frameWidth,
      drawHeight,
      0,
      drawTop - offsetY,
      frameWidth,
      drawHeight
    );
    completed += 1;
    if (onProgress) {
      onProgress({ completed, total: frames.length });
    }
    if (completed % 2 === 0) {
      await delay();
    }
  }
}

export async function stitchVerticalPng({ frames, width, totalHeight, onProgress }) {
  if (!frames?.length) {
    throw new Error("No frames to stitch");
  }
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, totalHeight)
      : (() => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = totalHeight;
          return c;
        })();
  const ctx = canvas.getContext("2d");
  await drawFramesToCanvas({ ctx, frames, onProgress, targetWidth: width });
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: "image/png" });
  }
  return await new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej("toBlob failed")), "image/png");
  });
}

export async function stitchVerticalTiles({
  frames,
  width,
  totalHeight,
  tileHeight,
  onProgress,
}) {
  if (!frames?.length) {
    throw new Error("No frames to stitch");
  }
  const tiles = [];
  let tileIndex = 0;
  for (let offsetY = 0; offsetY < totalHeight; offsetY += tileHeight) {
    tileIndex += 1;
    const height = Math.min(tileHeight, totalHeight - offsetY);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(width, height)
        : (() => {
            const c = document.createElement("canvas");
            c.width = width;
            c.height = height;
            return c;
          })();
    const ctx = canvas.getContext("2d");
    await drawFramesToCanvas({
      ctx,
      frames,
      offsetY,
      heightLimit: height,
      onProgress,
      targetWidth: width,
    });
    let blob;
    if (canvas instanceof OffscreenCanvas) {
      blob = await canvas.convertToBlob({ type: "image/png" });
    } else {
      blob = await new Promise((res, rej) => {
        canvas.toBlob((b) => (b ? res(b) : rej("toBlob failed")), "image/png");
      });
    }
    tiles.push({ blob, offsetY, index: tileIndex });
  }
  return tiles;
}
