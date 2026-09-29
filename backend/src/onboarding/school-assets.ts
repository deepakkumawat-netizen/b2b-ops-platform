import { BadRequestException } from '@nestjs/common';

// Logo images arrive as data URLs (the browser resizes them first). Shared
// by the staff onboarding endpoints and the school's public form.
export const ASSET_KINDS = ['LOGO', 'COBRANDED_LOGO'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_ASSET_BYTES = 1_500_000;

export function isAssetKind(kind: string): kind is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(kind);
}

export function parseImageDataUrl(dataUrl: string): { mimeType: string; data: Buffer } {
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!match || !ALLOWED_TYPES.includes(match[1])) {
    throw new BadRequestException('Please upload a PNG, JPG or WebP image');
  }
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0 || data.length > MAX_ASSET_BYTES) {
    throw new BadRequestException('Image is too large — please use one under 1.5 MB');
  }
  return { mimeType: match[1], data };
}
