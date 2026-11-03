import Head from 'expo-router/head';
import type { ReactNode } from 'react';

import { APP_URL } from '@theme';

import type { PageMetaProps } from './PageMeta';

const INDEXED = 'index, follow, max-image-preview:large';
const UNINDEXED = 'noindex, follow';

/**
 * Writes the page's own title, description and canonical address into the
 * document head as the page opens. `public/index.html` carries the app-wide
 * tags (image, site name, structured data) and marks the per-page ones
 * `data-rh`, so these replace them instead of doubling them.
 */
export function PageMeta({ title, description, path, indexed = true }: Readonly<PageMetaProps>): ReactNode {
  const url = `${APP_URL}${path}`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={indexed ? INDEXED : UNINDEXED} />
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
}

/** Head's context: in a single-page build nothing else provides it. */
export function PageMetaProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return <Head.Provider>{children}</Head.Provider>;
}
