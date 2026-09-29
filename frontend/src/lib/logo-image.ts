// Logo handling done in the browser, so the server never needs an image
// library: uploads are shrunk before sending, and the co-branded
// partnership logo (SOP Phase 4) is drawn on a canvas from the school's logo.

const MAX_UPLOAD_CHARS = 1_900_000; // stays under the server's ~1.5 MB image cap once base64-encoded

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image — please try a PNG or JPG file.'));
    img.src = src;
  });
}

/** Shrinks an uploaded image to fit `max`×`max` and returns it as a data URL. */
export async function resizeImageFile(file: File, max = 600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG or JPG).');
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png'); // keeps a transparent background
    return png.length <= MAX_UPLOAD_CHARS ? png : canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 700): number {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 14);
  return size;
}

/** 1200×630 PNG (a good size for WhatsApp): codevidhya | × | school logo,
 * with "School × codevidhya · Proud partners" underneath. */
export async function makeCobrandedLogo(schoolLogoSrc: string, schoolName: string): Promise<string> {
  const logo = await loadImage(schoolLogoSrc);
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(0, H - 14, W, 14);

  const centerY = 260;
  // Left: codevidhya wordmark.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4f46e5';
  fitText(ctx, 'codevidhya', 420, 92, 800);
  ctx.fillText('codevidhya', 300, centerY);

  // Middle: ×
  ctx.fillStyle = '#9ca3af';
  ctx.font = '300 110px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText('×', W / 2, centerY - 6);

  // Right: the school's logo, fitted in a 380×300 box.
  const boxW = 380;
  const boxH = 300;
  const scale = Math.min(boxW / logo.naturalWidth, boxH / logo.naturalHeight);
  const w = logo.naturalWidth * scale;
  const h = logo.naturalHeight * scale;
  ctx.drawImage(logo, 900 - w / 2, centerY - h / 2, w, h);

  // Caption.
  ctx.fillStyle = '#111827';
  const caption = `${schoolName} × codevidhya`;
  fitText(ctx, caption, W - 120, 46, 700);
  ctx.fillText(caption, W / 2, 480);
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 28px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText('Proud partners in coding & technology education', W / 2, 540);

  return canvas.toDataURL('image/png');
}

/** Digits WhatsApp's wa.me links expect: country code + number, no "+".
 * A bare 10-digit number is taken as Indian. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}
