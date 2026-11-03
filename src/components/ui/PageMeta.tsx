import type { ReactNode } from 'react';

/** What a search result or a shared link says about one page of the web app. */
export interface PageMetaProps {
  /** The full page title: `Chord book · Pontifork`. */
  title: string;
  /** One or two sentences, at most 160 characters, for the search result. */
  description: string;
  /** The page's path on the web app (`/chords`): its canonical address. */
  path: `/${string}`;
  /** False for pages that only show the player's own data, which search engines should skip. */
  indexed?: boolean;
}

/**
 * A page's title, description and canonical address. Only a browser has a
 * document head; `PageMeta.web.tsx` writes it, and the apps render nothing.
 */
export function PageMeta(_props: Readonly<PageMetaProps>): ReactNode {
  return null;
}

/** Holds the pages' `PageMeta` together on the web; nothing to hold in the apps. */
export function PageMetaProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return children;
}
