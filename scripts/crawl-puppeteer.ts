import puppeteer from 'puppeteer';
import fs from 'fs';
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/opt/homebrew/bin/chromium',
    args: [
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-accelerated-2d-canvas',
      '--use-gl=egl',
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: [],
    timeout: 20000,
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  const pages = [];

  // Go to the page and wait for it to load
  await page.goto('https://docs.pinecone.io/docs/overview', {
    waitUntil: 'networkidle2',
  });

  // Get a list of all the links in the sidebar
  const sidebarLinks = await page.$$eval('.hub-sidebar-content a', (links) =>
    links.map((link) => link.href),
  );
  console.log('🚀 ~ file: crawl-puppeteer.ts:36 ~ sidebarLinks:', sidebarLinks);

  // Navigate to each link and extract the content
  for (const link of sidebarLinks) {
    // Only navigate to links that start with "https://docs.pinecone.io/docs/"
    if (link.startsWith('https://docs.pinecone.io/docs/')) {
      console.log('🚀 ~ file: crawl-puppeteer.ts:42 ~ link:', link);
      await page.goto(link, { waitUntil: 'networkidle2' });

      const title = await page.title();
      const url = page.url();

      // Use a different selector if the page doesn't have the #content element
      const selector = (await page.$('#content'))
        ? '#content'
        : '#main-content';
      const text = await page.$eval(selector, (el) => el?.textContent?.trim());

      const currentPage = { url, title, text };
      pages.push(currentPage);
      console.log(
        '🚀 ~ file: crawl-puppeteer.ts:54 ~ currentPage:',
        currentPage,
      );
    }
    console.log('🚀 ~ file: crawl-puppeteer.ts:54 ~ pages:', pages);
  }

  await browser.close();
})();
