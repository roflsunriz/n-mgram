import { describe, expect, it, vi } from 'vitest';
import type { PageFlip } from 'page-flip-2';
import { installRtlLandscapeTexturePairing } from './page-flip-texture-pairing';

type FlipPage = ReturnType<PageFlip['getPage']>;
type Render = ReturnType<PageFlip['getRender']>;
type FlipOrientation = ReturnType<PageFlip['getOrientation']>;
const LANDSCAPE = 'landscape' as FlipOrientation;
const PORTRAIT = 'portrait' as FlipOrientation;

function createPage(source: string): FlipPage {
  return {
    getTextureSource: vi.fn(() => source),
  } as unknown as FlipPage;
}

function createFixture(rtl: boolean, orientation: FlipOrientation) {
  const pages = ['page-0', 'page-1', 'page-2', 'page-3'].map(createPage);
  const renderedTextures: unknown[] = [];
  const render = {
    setFlippingPage: (page: FlipPage | null) => {
      if (page !== null) renderedTextures.push(page.getTextureSource(400, 600));
    },
  } as unknown as Render;
  const pageFlip = {
    getRender: () => render,
    getPageCollection: () => ({ getPages: () => pages }),
    getOrientation: () => orientation,
    isRtl: () => rtl,
  } as unknown as PageFlip;

  return { pageFlip, pages, render, renderedTextures };
}

describe('RTL landscape curl texture pairing', () => {
  it('uses the previous even page behind an odd page during the next turn', () => {
    const fixture = createFixture(true, LANDSCAPE);
    installRtlLandscapeTexturePairing(fixture.pageFlip);

    fixture.render.setFlippingPage(fixture.pages[3]!);

    expect(fixture.renderedTextures).toEqual(['page-2']);
  });

  it('uses the next odd page behind an even page during the previous turn', () => {
    const fixture = createFixture(true, LANDSCAPE);
    installRtlLandscapeTexturePairing(fixture.pageFlip);

    fixture.render.setFlippingPage(fixture.pages[0]!);

    expect(fixture.renderedTextures).toEqual(['page-1']);
  });

  it.each([
    { rtl: false, orientation: LANDSCAPE },
    { rtl: true, orientation: PORTRAIT },
  ])(
    'leaves the library selection unchanged outside RTL landscape mode',
    ({ rtl, orientation }) => {
      const fixture = createFixture(rtl, orientation);
      installRtlLandscapeTexturePairing(fixture.pageFlip);

      fixture.render.setFlippingPage(fixture.pages[3]!);

      expect(fixture.renderedTextures).toEqual(['page-3']);
    },
  );

  it('restores the original renderer hook when the reader is destroyed', () => {
    const fixture = createFixture(true, LANDSCAPE);
    const original = fixture.render.setFlippingPage;
    const restore = installRtlLandscapeTexturePairing(fixture.pageFlip);

    restore();

    expect(fixture.render.setFlippingPage).toBe(original);
  });
});
