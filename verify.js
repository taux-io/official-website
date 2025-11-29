const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Inject CSS to disable web fonts
  const css = `
    * {
      font-family: sans-serif !important;
    }
  `;

  console.log('Navigating to the homepage...');
  await page.goto('http://localhost:8080');
  await page.addStyleTag({ content: css });
  await page.waitForTimeout(1000); // Wait for animations
  console.log('Taking screenshot of the homepage...');
  await page.screenshot({ path: 'homepage_demo.png' });

  console.log('Navigating to the AEO guide...');
  await page.goto('http://localhost:8080/aeo-guide.html');
  await page.addStyleTag({ content: css });
  await page.waitForTimeout(1000); // Wait for animations
  console.log('Taking screenshot of the AEO guide...');
  await page.screenshot({ path: 'aeo_guide_demo.png' });

  await browser.close();
  console.log('Screenshots taken successfully!');
})();
