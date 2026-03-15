import { getDay } from 'date-fns';
import { monthLabelFromKey } from './format.js';

const addAmount = (map, key, amount, seed = {}) => {
  const current = map.get(key) || { ...seed };
  current.amount = Number(current.amount || 0) + Number(amount || 0);
  map.set(key, current);
};

const sumAmount = (rows, accessor = (row) => row.amount) => rows.reduce(
  (total, row) => total + Number(accessor(row) || 0),
  0,
);

const stdDev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const isCashAccount = (transaction) => (transaction.accountType || 'cash') === 'cash';
const isCardAccount = (transaction) => (transaction.accountType || 'cash') === 'credit';
const isWealthReturn = (transaction) => transaction.bucketGroup === 'wealthReturn';
const isCardSettlement = (transaction) => transaction.entryKind === 'cardSettlement';

const isDirectBankSpend = (transaction) => (
  isCashAccount(transaction)
  && transaction.direction === 'debit'
  && !['wealth', 'debt', 'transfer'].includes(transaction.bucketGroup)
  && !isCardSettlement(transaction)
);

const isCardSpend = (transaction) => (
  isCardAccount(transaction)
  && transaction.direction === 'debit'
  && !['cardPaymentReceived', 'cardCashAdvance'].includes(transaction.entryKind)
);

const isSpendRefund = (transaction) => (
  transaction.direction === 'credit'
  && (
    (isCashAccount(transaction) && transaction.category === 'Refunds & Reversals')
    || (isCardAccount(transaction) && ['cardRefund', 'cardRewardCredit'].includes(transaction.entryKind))
  )
);

const isCashIncome = (transaction) => (
  isCashAccount(transaction)
  && transaction.direction === 'credit'
  && !isWealthReturn(transaction)
);

const buildRankings = (rows, key, minCount = 1, amountAccessor = (row) => row.amount) => {
  const groups = new Map();

  rows.forEach((row) => {
    const label = row[key] || 'Other';
    const amount = Number(amountAccessor(row) || 0);
    const current = groups.get(label) || {
      label,
      amount: 0,
      count: 0,
      lastDate: row.date,
      category: row.category,
    };
    current.amount += amount;
    current.count += 1;
    current.lastDate = current.lastDate > row.date ? current.lastDate : row.date;
    current.category = row.category;
    groups.set(label, current);
  });

  return [...groups.values()]
    .filter((item) => item.count >= minCount)
    .sort((left, right) => right.amount - left.amount);
};

const detectSalaryLikeSources = (credits) => {
  const groups = new Map();

  credits.forEach((credit) => {
    const current = groups.get(credit.merchant) || {
      merchant: credit.merchant,
      count: 0,
      amounts: [],
      months: new Set(),
      categories: new Set(),
      total: 0,
    };
    current.count += 1;
    current.amounts.push(Number(credit.amount || 0));
    current.months.add(credit.monthKey);
    current.categories.add(credit.category);
    current.total += Number(credit.amount || 0);
    groups.set(credit.merchant, current);
  });

  return [...groups.values()]
    .map((group) => {
      const average = group.total / group.count;
      const volatility = average ? stdDev(group.amounts) / average : 0;
      const obviousSalary = [...group.categories].includes('Salary / Professional Income')
        || /PANCHAYAT|NEXTBILLION|SALARY|PAYROLL/i.test(group.merchant || '');

      return {
        merchant: group.merchant,
        count: group.count,
        total: group.total,
        months: group.months.size,
        average,
        volatility,
        isSalaryLike: group.months.size >= 3 && average >= 15000 && (obviousSalary || volatility <= 0.35),
      };
    })
    .filter((group) => group.isSalaryLike)
    .sort((left, right) => right.total - left.total);
};

const detectSubscriptions = (rows) => {
  const groups = new Map();

  rows
    .filter((row) => row.category === 'Subscriptions')
    .forEach((row) => {
      const current = groups.get(row.merchant) || {
        merchant: row.merchant,
        count: 0,
        total: 0,
        months: new Set(),
      };
      current.count += 1;
      current.total += Number(row.amount || 0);
      current.months.add(row.monthKey);
      groups.set(row.merchant, current);
    });

  return [...groups.values()]
    .map((group) => ({
      merchant: group.merchant,
      count: group.count,
      activeMonths: group.months.size,
      averageAmount: group.total / group.count,
      total: group.total,
    }))
    .filter((group) => group.activeMonths >= 3)
    .sort((left, right) => right.total - left.total);
};

