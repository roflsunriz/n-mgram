import type { PageFlip } from 'page-flip-2';

type FlipPage = ReturnType<PageFlip['getPage']>;
type SetFlippingPage = (page: FlipPage | null) => void;
const LANDSCAPE_ORIENTATION = 'landscape';

/**
 * Keeps the two faces of an RTL landscape sheet paired by logical page order.
 * page-flip-2 0.3.0 otherwise snapshots the page exposed below the sheet as its back face.
 */
export function installRtlLandscapeTexturePairing(pageFlip: PageFlip): () => void {
  const render = pageFlip.getRender();
  const originalSetFlippingPage = render.setFlippingPage;
  const callOriginal = (page: FlipPage | null): void => {
    (originalSetFlippingPage as SetFlippingPage).call(render, page);
  };

  const setFlippingPage = (flippingPage: FlipPage | null): void => {
    if (
      flippingPage === null ||
      !pageFlip.isRtl() ||
      String(pageFlip.getOrientation()) !== LANDSCAPE_ORIENTATION
    ) {
      callOriginal(flippingPage);
      return;
    }

    const pages = pageFlip.getPageCollection().getPages();
    const pageIndex = pages.indexOf(flippingPage);
    const pairedPageIndex = pageIndex % 2 === 0 ? pageIndex + 1 : pageIndex - 1;
    const backPage = pages[pairedPageIndex];
    if (pageIndex < 0 || backPage === undefined) {
      callOriginal(flippingPage);
      return;
    }

    const originalGetTextureSource = flippingPage.getTextureSource;
    flippingPage.getTextureSource = backPage.getTextureSource.bind(backPage);
    try {
      callOriginal(flippingPage);
    } finally {
      flippingPage.getTextureSource = originalGetTextureSource;
    }
  };

  render.setFlippingPage = setFlippingPage;
  return () => {
    if (render.setFlippingPage === setFlippingPage) {
      render.setFlippingPage = originalSetFlippingPage;
    }
  };
}
