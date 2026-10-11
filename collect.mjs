// Runs with Node.js 22. No AI services, SDKs or keys are used.
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
const categories = ['SpecialPriceOffers', 'whatsnew', 'FY27_P2W2_MemberAppreciation'];
const checkedAt = new Date().toISOString();
async function getPage(category, page) {
  const url = new URL('https://www.costco.co.kr/api/v2/sites/korea/search');
  url.search = new URLSearchParams({ category, query: ':relevance', pageSize: '48', currentPage: String(page), locale: 'ko', curr: 'KRW' });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}
async function collect(category) {
  const products = [];
  let total, pages;
  for (let page = 0; page < (pages ?? 1); page++) {
    const data = await getPage(category, page);
    const pagination = data.pagination;
    if (!Array.isArray(data.products) || !Number.isInteger(pagination?.totalResults) || !Number.isInteger(pagination?.totalPages)) throw new Error('Unexpected source response');
    if (page === 0) {
      total = pagination.totalResults;
      pages = pagination.totalPages;
      if (total === 0 && category.startsWith('FY')) return { checkedAt, total: 0, products: [] };
      if (total < 1 || pages < 1 || pages > 200) throw new Error('Empty or implausible source listing; retain previous data');
    }
    if (pagination.totalResults !== total || pagination.totalPages !== pages) throw new Error('Source changed during collection; retain previous data');
    for (const product of data.products) {
      if (typeof product.code !== 'string' || !(product.nameInSelectedLanguage || product.name)) throw new Error('Invalid product');
    }
    products.push(...data.products);
  }
  if (products.length !== total || new Set(products.map(p => p.code)).size !== total) throw new Error('Incomplete or duplicate listing');
  return { checkedAt, total, products };
}
// Publish one complete snapshot only after every source has passed validation.
const snapshots = {};
for (const category of categories) snapshots[category] = await collect(category);
await mkdir('output', { recursive: true });
const temporary = 'output/snapshot.pending.json';
try {
  await writeFile(temporary, JSON.stringify({ checkedAt, sources: snapshots }));
  await rename(temporary, 'output/snapshot.json');
} finally {
  await rm(temporary, { force: true });
}
console.log('Validated snapshot:', Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.total])));