const buildCardAccountSummaries = (cardTransactions, statements) => {
  const statementCounts = new Map();
  (statements || [])
    .filter((statement) => statement.accountType === 'credit')
    .forEach((statement) => {
      const key = statement.accountLabel || statement.accountLast4 || 'Card';
      statementCounts.set(key, (statementCounts.get(key) || 0) + 1);
    });

  const groups = new Map();
  cardTransactions.forEach((transaction) => {
    const label = transaction.accountLabel || `Card ••••${transaction.accountLast4 || '0000'}`;
    const current = groups.get(label) || {
      label,
      transactionCount: 0,
      spend: 0,
      refunds: 0,
      payments: 0,
      fees: 0,
      lastDate: transaction.date,
      statementCount: statementCounts.get(label) || 0,
    };

    current.transactionCount += 1;
    current.lastDate = current.lastDate > transaction.date ? current.lastDate : transaction.date;

    if (isCardSpend(transaction)) current.spend += Number(transaction.amount || 0);
    if (isSpendRefund(transaction) && isCardAccount(transaction)) current.refunds += Number(transaction.amount || 0);
    if (transaction.entryKind === 'cardPaymentReceived') current.payments += Number(transaction.amount || 0);
    if (['cardFee', 'cardInterest'].includes(transaction.entryKind)) current.fees += Number(transaction.amount || 0);

    groups.set(label, current);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      netSpend: group.spend - group.refunds,
    }))
    .sort((left, right) => right.netSpend - left.netSpend);
};

