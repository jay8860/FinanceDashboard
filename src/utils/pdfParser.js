import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { classifyTransaction } from './classification.js';
import { buildTransactionKey } from './storage.js';

const workerReady = typeof window !== 'undefined'
  ? import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url').then((module) => {
    GlobalWorkerOptions.workerSrc = module.default;
  })
  : Promise.resolve();

const SHORT_DATE = /^\d{2}\/\d{2}\/\d{2}$/;
const LONG_DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const CARD_DATE = /^(?:\d{2}[/-]\d{2}(?:[/-]\d{2,4})?|\d{2}[\s-][A-Za-z]{3}[\s-]\d{2,4})$/;
const AMOUNT = /^-?\(?\d[\d,]*\.\d{2}\)?$/;
const CROP_TOP = 228;
const CROP_BOTTOM = 780;

const ranges = {
  date: [0, 70],
  narration: [64, 270],
  ref: [270, 355],
  valueDate: [355, 400],
  withdrawal: [420, 495],
  deposit: [500, 565],
  balance: [585, 640],
};

const monthMap = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const isWithin = (x, [min, max]) => x >= min && x < max;

const normalizeSpace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const lineText = (line) => normalizeSpace(line.items.map((item) => item.text).join(' '));

const parseAmount = (value) => Number(
  String(value || '')
    .replace(/[(),]/g, '')
    .replace(/^-/, ''),
);

