import { titleCaseLoose } from './format.js';

const aliasRules = [
  { pattern: /NETFLIX/i, label: 'Netflix' },
  { pattern: /APPLE\s*MEDIA|APPLESERVI|APPLE SERVICES/i, label: 'Apple Services' },
  { pattern: /GROWWINVESTTECH|GROWW|BSE\.GROWWPAY/i, label: 'Groww' },
  { pattern: /CRED/i, label: 'Cred' },
  { pattern: /IRCTC/i, label: 'IRCTC' },
  { pattern: /UBER/i, label: 'Uber' },
  { pattern: /CLEARTRIP/i, label: 'Cleartrip' },
  { pattern: /EASYTRAVELS/i, label: 'EasyTravels' },
  { pattern: /AMAZON\s*PAY|AMAZON INDIA|AMAZON/i, label: 'Amazon' },
  { pattern: /FLIPKART/i, label: 'Flipkart' },
  { pattern: /AJIO/i, label: 'AJIO' },
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

const corporateWords = ['limited', 'ltd', 'pvt', 'private', 'bank', 'india', 'services', 'tech', 'finance', 'financial', 'corp', 'hotel', 'hotels', 'pay', 'store', 'mart', 'foods', 'center', 'centre'];

const cleanNarration = (value) => (
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
);

const detectChannel = (text) => {
  if (text.startsWith('UPI-')) return 'UPI';
  if (text.startsWith('ACH D-') || text.startsWith('ACH C-')) return 'ACH';
  if (text.startsWith('NEFTCR-') || text.startsWith('NEFT CR-') || text.startsWith('NEFT DR-') || text.startsWith('NEFTDR-')) return 'NEFT';
  if (text.startsWith('RTGSCR')) return 'RTGS';
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

const extractFallbackMerchant = (narration) => {
  const text = cleanNarration(narration);

  if (text.startsWith('UPI-')) {
    return prettifyMerchant(text.slice(4).split('-')[0]);
  }
  if (text.startsWith('ACH C-') || text.startsWith('ACH D-')) {
    return prettifyMerchant(text.split('-').slice(1, 2).join(' '));
  }
  if (text.startsWith('NEFTCR-') || text.startsWith('NEFT CR-') || text.startsWith('NEFT DR-') || text.startsWith('NEFTDR-')) {
    const segments = text.split('-').slice(1).filter(Boolean);
    const candidate = segments.find((segment) => (
      !/\d/.test(segment) && !['SBI', 'HDFC', 'ICICI', 'KKBK', 'PUNB', 'UBIN', 'BARB', 'RPC DEL NEFT RTGS INTERMEDI'].includes(segment.trim())
    ));
    return prettifyMerchant(candidate || segments[1] || segments[0] || 'Transfer');
  }
  if (text.startsWith('CC')) return 'Credit Card AutoPay';
  if (text.startsWith('CHQ PAID')) return 'Cheque';
  return prettifyMerchant(text.split('-')[0]);
};

const resolveMerchant = (narration) => {
  const text = cleanNarration(narration);
  const alias = aliasRules.find((rule) => rule.pattern.test(text));
  return alias ? alias.label : extractFallbackMerchant(text);
};

const looksLikePerson = (merchant) => {
  const tokens = String(merchant || '').trim().split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  if (tokens.some((token) => token.length === 1)) return false;
  if (tokens.some((token) => corporateWords.includes(token.toLowerCase()))) return false;
  return tokens.every((token) => /^[A-Za-z]+$/.test(token));
};

export const classifyTransaction = (transaction) => {
  const narration = cleanNarration(transaction.narration);
  const text = narration.toUpperCase();
  const merchant = resolveMerchant(narration);
  const channel = detectChannel(text);

  if (transaction.direction === 'credit') {
    if (/FD PREMAT|PRIN AND INT AUTO[_ ]?REDEEM|AUTO[_ ]?REDEEM|FD CLOSURE|PREMATURE CLOSURE|TERM DEPOSIT CLOSURE/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'FD Closure / Redemption',
        bucketGroup: 'wealthReturn',
        incomeKind: 'capitalReturn',
      };
    }
    if (/INTEREST|DIV|FINALDIV|FINDIV|INT DIV|SPLINTDIV|HDFCBANKSPLINTDIV/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'Interest & Dividends',
        bucketGroup: 'income',
        incomeKind: 'passive',
      };
    }
    if (/UPIRET|REFUND|REV|REVERSE|REVERSAL|REFUPI|DUP/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'Refunds & Reversals',
        bucketGroup: 'income',
        incomeKind: 'refund',
      };
    }
    if (/JILA\s*PANCHAYAT|JILLA?\s*PANCHAYAT|ZILLA\s*PANCHAYAT|NEXTBILLION|SALARY|PAYROLL|CEOJILA|RPC DEL/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'Salary / Professional Income',
        bucketGroup: 'income',
        incomeKind: 'salary',
      };
    }
    if (/AJAY KUMAR NAHATA|SARITA NAHATA|RACHANA SINGH|ROMIL JAIN|IMPS|TRANSFER|SBI-JAYANT|SHRI JAYANT/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'Transfers In',
        bucketGroup: 'income',
        incomeKind: 'transfer',
      };
    }
    if (/ACH C-/i.test(text)) {
      return {
        merchant,
        channel,
        category: 'Dividends & Corporate Credits',
        bucketGroup: 'income',
        incomeKind: 'passive',
      };
    }
    return {
      merchant,
      channel,
      category: 'Other Income',
      bucketGroup: 'income',
      incomeKind: 'other',
    };
  }

  if (/UPI-LITE|ADD MONEY|WALLET/i.test(text)) {
    return { merchant, channel, category: 'Wallet Top Up', bucketGroup: 'transfer', incomeKind: null };
  }
  if (/FD THROUGH MOBILE|FIXED DEPOSIT|TERM DEPOSIT|FD BOOK|FD OPEN|FD CREATE|FD RENEW|TDR/i.test(text)) {
    return { merchant, channel, category: 'Fixed Deposit Funding', bucketGroup: 'wealth', incomeKind: null };
  }
  if (/GROWW|GROWWINVESTTECH|INDIAN CLEARING\s*CORP|STOCK|MUTUAL|SIP|BSE\.GROWWPAY|INVEST/i.test(text)) {
    return { merchant, channel, category: 'Investments', bucketGroup: 'wealth', incomeKind: null };
  }
  if (/CRED|AUTOPAY|IBBILLPAY|CC\d|CARD PAYMENT|TAD/i.test(text)) {
    return { merchant, channel, category: 'Credit Card Payment', bucketGroup: 'debt', incomeKind: null };
  }
  if (/NETFLIX|APPLE\s*MEDIA|APPLESERVI|SPOTIFY|YOUTUBE|PRIME|HOTSTAR|SONYLIV/i.test(text)) {
    return { merchant, channel, category: 'Subscriptions', bucketGroup: 'nonEssential', incomeKind: null };
  }
  if (/UBER|OLA|METRO|RAPIDO/i.test(text)) {
    return { merchant, channel, category: 'Local Travel', bucketGroup: 'essential', incomeKind: null };
  }
  if (/IRCTC|AIRTICKETING|CLEARTRIP|EASYTRAVELS|FLIGHT|AIR INDIA|INDIGO/i.test(text)) {
    return { merchant, channel, category: 'Trips & Flights', bucketGroup: 'nonEssential', incomeKind: null };
  }
  if (/HOTEL|HOTELS|RESORT|STAY/i.test(text)) {
    return { merchant, channel, category: 'Hotels & Stays', bucketGroup: 'nonEssential', incomeKind: null };
  }
  if (/AMAZON|FLIPKART|AJIO|MYNTRA|NYKAA/i.test(text)) {
    return { merchant, channel, category: 'Shopping', bucketGroup: 'nonEssential', incomeKind: null };
  }
  if (/BHEL|CAFE|RESTAURANT|FOOD|SWIGGY|ZOMATO|PIZZA|COFFEE|TEA/i.test(text)) {
    return { merchant, channel, category: 'Dining & Cafes', bucketGroup: 'nonEssential', incomeKind: null };
  }
  if (/STORE|DAILY NEEDS|GROCERY|MART|MALVIYA STORES|SURAJ BAZAR|GENERAL STORE/i.test(text)) {
    return { merchant, channel, category: 'Groceries', bucketGroup: 'essential', incomeKind: null };
  }
  if (/MEDICAL|HOSPITAL|CLINIC|PHARMA|HEALTH/i.test(text)) {
    return { merchant, channel, category: 'Healthcare', bucketGroup: 'essential', incomeKind: null };
  }
  if (/BILLDESK|RECHARGE|MOBILE|AIRTEL|JIO|BROADBAND|ELECTRIC|WATER|GAS|FASTAG|DTH|UTILITY/i.test(text)) {
    return { merchant, channel, category: 'Bills & Utilities', bucketGroup: 'essential', incomeKind: null };
  }
  if (/CHQ PAID|CHEQUE/i.test(text)) {
    return { merchant, channel, category: 'Cheque & Cash', bucketGroup: 'transfer', incomeKind: null };
  }
  if (/ATM|CASH WDL|CASHWITHDRAWAL/i.test(text)) {
    return { merchant, channel, category: 'Cash Withdrawal', bucketGroup: 'transfer', incomeKind: null };
  }
  if (/RENT|LEASE|HOUSE|HOUSING/i.test(text)) {
    return { merchant, channel, category: 'Housing', bucketGroup: 'essential', incomeKind: null };
  }
  if (/FEE|CHARGE|PENALTY/i.test(text)) {
    return { merchant, channel, category: 'Fees & Charges', bucketGroup: 'uncategorized', incomeKind: null };
  }
  if (channel === 'UPI' && looksLikePerson(merchant)) {
    return { merchant, channel, category: 'Transfers to People', bucketGroup: 'transfer', incomeKind: null };
  }

  return {
    merchant,
    channel,
    category: 'Miscellaneous Spend',
    bucketGroup: 'uncategorized',
    incomeKind: null,
  };
};

export const reclassifyStoredTransaction = (transaction) => ({
  ...transaction,
  ...classifyTransaction({
    ...transaction,
    narration: transaction.narration,
    direction: transaction.direction,
    amount: transaction.amount,
    refNo: transaction.refNo,
  }),
});
