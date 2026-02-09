export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error(`dataUrlToBlob invalid input: ${typeof dataUrl}`);
  }
  const [meta, base64] = dataUrl.split(",");
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function createBitmapFromAny(input) {
  if (!input) {
    throw new Error("createBitmapFromAny: input undefined");
  }

  if (typeof ImageBitmap !== "undefined" && input instanceof ImageBitmap) {
    return input;
  }

  if (
    input instanceof Blob ||
    (typeof ImageData !== "undefined" && input instanceof ImageData)
  ) {
    return await createImageBitmap(input);
  }

  if (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) {
    const blob = await new Promise((res, rej) => {
      input.toBlob(
        (b) => (b ? res(b) : rej("canvas toBlob failed")),
        "image/png"
      );
    });
    return await createImageBitmap(blob);
  }

  if (typeof OffscreenCanvas !== "undefined" && input instanceof OffscreenCanvas) {
    const blob = await input.convertToBlob({ type: "image/png" });
    return await createImageBitmap(blob);
  }

  if (typeof input === "string" && input.startsWith("data:")) {
    const blob = dataUrlToBlob(input);
    return await createImageBitmap(blob);
  }

  throw new Error(
    `createBitmapFromAny unsupported type: ${input?.constructor?.name}`
  );
}
