import { titleCaseLoose } from './format.js';

const aliasRules = [
  { pattern: /NETFLIX/i, label: 'Netflix' },
  { pattern: /APPLE\s*MEDIA|APPLESERVI|APPLE SERVICES|APPLE\.COM\/BILL/i, label: 'Apple Services' },
  { pattern: /GROWWINVESTTECH|GROWW|BSE\.GROWWPAY/i, label: 'Groww' },
  { pattern: /CRED/i, label: 'Cred' },
  { pattern: /IRCTC/i, label: 'IRCTC' },
  { pattern: /UBER/i, label: 'Uber' },
  { pattern: /OLA/i, label: 'Ola' },
  { pattern: /RAPIDO/i, label: 'Rapido' },
  { pattern: /CLEARTRIP/i, label: 'Cleartrip' },
  { pattern: /EASYTRAVELS/i, label: 'EasyTravels' },
  { pattern: /AMAZON\s*PAY|AMAZON INDIA|AMAZON/i, label: 'Amazon' },
  { pattern: /FLIPKART/i, label: 'Flipkart' },
  { pattern: /AJIO/i, label: 'AJIO' },
  { pattern: /MYNTRA/i, label: 'Myntra' },
  { pattern: /SWIGGY/i, label: 'Swiggy' },
  { pattern: /ZOMATO/i, label: 'Zomato' },
  { pattern: /BIGBASKET/i, label: 'BigBasket' },
  { pattern: /DMART/i, label: 'DMart' },
  { pattern: /ITC HOTELS/i, label: 'ITC Hotels' },
  { pattern: /TCS/i, label: 'TCS' },
  { pattern: /INFOSYS/i, label: 'Infosys' },
  { pattern: /NESTLE/i, label: 'Nestle India' },
  { pattern: /JIO\s*FINANCIAL/i, label: 'Jio Financial' },
  { pattern: /HINDUSTAN\s*AERONAUTICS|HAL/i, label: 'HAL' },
  { pattern: /RELIANCE/i, label: 'Reliance Industries' },
  { pattern: /ITC LIMITED/i, label: 'ITC Limited' },
  { pattern: /UPI-LITE/i, label: 'UPI Lite' },
  { pattern: /MONTHLY INTEREST|QUARTERLY INTEREST|INTERESTPAID/i, label: 'Interest Credit' },
  { pattern: /PRIN AND INT AUTO[_ ]?REDEEM|AUTO[_ ]?REDEEM/i, label: 'FD Auto Redeem' },
  { pattern: /FD PREMAT/i, label: 'FD Prematurity' },
  { pattern: /FD THROUGH MOBILE|FIXED DEPOSIT|TERM DEPOSIT/i, label: 'Fixed Deposit' },
  { pattern: /JILA\s*PANCHAYAT|JILLA?\s*PANCHAYAT|ZILLA\s*PANCHAYAT|CEOJILA/i, label: 'Zilla Panchayat' },
  { pattern: /NEXTBILLION/i, label: 'NextBillion' },
  { pattern: /INDIAN CLEARING\s*CORP/i, label: 'Indian Clearing Corp' },
  { pattern: /CREDIT CARD|AUTOPAY|CC\d/i, label: 'Credit Card AutoPay' },
];

const corporateWords = [
  'limited',
  'ltd',
  'pvt',
  'private',
  'bank',
  'india',
  'services',
  'tech',
  'finance',
  'financial',
  'corp',
  'hotel',
  'hotels',
  'pay',
  'store',
  'mart',
  'foods',
  'center',
  'centre',
];

const cleanNarration = (value) => (
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
);

const detectChannel = (text, sourceType = 'bank') => {
  if (sourceType === 'creditCard') return 'CARD';
  if (text.startsWith('UPI-')) return 'UPI';
  if (text.startsWith('ACH D-') || text.startsWith('ACH C-')) return 'ACH';
  if (text.startsWith('NEFTCR-') || text.startsWith('NEFT CR-') || text.startsWith('NEFT DR-') || text.startsWith('NEFTDR-')) return 'NEFT';
  if (text.startsWith('RTGSCR') || text.startsWith('RTGSDR')) return 'RTGS';
  if (text.startsWith('IMPS')) return 'IMPS';
  if (text.startsWith('CC')) return 'CARD';
  if (text.startsWith('CHQ PAID')) return 'CHEQUE';
  if (text.includes('INTEREST')) return 'BANK';
  return 'OTHER';
};

