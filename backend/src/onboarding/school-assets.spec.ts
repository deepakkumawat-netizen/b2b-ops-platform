import { BadRequestException } from '@nestjs/common';
import { parseImageDataUrl } from './school-assets';

describe('parseImageDataUrl', () => {
  it('accepts a PNG data URL', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const { mimeType, data } = parseImageDataUrl(`data:image/png;base64,${png}`);
    expect(mimeType).toBe('image/png');
    expect(data.length).toBe(4);
  });

  it('rejects non-images and oversized files', () => {
    expect(() => parseImageDataUrl('data:text/html;base64,PGgxPg==')).toThrow(BadRequestException);
    expect(() => parseImageDataUrl('https://example.com/logo.png')).toThrow(BadRequestException);
    const big = Buffer.alloc(1_600_000).toString('base64');
    expect(() => parseImageDataUrl(`data:image/jpeg;base64,${big}`)).toThrow(/too large/);
  });
});
