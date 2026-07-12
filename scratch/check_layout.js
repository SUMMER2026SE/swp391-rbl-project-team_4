const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:9999/admin.html');
    await page.waitForTimeout(1000);

    console.log('Logging in...');
    await page.fill('input[type="email"], #email', 'Tandat@gmail.com');
    await page.fill('input[type="password"], #password', '123456');
    await page.click('button[type="submit"], #loginBtn');
    await page.waitForTimeout(2000);

    console.log('Navigated. Current URL:', page.url());

    // Click the "Tin tức & Sự kiện" tab
    console.log('Clicking news & promotions tab...');
    // The button has onclick="navigate('promotions',this)" and text containing "Tin tức & Sự kiện"
    const newsTabButton = await page.locator('button:has-text("Tin tức & Sự kiện"), button[data-page="promotions"]');
    await newsTabButton.click();
    await page.waitForTimeout(1000);

    console.log('Analyzing layout styles...');
    const analysis = await page.evaluate(() => {
      const mainWrap = document.querySelector('.main-wrap');
      const pagePromo = document.getElementById('page-promotions');
      const scrollContainer = pagePromo ? pagePromo.querySelector('.content-scroll') : null;

      function getStyleData(el) {
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return {
          id: el.id,
          tagName: el.tagName,
          className: el.className,
          offsetHeight: el.offsetHeight,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          styles: {
            display: style.display,
            height: style.height,
            maxHeight: style.maxHeight,
            overflow: style.overflow,
            overflowY: style.overflowY,
            flex: style.flex,
            flexDirection: style.flexDirection,
            position: style.position,
          }
        };
      }

      return {
        mainWrap: getStyleData(mainWrap),
        pagePromo: getStyleData(pagePromo),
        scrollContainer: getStyleData(scrollContainer),
      };
    });

    console.log('LAYOUT ANALYSIS RESULTS:\n', JSON.stringify(analysis, null, 2));

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await browser.close();
  }
}

main();