const buildInsights = ({
  monthSeries,
  cashCategoryRanking,
  trueSpendCategoryRanking,
  cashMerchantRanking,
  trueSpendMerchantRanking,
  biggestDebit,
  biggestCredit,
  biggestSpend,
  coreSpend,
  lifestyleSpend,
  moneyMoves,
  passiveIncome,
  salaryLikeSources,
  wealthReturnTotal,
  outflowTotal,
  creditCardSpendTotal,
  cardSettlementTotal,
}) => {
  const insights = [];
  const activeMonths = monthSeries.filter((month) => month.outflow > 0);
  const topSpendCategory = trueSpendCategoryRanking[0] || cashCategoryRanking[0];
  const topMerchant = trueSpendMerchantRanking[0] || cashMerchantRanking[0];

  if (topSpendCategory) {
    insights.push({
      title: 'Top spend lane',
      body: `${topSpendCategory.label} led the spend view at ${topSpendCategory.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  if (activeMonths.length >= 2) {
    const byOutflow = [...activeMonths].sort((left, right) => right.outflow - left.outflow);
    insights.push({
      title: 'Peak vs quiet cash month',
      body: `${monthLabelFromKey(byOutflow[0].monthKey)} was the heaviest cash-out month, while ${monthLabelFromKey(byOutflow.at(-1).monthKey)} was the lightest.`,
    });
  }

  if (outflowTotal > 0) {
    const consumerSpend = coreSpend + lifestyleSpend;
    const lifestyleShare = consumerSpend ? (lifestyleSpend / consumerSpend) * 100 : 0;
    insights.push({
      title: 'Essentials vs lifestyle',
      body: `Core living spend came to ${coreSpend.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}, while lifestyle spend was ${lifestyleSpend.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} (${lifestyleShare.toFixed(1)}% of consumer spend).`,
    });
  }

  if (moneyMoves > 0) {
    insights.push({
      title: 'Money moves',
      body: `${moneyMoves.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} left the bank for investments, debt payments, or transfers rather than direct spending.`,
    });
  }

  if (creditCardSpendTotal > 0 || cardSettlementTotal > 0) {
    insights.push({
      title: 'Card-ledger split',
      body: `${creditCardSpendTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} came from card purchases and fees, while ${cardSettlementTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} shows up as bank settlements. These are tracked separately to avoid double counting.`,
    });
  }

  if (salaryLikeSources[0]) {
    insights.push({
      title: 'Salary-like credits',
      body: `${salaryLikeSources[0].merchant} looks like the strongest recurring income source, averaging about ${salaryLikeSources[0].average.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} across ${salaryLikeSources[0].months} months.`,
    });
  }

  if (passiveIncome > 0) {
    insights.push({
      title: 'Passive income',
      body: `Interest, dividends, and similar passive credits added up to ${passiveIncome.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  if (wealthReturnTotal > 0) {
    insights.push({
      title: 'Capital returned',
      body: `${wealthReturnTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} came back from fixed deposits or similar wealth redemptions, so it is kept out of earned income.`,
    });
  }

  if (topMerchant) {
    insights.push({
      title: 'Merchant concentration',
      body: `${topMerchant.label} was the biggest spend-side payee, which is useful to watch if you want to reduce repeat leakage.`,
    });
  }

  if (biggestSpend) {
    insights.push({
      title: 'Largest spend item',
      body: `${biggestSpend.merchant} was the biggest spend-side transaction at ${biggestSpend.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  } else if (biggestDebit) {
    insights.push({
      title: 'Largest single outflow',
      body: `${biggestDebit.merchant} was the biggest single cash debit at ${biggestDebit.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  if (biggestCredit) {
    insights.push({
      title: 'Largest counted income credit',
      body: `${biggestCredit.merchant} was the biggest counted income credit at ${biggestCredit.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  return insights.slice(0, 7);
};

export const buildAnalytics = (profile, scope) => {
  const transactions = (profile.transactions || []).filter((transaction) => {
    if (scope.year !== 'all' && Number(transaction.year) !== Number(scope.year)) return false;
    if (scope.statementId !== 'all' && transaction.statementId !== scope.statementId) return false;
    return true;
  });

  const cashTransactions = transactions.filter(isCashAccount);
  const cardTransactions = transactions.filter(isCardAccount);
  const credits = cashTransactions.filter((transaction) => transaction.direction === 'credit');
  const incomeCredits = credits.filter((transaction) => !isWealthReturn(transaction));
  const wealthReturnCredits = credits.filter(isWealthReturn);
  const debits = cashTransactions.filter((transaction) => transaction.direction === 'debit');
  const coreSpend = sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'essential'));
  const lifestyleSpend = sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'nonEssential'));
  const moneyMoves = sumAmount(debits.filter((transaction) => ['wealth', 'debt', 'transfer'].includes(transaction.bucketGroup)));
  const uncategorizedSpend = sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'uncategorized'));
  const cashInTotal = sumAmount(credits);
  const incomeTotal = sumAmount(incomeCredits);
  const outflowTotal = sumAmount(debits);
  const netCashFlow = cashInTotal - outflowTotal;
  const passiveIncome = sumAmount(incomeCredits.filter((transaction) => ['Interest & Dividends', 'Dividends & Corporate Credits'].includes(transaction.category)));
  const wealthReturnTotal = sumAmount(wealthReturnCredits);

  const directBankSpendTransactions = cashTransactions.filter(isDirectBankSpend);
  const cardSpendTransactions = cardTransactions.filter(isCardSpend);
  const spendRefundTransactions = transactions.filter(isSpendRefund);
  const trueSpendTransactions = [...directBankSpendTransactions, ...cardSpendTransactions, ...spendRefundTransactions]
    .sort((left, right) => (
      String(right.date || '').localeCompare(String(left.date || ''))
      || Number(right.amount || 0) - Number(left.amount || 0)
    ));

  const bankSpendTotal = sumAmount(directBankSpendTransactions);
  const creditCardSpendTotal = sumAmount(cardSpendTransactions);
  const trueSpendTotal = bankSpendTotal + creditCardSpendTotal;
  const spendRefundTotal = sumAmount(spendRefundTransactions);
  const trueSpendNet = trueSpendTotal - spendRefundTotal;
  const cardSettlementTotal = sumAmount(cashTransactions.filter(isCardSettlement));
  const cardPaymentsReceivedTotal = sumAmount(cardTransactions.filter((transaction) => transaction.entryKind === 'cardPaymentReceived'));
  const cardFeesAndInterestTotal = sumAmount(cardTransactions.filter((transaction) => ['cardFee', 'cardInterest'].includes(transaction.entryKind)));
  const cardRefundTotal = sumAmount(spendRefundTransactions.filter(isCardAccount));
  const cardRewardTotal = sumAmount(cardTransactions.filter((transaction) => transaction.entryKind === 'cardRewardCredit'));

  const monthly = new Map();
  cashTransactions.forEach((transaction) => {
    const current = monthly.get(transaction.monthKey) || {
      monthKey: transaction.monthKey,
      cashIn: 0,
      income: 0,
      outflow: 0,
      net: 0,
      essential: 0,
      nonEssential: 0,
      capital: 0,
      wealth: 0,
      wealthReturn: 0,
      debt: 0,
      transfer: 0,
    };

    if (transaction.direction === 'credit') {
      current.cashIn += Number(transaction.amount || 0);
      if (isWealthReturn(transaction)) {
        current.wealthReturn += Number(transaction.amount || 0);
      } else {
        current.income += Number(transaction.amount || 0);
      }
    } else {
      current.outflow += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'essential') current.essential += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'nonEssential') current.nonEssential += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'capital') current.capital += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'wealth') current.wealth += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'debt') current.debt += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'transfer') current.transfer += Number(transaction.amount || 0);
    }
    current.net = current.cashIn - current.outflow;
    monthly.set(transaction.monthKey, current);
  });

  const spendMonthly = new Map();
  trueSpendTransactions.forEach((transaction) => {
    const current = spendMonthly.get(transaction.monthKey) || {
      monthKey: transaction.monthKey,
      bankSpend: 0,
      cardSpend: 0,
      refunds: 0,
      grossSpend: 0,
      netSpend: 0,
    };

    if (spendRefundTransactions.includes(transaction)) {
      current.refunds += Number(transaction.amount || 0);
    } else if (isCardAccount(transaction)) {
      current.cardSpend += Number(transaction.amount || 0);
      current.grossSpend += Number(transaction.amount || 0);
    } else {
      current.bankSpend += Number(transaction.amount || 0);
      current.grossSpend += Number(transaction.amount || 0);
    }

    current.netSpend = current.grossSpend - current.refunds;
    spendMonthly.set(transaction.monthKey, current);
  });

  const yearly = new Map();
  cashTransactions.forEach((transaction) => {
    const year = Number(transaction.year);
    const current = yearly.get(year) || { year, cashIn: 0, income: 0, wealthReturn: 0, outflow: 0, net: 0 };
    if (transaction.direction === 'credit') {
      current.cashIn += Number(transaction.amount || 0);
      if (isWealthReturn(transaction)) {
        current.wealthReturn += Number(transaction.amount || 0);
      } else {
        current.income += Number(transaction.amount || 0);
      }
    } else {
      current.outflow += Number(transaction.amount || 0);
    }
    current.net = current.cashIn - current.outflow;
    yearly.set(year, current);
  });

  const bucketTotals = [
    { label: 'Essential', value: coreSpend, color: '#22c55e' },
    { label: 'Non-essential', value: lifestyleSpend, color: '#f97316' },
    { label: 'Capital / Big-ticket', value: sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'capital')), color: '#eab308' },
    { label: 'Investments', value: sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'wealth')), color: '#6366f1' },
    { label: 'Debt', value: sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'debt')), color: '#f43f5e' },
    { label: 'Transfers', value: sumAmount(debits.filter((transaction) => transaction.bucketGroup === 'transfer')), color: '#38bdf8' },
    { label: 'Uncategorized', value: uncategorizedSpend, color: '#94a3b8' },
  ].filter((item) => item.value > 0);

  const trueSpendBucketTotals = [
    { label: 'Essential', value: sumAmount(trueSpendTransactions.filter((transaction) => transaction.direction === 'debit' && transaction.bucketGroup === 'essential')), color: '#22c55e' },
    { label: 'Non-essential', value: sumAmount(trueSpendTransactions.filter((transaction) => transaction.direction === 'debit' && transaction.bucketGroup === 'nonEssential')), color: '#f97316' },
    { label: 'Capital / Big-ticket', value: sumAmount(trueSpendTransactions.filter((transaction) => transaction.direction === 'debit' && transaction.bucketGroup === 'capital')), color: '#eab308' },
    { label: 'Uncategorized', value: sumAmount(trueSpendTransactions.filter((transaction) => transaction.direction === 'debit' && transaction.bucketGroup === 'uncategorized')), color: '#94a3b8' },
  ].filter((item) => item.value > 0);

  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => ({
    label,
    amount: 0,
    index,
  }));
  debits.forEach((transaction) => {
    const index = getDay(new Date(`${transaction.date}T00:00:00`));
    dayOfWeek[index].amount += Number(transaction.amount || 0);
  });

  const trueSpendDayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => ({
    label,
    amount: 0,
    index,
  }));
  [...directBankSpendTransactions, ...cardSpendTransactions].forEach((transaction) => {
    const index = getDay(new Date(`${transaction.date}T00:00:00`));
    trueSpendDayOfWeek[index].amount += Number(transaction.amount || 0);
  });

  const salaryLikeSources = detectSalaryLikeSources(incomeCredits);
  const subscriptions = detectSubscriptions([...directBankSpendTransactions, ...cardSpendTransactions]);
  const categoryRanking = buildRankings(debits, 'category');
  const merchantRanking = buildRankings(debits, 'merchant');
  const incomeSources = buildRankings(incomeCredits, 'merchant');
  const trueSpendCategoryRanking = buildRankings(
    trueSpendTransactions,
    'category',
    1,
    (row) => (row.direction === 'credit' ? -Number(row.amount || 0) : Number(row.amount || 0)),
  ).filter((item) => item.amount > 0);
  const trueSpendMerchantRanking = buildRankings(
    trueSpendTransactions,
    'merchant',
    1,
    (row) => (row.direction === 'credit' ? -Number(row.amount || 0) : Number(row.amount || 0)),
  ).filter((item) => item.amount > 0);
  const cardCategoryRanking = buildRankings(
    [...cardSpendTransactions, ...spendRefundTransactions.filter(isCardAccount)],
    'category',
    1,
    (row) => (row.direction === 'credit' ? -Number(row.amount || 0) : Number(row.amount || 0)),
  ).filter((item) => item.amount > 0);
  const cardMerchantRanking = buildRankings(
    [...cardSpendTransactions, ...spendRefundTransactions.filter(isCardAccount)],
    'merchant',
    1,
    (row) => (row.direction === 'credit' ? -Number(row.amount || 0) : Number(row.amount || 0)),
  ).filter((item) => item.amount > 0);

  const biggestDebit = [...debits].sort((left, right) => right.amount - left.amount)[0] || null;
  const biggestCredit = [...incomeCredits].sort((left, right) => right.amount - left.amount)[0] || null;
  const biggestSpend = [...directBankSpendTransactions, ...cardSpendTransactions].sort((left, right) => right.amount - left.amount)[0] || null;
  const statementsInScope = (profile.statements || []).filter((statement) => (
    scope.statementId === 'all' || statement.id === scope.statementId
  ));
  const cashStatements = statementsInScope.filter((statement) => statement.accountType !== 'credit');
  const cardStatements = statementsInScope.filter((statement) => statement.accountType === 'credit');

  const monthSeries = [...monthly.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const spendMonthSeries = [...spendMonthly.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const yearSeries = [...yearly.values()].sort((left, right) => left.year - right.year);
  const monthCount = new Set(cashTransactions.map((transaction) => transaction.monthKey)).size || 1;
  const spendMonthCount = new Set(trueSpendTransactions.map((transaction) => transaction.monthKey)).size || 1;
  const averageMonthlyOutflow = outflowTotal / monthCount;
  const averageMonthlyCashIn = cashInTotal / monthCount;
  const averageMonthlyIncome = incomeTotal / monthCount;
  const averageMonthlyWealthReturn = wealthReturnTotal / monthCount;
  const averageMonthlyTrueSpend = trueSpendNet / spendMonthCount;
  const savingsRate = cashInTotal > 0 ? ((cashInTotal - outflowTotal) / cashInTotal) * 100 : 0;

  return {
    transactions,
    cashTransactions,
    cardTransactions,
    credits,
    incomeCredits,
    wealthReturnCredits,
    debits,
    trueSpendTransactions,
    directBankSpendTransactions,
    cardSpendTransactions,
    spendRefundTransactions,
    statementsInScope,
    cashStatements,
    cardStatements,
    cashInTotal,
    incomeTotal,
    outflowTotal,
    netCashFlow,
    coreSpend,
    lifestyleSpend,
    moneyMoves,
    uncategorizedSpend,
    passiveIncome,
    wealthReturnTotal,
    averageMonthlyCashIn,
    averageMonthlyOutflow,
    averageMonthlyIncome,
    averageMonthlyWealthReturn,
    averageMonthlyTrueSpend,
    savingsRate,
    monthSeries,
    spendMonthSeries,
    yearSeries,
    bucketTotals,
    trueSpendBucketTotals,
    categoryRanking,
    trueSpendCategoryRanking,
    cardCategoryRanking,
    merchantRanking,
    trueSpendMerchantRanking,
    cardMerchantRanking,
    incomeSources,
    salaryLikeSources,
    subscriptions,
    biggestDebit,
    biggestCredit,
    biggestSpend,
    dayOfWeek,
    trueSpendDayOfWeek,
    trueSpendTotal,
    spendRefundTotal,
    trueSpendNet,
    bankSpendTotal,
    creditCardSpendTotal,
    cardSettlementTotal,
    cardPaymentsReceivedTotal,
    cardFeesAndInterestTotal,
    cardRefundTotal,
    cardRewardTotal,
    cardAccountSummaries: buildCardAccountSummaries(cardTransactions, statementsInScope),
    insights: buildInsights({
      monthSeries,
      cashCategoryRanking: categoryRanking,
      trueSpendCategoryRanking,
      cashMerchantRanking: merchantRanking,
      trueSpendMerchantRanking,
      biggestDebit,
      biggestCredit,
      biggestSpend,
      coreSpend,
      lifestyleSpend,
      moneyMoves,
      passiveIncome,
      salaryLikeSources,
      wealthReturnTotal,
      outflowTotal,
      creditCardSpendTotal,
      cardSettlementTotal,
    }),
  };
};
