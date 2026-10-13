// Node.js 22+, no external dependencies. Never publish a partial catalog.
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const categories = ['SpecialPriceOffers', 'whatsnew', 'FY27_P2W2_MemberAppreciation'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function getPage(category, page, sort, { fetchPage = fetch, wait = sleep } = {}) {
  const url = new URL('https://www.costco.co.kr/api/v2/sites/korea/search');
  url.search = new URLSearchParams({ category, query: ':' + sort, sort, pageSize: '48', currentPage: String(page), locale: 'ko', curr: 'KRW' });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchPage(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw new Error(`${category} page ${page}: ${error.message}`, { cause: error });
      await wait(2000 * (attempt + 1));
    }
  }
}

export async function collectOnce(category, sort, { pageReader = getPage } = {}) {
  const checkedAt = new Date().toISOString();
  const products = [];
  let total, pages;
  for (let page = 0; page < (pages ?? 1); page++) {
    const data = await pageReader(category, page, sort);
    const p = data.pagination;
    if (!Array.isArray(data.products) || !Number.isInteger(p?.totalResults) || !Number.isInteger(p?.totalPages) || p.currentPage !== page) throw new Error('Unexpected source response or page number');
    if (page === 0) {
      total = p.totalResults;
      pages = p.totalPages;
      if (total === 0 && category.startsWith('FY') && data.products.length === 0) return { checkedAt, total: 0, products: [] };
      if (total < 1 || pages < 1 || pages > 200) throw new Error('Empty or implausible source listing');
    }
    if (p.totalResults !== total || p.totalPages !== pages) throw new Error('Source changed during collection');
    for (const product of data.products) {
      if (typeof product.code !== 'string' || !product.code || !(product.nameInSelectedLanguage || product.name)) throw new Error('Invalid product');
    }
    products.push(...data.products);
  }
  const unique = new Set(products.map(p => p.code)).size;
  if (products.length !== total || unique !== total) throw new Error(`Incomplete or duplicate listing: expected=${total}, received=${products.length}, unique=${unique}`);
  return { checkedAt, total, products };
}

export async function collect(category, { pageReader = getPage, wait = sleep, warn = console.warn } = {}) {
  // Relevance ordering can repeat products across pages. Restart the entire
  // category with a different explicit ordering; never merge partial attempts.
  const sorts = ['name-asc', 'name-desc', 'name-asc', 'name-desc'];
  let lastError;
  for (let attempt = 0; attempt < sorts.length; attempt++) {
    try {
      const result = await collectOnce(category, sorts[attempt], { pageReader });
      console.log(`Validated ${category}: ${result.total} unique products (${sorts[attempt]}, attempt ${attempt + 1})`);
      return result;
    } catch (error) {
      lastError = error;
      warn(`${category} attempt ${attempt + 1}/${sorts.length} (${sorts[attempt]}): ${error.message}`);
      if (attempt < sorts.length - 1) await wait(5000 * (attempt + 1));
    }
  }
  throw new Error(`${category}: all collection attempts failed; previous snapshot retained. ${lastError.message}`, { cause: lastError });
}

export async function main({ collector = collect, outputDir = 'output' } = {}) {
  const checkedAt = new Date().toISOString();
  const snapshots = {};
  // Nothing on disk changes until every category has passed validation.
  for (const category of categories) snapshots[category] = await collector(category);
  await mkdir(outputDir, { recursive: true });
  const temporary = `${outputDir}/snapshot.pending.json`;
  try {
    await writeFile(temporary, JSON.stringify({ checkedAt, sources: snapshots }));
    await rename(temporary, `${outputDir}/snapshot.json`);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log('Validated snapshot:', Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.total])));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
