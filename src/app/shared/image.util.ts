export interface CompressedImage {
  file: File;
  /** Preview data URL (JPEG). */
  dataUrl: string;
  bytes: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the image'));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not compress the image'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Downscales and re-encodes a photo so it stays small enough for field use.
 * Defaults target ~60 KB, which keeps uploads fast on unstable networks.
 */
export async function compressImage(
  file: File,
  maxDimension = 720,
  targetBytes = 60 * 1024,
): Promise<CompressedImage> {
  const source = await readAsDataUrl(file);
  const image = await loadImage(source);

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported on this device');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.8;
  let blob = await toBlob(canvas, quality);

  while (blob.size > targetBytes && quality > 0.3) {
    quality = Math.round((quality - 0.1) * 100) / 100;
    blob = await toBlob(canvas, quality);
  }

  // Still too large: shrink the canvas once and retry at a mid quality.
  if (blob.size > targetBytes) {
    const shrink = document.createElement('canvas');
    shrink.width = Math.max(1, Math.round(canvas.width * 0.7));
    shrink.height = Math.max(1, Math.round(canvas.height * 0.7));
    const shrinkContext = shrink.getContext('2d');
    if (shrinkContext) {
      shrinkContext.fillStyle = '#ffffff';
      shrinkContext.fillRect(0, 0, shrink.width, shrink.height);
      shrinkContext.drawImage(canvas, 0, 0, shrink.width, shrink.height);
      canvas.width = shrink.width;
      canvas.height = shrink.height;
      const finalContext = canvas.getContext('2d');
      finalContext?.drawImage(shrink, 0, 0);
      blob = await toBlob(canvas, 0.6);
      quality = 0.6;
    }
  }

  const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
  return {
    file: new File([blob], name, { type: 'image/jpeg' }),
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    bytes: blob.size,
  };
}