const prettifyMerchant = (value) => {
  const trimmed = String(value || '')
    .replace(/[@0-9].*$/, '')
    .replace(/\b(SBIN|HDFC|ICICI|UTIB|YESB|KKBK|PUNB|BARB|UBIN)[A-Z0-9]*\b/g, '')
    .replace(/\b(PAYMENT|SENT USING PAYTM U|PAY BY WHATSAPP|PAY BY PAYTM|PAYMENT REQUEST|ADD MONEY|UPI MANDATE|MANDATE REFUND TES)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) return 'Other';
  if (trimmed === trimmed.toUpperCase()) {
    return titleCaseLoose(trimmed);
  }
  return trimmed;
};

const extractFallbackMerchant = (narration, sourceType = 'bank') => {
  const text = cleanNarration(narration);

  if (sourceType === 'creditCard') {
    const compact = text
      .replace(/\b(REF(?:ERENCE)?|TXN|TRANSACTION|ID|AUTH|NO|NUMBER)\b[:#-]?\s*[A-Z0-9-]+/gi, '')
      .replace(/\b(?:INR|RS\.?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!compact) return 'Card Merchant';
    return prettifyMerchant(compact);
  }

  if (text.startsWith('UPI-')) {
    return prettifyMerchant(text.slice(4).split('-')[0]);
  }
  if (text.startsWith('ACH C-') || text.startsWith('ACH D-')) {
    return prettifyMerchant(text.split('-').slice(1, 2).join(' '));
  }
  if (text.startsWith('NEFTCR-') || text.startsWith('NEFT CR-') || text.startsWith('NEFT DR-') || text.startsWith('NEFTDR-')) {
    const segments = text.split('-').slice(1).filter(Boolean);
    const candidate = segments.find((segment) => (
      !/\d/.test(segment)
      && !['SBI', 'HDFC', 'ICICI', 'KKBK', 'PUNB', 'UBIN', 'BARB', 'RPC DEL NEFT RTGS INTERMEDI'].includes(segment.trim())
    ));
    return prettifyMerchant(candidate || segments[1] || segments[0] || 'Transfer');
  }
  if (text.startsWith('CC')) return 'Credit Card AutoPay';
  if (text.startsWith('CHQ PAID')) return 'Cheque';
  return prettifyMerchant(text.split('-')[0]);
};

const resolveMerchant = (narration, sourceType = 'bank') => {
  const text = cleanNarration(narration);
  const alias = aliasRules.find((rule) => rule.pattern.test(text));
  return alias ? alias.label : extractFallbackMerchant(text, sourceType);
};

const looksLikePerson = (merchant) => {
  const tokens = String(merchant || '').trim().split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  if (tokens.some((token) => token.length === 1)) return false;
  if (tokens.some((token) => corporateWords.includes(token.toLowerCase()))) return false;
  return tokens.every((token) => /^[A-Za-z]+$/.test(token));
};

const bankDebitBase = (merchant, channel, category, bucketGroup, entryKind = 'directExpense') => ({
  merchant,
  channel,
  category,
  bucketGroup,
  incomeKind: null,
  entryKind,
});

const bankCreditBase = (merchant, channel, category, bucketGroup, incomeKind, entryKind = 'income') => ({
  merchant,
  channel,
  category,
  bucketGroup,
  incomeKind,
  entryKind,
});

const classifyBankTransaction = (transaction, text, merchant, channel) => {
  if (transaction.direction === 'credit') {
    if (/FD PREMAT|PRIN AND INT AUTO[_ ]?REDEEM|AUTO[_ ]?REDEEM|FD CLOSURE|PREMATURE CLOSURE|TERM DEPOSIT CLOSURE/i.test(text)) {
      return bankCreditBase(merchant, channel, 'FD Closure / Redemption', 'wealthReturn', 'capitalReturn', 'wealthReturn');
    }
    if (/INTEREST|DIV|FINALDIV|FINDIV|INT DIV|SPLINTDIV|HDFCBANKSPLINTDIV/i.test(text)) {
      return bankCreditBase(merchant, channel, 'Interest & Dividends', 'income', 'passive', 'income');
    }
    if (/UPIRET|REFUND|REV|REVERSE|REVERSAL|REFUPI|DUP/i.test(text)) {
      return bankCreditBase(merchant, channel, 'Refunds & Reversals', 'income', 'refund', 'refund');
    }
    if (/JILA\s*PANCHAYAT|JILLA?\s*PANCHAYAT|ZILLA\s*PANCHAYAT|NEXTBILLION|SALARY|PAYROLL|CEOJILA|RPC DEL/i.test(text)) {
      return bankCreditBase(merchant, channel, 'Salary / Professional Income', 'income', 'salary', 'income');
    }
    if (/AJAY KUMAR NAHATA|SARITA NAHATA|RACHANA SINGH|ROMIL JAIN|IMPS|TRANSFER|SBI-JAYANT|SHRI JAYANT/i.test(text)) {
      return bankCreditBase(merchant, channel, 'Transfers In', 'income', 'transfer', 'transferIn');
    }
    if (/ACH C-/i.test(text)) {
      return bankCreditBase(merchant, channel, 'Dividends & Corporate Credits', 'income', 'passive', 'income');
    }
    return bankCreditBase(merchant, channel, 'Other Income', 'income', 'other', 'income');
  }

  if (/UPI-LITE|ADD MONEY|WALLET/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Wallet Top Up', 'transfer', 'walletTopUp');
  }
  if (/FD THROUGH MOBILE|FIXED DEPOSIT|TERM DEPOSIT|FD BOOK|FD OPEN|FD CREATE|FD RENEW|TDR/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Fixed Deposit Funding', 'wealth', 'investmentFunding');
  }
  if (/GROWW|GROWWINVESTTECH|INDIAN CLEARING\s*CORP|STOCK|MUTUAL|SIP|BSE\.GROWWPAY|INVEST/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Investments', 'wealth', 'investmentFunding');
  }
  if (/CRED|AUTOPAY|IBBILLPAY|CC\d|CARD PAYMENT|TAD/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Credit Card Settlement', 'debt', 'cardSettlement');
  }
  if (/NETFLIX|APPLE\s*MEDIA|APPLESERVI|SPOTIFY|YOUTUBE|PRIME|HOTSTAR|SONYLIV/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Subscriptions', 'nonEssential');
  }
  if (/UBER|OLA|METRO|RAPIDO/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Local Travel', 'essential');
  }
  if (/IRCTC|AIRTICKETING|CLEARTRIP|EASYTRAVELS|FLIGHT|AIR INDIA|INDIGO/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Trips & Flights', 'nonEssential');
  }
  if (/HOTEL|HOTELS|RESORT|STAY/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Hotels & Stays', 'nonEssential');
  }
  if (/AMAZON|FLIPKART|AJIO|MYNTRA|NYKAA/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Shopping', 'nonEssential');
  }
  if (/BHEL|CAFE|RESTAURANT|FOOD|SWIGGY|ZOMATO|PIZZA|COFFEE|TEA/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Dining & Cafes', 'nonEssential');
  }
  if (/STORE|DAILY NEEDS|GROCERY|MART|MALVIYA STORES|SURAJ BAZAR|GENERAL STORE/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Groceries', 'essential');
  }
  if (/MEDICAL|HOSPITAL|CLINIC|PHARMA|HEALTH/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Healthcare', 'essential');
  }
  if (/BILLDESK|RECHARGE|MOBILE|AIRTEL|JIO|BROADBAND|ELECTRIC|WATER|GAS|FASTAG|DTH|UTILITY/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Bills & Utilities', 'essential');
  }
  if (/CHQ PAID|CHEQUE/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Cheque & Cash', 'transfer', 'transferOut');
  }
  if (/ATM|CASH WDL|CASHWITHDRAWAL/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Cash Withdrawal', 'transfer', 'cashWithdrawal');
  }
  if (/RENT|LEASE|HOUSE|HOUSING/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Housing', 'essential');
  }
  if (/FEE|CHARGE|PENALTY/i.test(text)) {
    return bankDebitBase(merchant, channel, 'Fees & Charges', 'uncategorized', 'fee');
  }
  if (channel === 'UPI' && looksLikePerson(merchant)) {
    return bankDebitBase(merchant, channel, 'Transfers to People', 'transfer', 'transferOut');
  }

  return bankDebitBase(merchant, channel, 'Miscellaneous Spend', 'uncategorized');
};

const cardBase = (merchant, category, bucketGroup, entryKind, incomeKind = null) => ({
  merchant,
  channel: 'CARD',
  category,
  bucketGroup,
  incomeKind,
  entryKind,
});

const classifyCardCharge = (text, merchant) => {
  if (/CASH ADVANCE|ATM CASH|CASH WITHDRAWAL/i.test(text)) {
    return cardBase(merchant, 'Cash Advance', 'transfer', 'cardCashAdvance');
  }
  if (/FINANCE CHARGE|INTEREST CHARGE|INTEREST ON EMI|GST ON INTEREST/i.test(text)) {
    return cardBase(merchant, 'Card Interest & Finance Charges', 'uncategorized', 'cardInterest');
  }
  if (/ANNUAL FEE|MEMBERSHIP FEE|LATE FEE|OVERLIMIT|FEE|CHARGE|GST/i.test(text)) {
    return cardBase(merchant, 'Card Fees & Charges', 'uncategorized', 'cardFee');
  }
  if (/EMI|SMART EMI|LOAN ON CARD|LOAN BOOKING/i.test(text)) {
    return cardBase(merchant, 'Card EMI Purchase', 'capital', 'cardPurchase');
  }

  const pseudoBankTransaction = classifyBankTransaction(
    { direction: 'debit' },
    text,
    merchant,
    'CARD',
  );

  return {
    ...pseudoBankTransaction,
    channel: 'CARD',
    entryKind: 'cardPurchase',
  };
};

const classifyCreditCardTransaction = (transaction, text, merchant) => {
  if (transaction.direction === 'credit') {
    if (/PAYMENT\s+RECEIVED|PAYMENT\s+THANK YOU|PAYMENT\s+CREDIT|AUTOPAY|NEFT|IMPS|UPI|BANK PAYMENT/i.test(text)) {
      return cardBase(merchant, 'Card Payment Received', 'debt', 'cardPaymentReceived');
    }
    if (/CASHBACK|REWARD|SMARTBUY|POINTS CREDIT|BONUS/i.test(text)) {
      return cardBase(merchant, 'Card Rewards & Cashback', 'income', 'refund', 'cardRewardCredit');
    }
    if (/REFUND|REVERSAL|CHARGEBACK|REVERSAL ADJUSTMENT|CR NOTE|CREDIT VOUCHER/i.test(text)) {
      return cardBase(merchant, 'Card Refunds & Reversals', 'income', 'refund', 'cardRefund');
    }
    return cardBase(merchant, 'Card Credits', 'income', 'cardRefund', 'refund');
  }

  return classifyCardCharge(text, merchant);
};

export const classifyTransaction = (transaction) => {
  const narration = cleanNarration(transaction.narration);
  const text = narration.toUpperCase();
  const sourceType = transaction.sourceType || (transaction.accountType === 'credit' ? 'creditCard' : 'bank');
  const merchant = resolveMerchant(narration, sourceType);
  const channel = detectChannel(text, sourceType);

  if (sourceType === 'creditCard') {
    return classifyCreditCardTransaction(transaction, text, merchant);
  }

  return classifyBankTransaction(transaction, text, merchant, channel);
};

export const reclassifyStoredTransaction = (transaction) => ({
  ...transaction,
  ...classifyTransaction({
    ...transaction,
    narration: transaction.narration,
    direction: transaction.direction,
    amount: transaction.amount,
    refNo: transaction.refNo,
    sourceType: transaction.sourceType || (transaction.accountType === 'credit' ? 'creditCard' : 'bank'),
  }),
});
