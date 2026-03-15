import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { classifyTransaction } from './classification.js';
import { buildTransactionKey } from './storage.js';

const workerReady = typeof window !== 'undefined'
  ? import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url').then((module) => {
    GlobalWorkerOptions.workerSrc = module.default;
  })
  : Promise.resolve();

const SHORT_DATE = /^\d{2}\/\d{2}\/\d{2}$/;
const AMOUNT = /^\d[\d,]*\.\d{2}$/;
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

const isWithin = (x, [min, max]) => x >= min && x < max;

const normalizeSpace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const parseAmount = (value) => Number(String(value || '').replace(/,/g, ''));

const toIsoDate = (value) => {
  const [day, month, yearPart] = String(value || '').split('/').map(Number);
  const year = yearPart < 100 ? 2000 + yearPart : yearPart;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const maskAccount = (accountNumber) => {
  if (!accountNumber) return 'HDFC account';
  const last4 = accountNumber.slice(-4);
  return `HDFC ••••${last4}`;
};

const compactLine = (line) => normalizeSpace(line.items.map((item) => item.text).join('')).toUpperCase();

const shouldSkipLine = (line) => {
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

const extractMetadata = (lines) => {
  const fullText = lines.map((line) => normalizeSpace(line.items.map((item) => item.text).join(' '))).join(' ');
  const accountMatch = fullText.match(/Account\s*No\s*:?\s*(\d{10,})/i);
  const periodMatch = fullText.match(/From\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);

  return {
    accountNumber: accountMatch ? accountMatch[1] : '',
    fromDate: periodMatch ? toIsoDate(periodMatch[1]) : '',
    toDate: periodMatch ? toIsoDate(periodMatch[2]) : '',
  };
};

const sha256Hex = async (arrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const parseStatementPdf = async (file, password = '') => {
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

  const allLines = [];
  const transactions = [];
  let currentTransaction = null;

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

    const lines = groupItemsIntoLines(items);
    allLines.push(...lines);

    lines
      .filter((line) => line.top >= CROP_TOP && line.top <= CROP_BOTTOM)
      .forEach((line) => {
        if (shouldSkipLine(line)) return;

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
  }

  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  if (!transactions.length) {
    throw new Error('No transactions were detected. This importer currently expects the HDFC statement layout from your sample PDF.');
  }

  const metadata = extractMetadata(allLines);
  const checksum = await sha256Hex(arrayBuffer);
  const statementId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const minDate = transactions[0]?.date;
  const maxDate = transactions.at(-1)?.date;
  const accountLast4 = metadata.accountNumber ? metadata.accountNumber.slice(-4) : '0000';

  const normalizedTransactions = transactions.map((transaction, index) => {
    const direction = transaction.withdrawal !== null ? 'debit' : 'credit';
    const amount = direction === 'debit' ? transaction.withdrawal : transaction.deposit;
    const narration = normalizeSpace(transaction.narrationParts.join(' '));
    const refNo = normalizeSpace(transaction.refParts.join(' '));
    const classification = classifyTransaction({
      ...transaction,
      direction,
      amount,
      narration,
      refNo,
    });

    const nextTransaction = {
      id: crypto.randomUUID(),
      order: index,
      statementId,
      statementChecksum: checksum,
      statementName: file.name,
      accountLast4,
      accountLabel: maskAccount(metadata.accountNumber),
      institution: 'HDFC Bank',
      date: transaction.date,
      valueDate: transaction.valueDate,
      year: Number(transaction.date.slice(0, 4)),
      monthKey: transaction.date.slice(0, 7),
      direction,
      amount: Number(amount || 0),
      balance: Number(transaction.balance || 0),
      narration,
      refNo,
      importedAt,
      ...classification,
    };

    return {
      ...nextTransaction,
      uniqueKey: buildTransactionKey(nextTransaction),
    };
  });

  return {
    statement: {
      id: statementId,
      checksum,
      sourceName: file.name,
      fileSize: file.size,
      importedAt,
      institution: 'HDFC Bank',
      accountLast4,
      accountLabel: maskAccount(metadata.accountNumber),
      fromDate: metadata.fromDate || minDate,
      toDate: metadata.toDate || maxDate,
      transactionCount: normalizedTransactions.length,
    },
    transactions: normalizedTransactions,
  };
};