const toIsoDate = (value) => {
  const [day, month, yearPart] = String(value || '').split('/').map(Number);
  const year = yearPart < 100 ? 2000 + yearPart : yearPart;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toIsoFlexibleDate = (value, fallbackYear) => {
  const text = normalizeSpace(value).replace(/-/g, ' ');

  if (LONG_DATE.test(text) || SHORT_DATE.test(text)) {
    return toIsoDate(text.replace(/-/g, '/'));
  }

  const parts = text.split(' ');
  if (parts.length === 3 && monthMap[parts[1]?.slice(0, 3).toUpperCase()]) {
    const day = Number(parts[0]);
    const month = monthMap[parts[1].slice(0, 3).toUpperCase()];
    const rawYear = Number(parts[2]);
    const year = Number.isFinite(rawYear) && rawYear > 0
      ? (rawYear < 100 ? 2000 + rawYear : rawYear)
      : Number(fallbackYear || new Date().getFullYear());

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return '';
};

const maskAccount = (accountNumber) => {
  if (!accountNumber) return 'HDFC account';
  const last4 = accountNumber.slice(-4);
  return `HDFC ••••${last4}`;
};

const maskCard = (cardNumber, institution = 'Credit Card') => {
  const last4 = cardNumber ? cardNumber.slice(-4) : '0000';
  const label = institution.replace(/\s+Bank$/i, '').trim() || 'Credit Card';
  return `${label} Card ••••${last4}`;
};

const compactLine = (line) => lineText(line).toUpperCase().replace(/\s+/g, '');

const shouldSkipBankLine = (line) => {
  const compact = compactLine(line);
  return (
    compact.startsWith('DATENARRATION')
    || compact.startsWith('PAGENO')
    || compact.startsWith('HDFCBANKLIMITED')
    || compact.startsWith('*CLOSINGBALANCE')
    || compact.startsWith('CONTENTSOFTHISSTATEMENT')
    || compact.startsWith('STATEACCOUNTBRANCHGSTN')
    || compact.startsWith('REGISTEREDOFFICEADDRESS')
  );
};

const shouldSkipCardLine = (text) => (
  !text
  || /^page\s+\d+/i.test(text)
  || /^(transaction|trans) details$/i.test(text)
  || /statement summary/i.test(text)
  || /customer care|call us|email us|terms and conditions|this is a system generated/i.test(text)
  || /total amount due|minimum amount due|payment due date|available credit limit|available cash limit|cash limit available/i.test(text)
  || /previous balance|opening balance|closing balance|credit limit|reward points|statement date|card number/i.test(text)
  || /^domestic transactions$/i.test(text)
  || /^international transactions$/i.test(text)
  || /^retail transactions$/i.test(text)
  || /^cash transactions$/i.test(text)
  || /^date\s+/i.test(text)
);

const groupItemsIntoLines = (items) => {
  const rows = [];
  const sorted = [...items].sort((left, right) => (
    left.top === right.top ? left.x - right.x : left.top - right.top
  ));

  sorted.forEach((item) => {
    const lastRow = rows.at(-1);
    if (lastRow && Math.abs(lastRow.top - item.top) <= 2.5) {
      lastRow.items.push(item);
      return;
    }
    rows.push({ top: item.top, items: [item] });
  });

  return rows.map((row) => ({
    ...row,
    items: row.items.sort((left, right) => left.x - right.x),
  }));
};

const selectCellText = (line, column) => normalizeSpace(
  line.items
    .filter((item) => isWithin(item.x, ranges[column]))
    .map((item) => item.text)
    .join(' '),
);

const selectAmountText = (line, column) => {
  const match = line.items
    .filter((item) => isWithin(item.x, ranges[column]) && AMOUNT.test(item.text))
    .at(-1);
  return match ? match.text : '';
};

const sha256Hex = async (arrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const buildPageModels = async (pdf) => {
  const pages = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ({
        text: normalizeSpace(item.str),
        x: item.transform[4],
        top: viewport.height - item.transform[5],
      }))
      .filter((item) => item.text);

    pages.push({
      pageNumber: pageIndex + 1,
      lines: groupItemsIntoLines(items),
    });
  }

  return pages;
};

const extractBankMetadata = (lines) => {
  const fullText = lines.map((line) => lineText(line)).join(' ');
  const accountMatch = fullText.match(/Account\s*No\s*:?\s*(\d{10,})/i);
  const periodMatch = fullText.match(/From\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);

  return {
    accountNumber: accountMatch ? accountMatch[1] : '',
    fromDate: periodMatch ? toIsoDate(periodMatch[1]) : '',
    toDate: periodMatch ? toIsoDate(periodMatch[2]) : '',
  };
};

const extractCardMetadata = (fullText, fallbackRange) => {
  const cardMatch = fullText.match(/Card(?:\s+Number|\s+No\.?)?[^0-9A-Z]{0,16}(?:[Xx*]{2,}[\s-]*)?(\d{4})/i)
    || fullText.match(/\b(?:XXXX|xxxx|\*\*\*\*|\bXX\b)[Xx*\s-]*?(\d{4})\b/);
  const statementDateMatch = fullText.match(/Statement\s*Date\s*:?\s*([0-9]{2}[\/-][0-9]{2}(?:[\/-][0-9]{2,4})?|[0-9]{2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/i);
  const periodMatch = fullText.match(/Statement\s*Period\s*:?\s*([0-9]{2}[\/-][0-9]{2}(?:[\/-][0-9]{2,4})?|[0-9]{2}\s+[A-Za-z]{3}\s+[0-9]{2,4})\s*(?:to|-)\s*([0-9]{2}[\/-][0-9]{2}(?:[\/-][0-9]{2,4})?|[0-9]{2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/i);
  const institution = /HDFC/i.test(fullText)
    ? 'HDFC Bank'
    : (/ICICI/i.test(fullText) ? 'ICICI Bank' : 'Credit Card');
  const statementDate = statementDateMatch ? toIsoFlexibleDate(statementDateMatch[1]) : '';

  return {
    cardLast4: cardMatch ? cardMatch[1] : '0000',
    fromDate: periodMatch ? toIsoFlexibleDate(periodMatch[1], statementDate?.slice(0, 4)) : fallbackRange.minDate,
    toDate: periodMatch ? toIsoFlexibleDate(periodMatch[2], statementDate?.slice(0, 4)) : fallbackRange.maxDate,
    institution,
    statementDate,
  };
};

const finalizeTransactions = ({
  file,
  checksum,
  statementId,
  importedAt,
  sourceType,
  accountType,
  accountLast4,
  accountLabel,
  institution,
  rows,
}) => rows.map((transaction, index) => {
  const classification = classifyTransaction({
    ...transaction,
    sourceType,
    accountType,
  });

  const nextTransaction = {
    id: crypto.randomUUID(),
    order: index,
    statementId,
    statementChecksum: checksum,
    statementName: file.name,
    sourceType,
    accountType,
    accountLast4,
    accountLabel,
    institution,
    date: transaction.date,
    valueDate: transaction.valueDate || transaction.date,
    year: Number((transaction.date || '').slice(0, 4)),
    monthKey: (transaction.date || '').slice(0, 7),
    direction: transaction.direction,
    amount: Number(transaction.amount || 0),
    balance: transaction.balance === null || transaction.balance === undefined
      ? null
      : Number(transaction.balance || 0),
    narration: transaction.narration,
    refNo: transaction.refNo || '',
    importedAt,
    ...classification,
  };

  return {
    ...nextTransaction,
    uniqueKey: buildTransactionKey(nextTransaction),
  };
});

const parseBankStatementPages = ({ pages, file, checksum, importedAt }) => {
  const allLines = pages.flatMap((page) => page.lines);
  const transactions = [];
  let currentTransaction = null;

  pages.forEach((page) => {
    page.lines
      .filter((line) => line.top >= CROP_TOP && line.top <= CROP_BOTTOM)
      .forEach((line) => {
        if (shouldSkipBankLine(line)) return;

        const dateText = line.items.find((item) => isWithin(item.x, ranges.date) && SHORT_DATE.test(item.text))?.text || '';
        const valueDateText = line.items.find((item) => isWithin(item.x, ranges.valueDate) && SHORT_DATE.test(item.text))?.text || '';
        const balanceText = selectAmountText(line, 'balance');
        const narrationText = selectCellText(line, 'narration');
        const refText = selectCellText(line, 'ref');
        const withdrawalText = selectAmountText(line, 'withdrawal');
        const depositText = selectAmountText(line, 'deposit');

        if (dateText && valueDateText && balanceText) {
          if (currentTransaction) {
            transactions.push(currentTransaction);
          }
          currentTransaction = {
            date: toIsoDate(dateText),
            valueDate: toIsoDate(valueDateText),
            balance: parseAmount(balanceText),
            withdrawal: withdrawalText ? parseAmount(withdrawalText) : null,
            deposit: depositText ? parseAmount(depositText) : null,
            narrationParts: narrationText ? [narrationText] : [],
            refParts: refText ? [refText] : [],
          };
          return;
        }

        if (!currentTransaction) return;

        if (narrationText) currentTransaction.narrationParts.push(narrationText);
        if (refText) currentTransaction.refParts.push(refText);
      });
  });

  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  if (!transactions.length) {
    throw new Error('No transactions were detected. This bank importer expects the HDFC account statement layout from your sample PDF.');
  }

  const metadata = extractBankMetadata(allLines);
  const statementId = crypto.randomUUID();
  const normalizedTransactions = finalizeTransactions({
    file,
    checksum,
    statementId,
    importedAt,
    sourceType: 'bank',
    accountType: 'cash',
    accountLast4: metadata.accountNumber ? metadata.accountNumber.slice(-4) : '0000',
    accountLabel: maskAccount(metadata.accountNumber),
    institution: 'HDFC Bank',
    rows: transactions.map((transaction) => {
      const direction = transaction.withdrawal !== null ? 'debit' : 'credit';
      const amount = direction === 'debit' ? transaction.withdrawal : transaction.deposit;

      return {
        date: transaction.date,
        valueDate: transaction.valueDate,
        direction,
        amount,
        balance: transaction.balance,
        narration: normalizeSpace(transaction.narrationParts.join(' ')),
        refNo: normalizeSpace(transaction.refParts.join(' ')),
      };
    }),
  });

  const minDate = normalizedTransactions[0]?.date;
  const maxDate = normalizedTransactions.at(-1)?.date;

  return {
    statement: {
      id: statementId,
      checksum,
      sourceName: file.name,
      fileSize: file.size,
      importedAt,
      institution: 'HDFC Bank',
      sourceType: 'bank',
      accountType: 'cash',
      accountLast4: metadata.accountNumber ? metadata.accountNumber.slice(-4) : '0000',
      accountLabel: maskAccount(metadata.accountNumber),
      fromDate: metadata.fromDate || minDate,
      toDate: metadata.toDate || maxDate,
      transactionCount: normalizedTransactions.length,
    },
    transactions: normalizedTransactions,
  };
};

const cardRowRegex = /^(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?|\d{2}[\s-][A-Za-z]{3}[\s-]\d{2,4})(?:\s+(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?|\d{2}[\s-][A-Za-z]{3}[\s-]\d{2,4}))?\s+(.+?)\s+(-?\(?\d[\d,]*\.\d{2}\)?)(?:\s*(CR|DR))?$/i;

const extractCardReference = (description) => {
  const matches = String(description || '').match(/\b[A-Z0-9]{8,}\b/g);
  if (!matches?.length) return '';
  return matches.at(-1);
};

const normalizeCardDescription = (value) => normalizeSpace(
  String(value || '')
    .replace(/\b(?:INR|RS\.?)\b/gi, '')
    .replace(/\s+/g, ' '),
);

const inferCardDirection = (text, explicitDirection, amountText) => {
  if (explicitDirection) return explicitDirection.toUpperCase() === 'CR' ? 'credit' : 'debit';
  if (/^-|\(/.test(String(amountText || ''))) return 'credit';
  if (/PAYMENT\s+RECEIVED|PAYMENT\s+THANK YOU|REFUND|REVERSAL|CASHBACK|REWARD|CREDIT/i.test(text)) return 'credit';
  return 'debit';
};

const parseCreditCardStatementPages = ({ pages, file, checksum, importedAt }) => {
  const allLines = pages.flatMap((page) => page.lines);
  const joinedText = allLines.map((line) => lineText(line)).join('\n');
  const transactions = [];
  let currentTransaction = null;

  allLines.forEach((line) => {
    const text = lineText(line);
    if (!text) return;

    const match = text.match(cardRowRegex);
    if (match) {
      if (currentTransaction) transactions.push(currentTransaction);

      const [, firstDate, secondDate, descriptionText, amountText, explicitDirection] = match;
      const normalizedDescription = normalizeCardDescription(descriptionText);
      const refNo = extractCardReference(normalizedDescription);
      const direction = inferCardDirection(normalizedDescription, explicitDirection, amountText);

      currentTransaction = {
        date: toIsoFlexibleDate(firstDate),
        valueDate: toIsoFlexibleDate(secondDate || firstDate),
        direction,
        amount: parseAmount(amountText),
        balance: null,
        narrationParts: normalizedDescription ? [normalizedDescription] : [],
        refNo,
      };
      return;
    }

    if (!currentTransaction || shouldSkipCardLine(text)) return;

    const continuation = normalizeCardDescription(text);
    if (!continuation) return;
    currentTransaction.narrationParts.push(continuation);
  });

  if (currentTransaction) transactions.push(currentTransaction);

  const cleanedTransactions = transactions
    .map((transaction) => ({
      ...transaction,
      narration: normalizeSpace(transaction.narrationParts.join(' ')),
    }))
    .filter((transaction) => transaction.date && transaction.amount > 0 && transaction.narration);

  if (!cleanedTransactions.length) {
    throw new Error('No credit card transactions were detected. Try choosing the correct import type, or add a sample credit card PDF so we can tune this parser to your statement layout.');
  }

  const fallbackRange = {
    minDate: [...cleanedTransactions].sort((left, right) => left.date.localeCompare(right.date))[0]?.date || '',
    maxDate: [...cleanedTransactions].sort((left, right) => right.date.localeCompare(left.date))[0]?.date || '',
  };
  const metadata = extractCardMetadata(joinedText, fallbackRange);
  const statementId = crypto.randomUUID();
  const normalizedTransactions = finalizeTransactions({
    file,
    checksum,
    statementId,
    importedAt,
    sourceType: 'creditCard',
    accountType: 'credit',
    accountLast4: metadata.cardLast4,
    accountLabel: maskCard(metadata.cardLast4, metadata.institution),
    institution: metadata.institution,
    rows: cleanedTransactions.map((transaction) => ({
      ...transaction,
      refNo: transaction.refNo || '',
    })),
  });

  return {
    statement: {
      id: statementId,
      checksum,
      sourceName: file.name,
      fileSize: file.size,
      importedAt,
      institution: metadata.institution,
      sourceType: 'creditCard',
      accountType: 'credit',
      accountLast4: metadata.cardLast4,
      accountLabel: maskCard(metadata.cardLast4, metadata.institution),
      fromDate: metadata.fromDate || fallbackRange.minDate,
      toDate: metadata.toDate || fallbackRange.maxDate,
      transactionCount: normalizedTransactions.length,
    },
    transactions: normalizedTransactions,
  };
};

const detectStatementType = (pages) => {
  const sampleText = pages
    .slice(0, 2)
    .flatMap((page) => page.lines.map((line) => lineText(line)))
    .join(' ')
    .toUpperCase();

  if (/ACCOUNT NO|ACCOUNT STATEMENT|DATENARRATION|CLOSING BALANCE/.test(sampleText)) {
    return 'bank';
  }
  if (/TOTAL AMOUNT DUE|MINIMUM AMOUNT DUE|PAYMENT DUE DATE|CARD NUMBER|CREDIT CARD STATEMENT/.test(sampleText)) {
    return 'creditCard';
  }
  return 'unknown';
};

export const parseStatementPdf = async (file, password = '', options = {}) => {
  await workerReady;

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let pdf;
  try {
    pdf = await getDocument({
      data,
      password,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;
  } catch (error) {
    if (error?.name === 'PasswordException') {
      throw new Error('Could not open this PDF. Please check the statement password and try again.');
    }
    throw error;
  }

  const pages = await buildPageModels(pdf);
  const checksum = await sha256Hex(arrayBuffer);
  const importedAt = new Date().toISOString();
  const preferredType = options.statementType || 'auto';
  const detectedType = detectStatementType(pages);

  const parseBank = () => parseBankStatementPages({ pages, file, checksum, importedAt });
  const parseCard = () => parseCreditCardStatementPages({ pages, file, checksum, importedAt });

  if (preferredType === 'bank') return parseBank();
  if (preferredType === 'creditCard') return parseCard();

  if (detectedType === 'bank') return parseBank();
  if (detectedType === 'creditCard') return parseCard();

  try {
    return parseBank();
  } catch (bankError) {
    try {
      return parseCard();
    } catch {
      throw bankError;
    }
  }
};
