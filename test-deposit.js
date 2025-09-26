const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    console.log('🔄 Navigating to stripe-deposit.vercel.app...');
    await page.goto('https://stripe-deposit.vercel.app', { waitUntil: 'networkidle2' });
    
    console.log('✅ Page loaded successfully');
    
    // Test BIN detection with Thai card
    console.log('🔄 Testing BIN detection with Thai card 4340765004665567...');
    
    // Find and fill card number input
    const cardNumberInput = await page.$('input[placeholder="1234 5678 9012 3456"]');
    if (cardNumberInput) {
      await cardNumberInput.type('4340765004665567');
      console.log('✅ Card number entered');
      
      // Wait for currency detection
      await page.waitForTimeout(2000);
      
      // Check if THB was detected
      const currencyText = await page.evaluate(() => {
        const currencyElement = document.querySelector('.text-green-600');
        return currencyElement ? currencyElement.textContent : 'not found';
      });
      
      console.log('🔍 Currency detection result:', currencyText);
      
      // Fill amount
      console.log('🔄 Filling amount: 154...');
      const amountInput = await page.$('input[type="number"]');
      if (amountInput) {
        await amountInput.clear();
        await amountInput.type('154');
        console.log('✅ Amount entered: 154');
      }
      
      // Check current form state
      const formState = await page.evaluate(() => {
        const amount = document.querySelector('input[type="number"]')?.value;
        const currency = document.querySelector('select')?.value;
        return { amount, currency };
      });
      
      console.log('🔍 Form state:', formState);
      
    } else {
      console.log('❌ Card number input not found');
    }
    
    console.log('🔄 Test completed. Browser will stay open for manual inspection...');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
