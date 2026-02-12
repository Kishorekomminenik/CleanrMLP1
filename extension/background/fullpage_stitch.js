import { createBitmapFromAny } from "../shared/image_utils.js";

export async function stitchVerticalPng({ frames, width, totalHeight }) {
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
  let y = 0;

  for (const frame of frames) {
    const bmp = await createBitmapFromAny(frame);
    ctx.drawImage(bmp, 0, y);
    y += bmp.height;
  }

  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: "image/png" });
  }

  return await new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej("toBlob failed")), "image/png");
  });
}
