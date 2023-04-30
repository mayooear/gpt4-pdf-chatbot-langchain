import * as cheerio from 'cheerio';
import * as puppeteer from 'puppeteer';
//@ts-ignore
import * as TurndownService from 'turndown';
//@ts-ignore
import { convert } from 'html-to-text';
//@ts-ignore
import { JSDOM } from 'jsdom';


const turndownService = new TurndownService();

export type Page = {
  url: string;
  text: string;
  title: string;
};

class Crawler {
  pages: Page[] = [];
  limit: number = 1000;
  urls: string[] = [];
  browser: puppeteer.Browser | null = null;
  textLengthMinimum: number = 200;
  visitedUrls: Set<string>;

  constructor(
    urls: string[],
    limit: number = 1000,
    textLengthMinimum: number = 200,
    
  ) {
    this.urls = urls;
    this.limit = limit;
    this.textLengthMinimum = textLengthMinimum;
    this.pages = [];
    this.browser = null;
    this.visitedUrls = new Set();
  }

   extractText = async (page: puppeteer.Page) => {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(1000);
  
    const html = await page.content();
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const turndownService = new TurndownService();
  
    const title = document.querySelector('title')?.textContent?.trim() || '';

    // convert html to markdown text using turndown

    const options = {
      wordwrap: false,
      ignoreHref: true,
      ignoreImage: true,
    }
    
    const text = turndownService.turndown(convert(html, options));
  
    const pageData = {
      url: page.url(),
      text,
      title,
    };
  
    return pageData;
  };
  

  handlePage = async (page: puppeteer.Page) => {
    const url = page.url();

    if (this.visitedUrls.has(url)) {
      return;
    }

    const pageData = await this.extractText(page);

    if (pageData.text.length > this.textLengthMinimum) {
      this.pages.push(pageData);
    }

    this.visitedUrls.add(url);

    const hrefs = await page.$$eval('a', (links) =>
      links.map((a) => a.href).filter((href) => !!href)
    );

    const baseUrl =
      page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const urls = hrefs.map((href) =>
      href.startsWith('http')
        ? href
        : new URL(href, baseUrl).toString()
    );

    for (let i = 0; i < urls.length; i++) {
      if (
        this.urls.some((u) => urls[i].includes(u)) &&
        this.pages.length < this.limit
      ) {
        const newPage = await this.browser?.newPage();
        await newPage?.goto(urls[i], { waitUntil: 'networkidle2' });
        await this.handlePage(newPage as puppeteer.Page);
      }
    }
  };

  start = async () => {
    this.pages = [];

    this.browser = await puppeteer.launch({ headless: false , 
      executablePath: '/opt/homebrew/bin/chromium',  
      args: [
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        "--disable-accelerated-2d-canvas",
        '--use-gl=egl'],
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: [], timeout: 20000});

    const page = await this.browser.newPage();

    for (let i = 0; i < this.urls.length; i++) {
      const url = this.urls[i];
      await page.goto(url, { waitUntil: 'networkidle2' });
      await this.handlePage(page);
    }

    await this.browser.close();

    return this.pages;
  };
}

export { Crawler };
