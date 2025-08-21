// Test script to check currency conversion
const { currencyService } = require('./src/lib/currency-service.ts');

async function testCurrencyConversion() {
  console.log('Testing currency conversion...');
  
  // Test EUR to NOK conversion
  try {
    const rate = await currencyService.getExchangeRate('EUR', 'NOK');
    console.log('EUR to NOK rate:', rate);
    
    const converted = await currencyService.convertPrice(
      { amount: 1.72, currency: 'EUR' },
      'NOK'
    );
    console.log('1.72 EUR converted to NOK:', converted);
    
    const formatted = currencyService.formatCurrency(converted.converted.amount, 'NOK', 'en');
    console.log('Formatted NOK:', formatted);
    
  } catch (error) {
    console.error('Currency conversion failed:', error);
  }
}

testCurrencyConversion();