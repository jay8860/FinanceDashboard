import { getDay } from 'date-fns';
import { monthLabelFromKey } from './format.js';

const addAmount = (map, key, amount, seed = {}) => {
  const current = map.get(key) || { ...seed };
  current.amount = Number(current.amount || 0) + Number(amount || 0);
  map.set(key, current);
};

const sumAmount = (rows) => rows.reduce((total, row) => total + Number(row.amount || 0), 0);

const stdDev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const buildRankings = (rows, key, minCount = 1) => {
  const groups = new Map();
  rows.forEach((row) => {
    const label = row[key] || 'Other';
    const current = groups.get(label) || { label, amount: 0, count: 0, lastDate: row.date, category: row.category };
    current.amount += Number(row.amount || 0);
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

const detectSubscriptions = (debits) => {
  const groups = new Map();

  debits
    .filter((debit) => debit.category === 'Subscriptions')
    .forEach((debit) => {
      const current = groups.get(debit.merchant) || {
        merchant: debit.merchant,
        count: 0,
        total: 0,
        months: new Set(),
      };
      current.count += 1;
      current.total += Number(debit.amount || 0);
      current.months.add(debit.monthKey);
      groups.set(debit.merchant, current);
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

const buildInsights = ({
  monthSeries,
  categoryRanking,
  merchantRanking,
  biggestDebit,
  biggestCredit,
  coreSpend,
  lifestyleSpend,
  moneyMoves,
  passiveIncome,
  salaryLikeSources,
  wealthReturnTotal,
  outflowTotal,
}) => {
  const insights = [];
  const activeMonths = monthSeries.filter((month) => month.outflow > 0);

  if (categoryRanking[0]) {
    insights.push({
      title: 'Top spend lane',
      body: `${categoryRanking[0].label} led your outflows at ${categoryRanking[0].amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  if (activeMonths.length >= 2) {
    const byOutflow = [...activeMonths].sort((left, right) => right.outflow - left.outflow);
    insights.push({
      title: 'Peak vs quiet month',
      body: `${monthLabelFromKey(byOutflow[0].monthKey)} was the heaviest outflow month, while ${monthLabelFromKey(byOutflow.at(-1).monthKey)} was the lightest.`,
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
      body: `${moneyMoves.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} went into investments, debt payments, wallet top-ups, or transfers rather than day-to-day consumption.`,
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

  if (merchantRanking[0]) {
    insights.push({
      title: 'Merchant concentration',
      body: `${merchantRanking[0].label} was the biggest payee across debits, which is useful to watch if you want to reduce repeat leakage.`,
    });
  }

  if (biggestDebit) {
    insights.push({
      title: 'Largest single outflow',
      body: `${biggestDebit.merchant} was the biggest single debit at ${biggestDebit.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  if (biggestCredit) {
    insights.push({
      title: 'Largest counted income credit',
      body: `${biggestCredit.merchant} was the biggest counted income credit at ${biggestCredit.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}.`,
    });
  }

  return insights.slice(0, 6);
};

export const buildAnalytics = (profile, scope) => {
  const transactions = (profile.transactions || []).filter((transaction) => {
    if (scope.year !== 'all' && Number(transaction.year) !== Number(scope.year)) return false;
    if (scope.statementId !== 'all' && transaction.statementId !== scope.statementId) return false;
    return true;
  });

  const credits = transactions.filter((transaction) => transaction.direction === 'credit');
  const incomeCredits = credits.filter((transaction) => transaction.bucketGroup !== 'wealthReturn');
  const wealthReturnCredits = credits.filter((transaction) => transaction.bucketGroup === 'wealthReturn');
  const debits = transactions.filter((transaction) => transaction.direction === 'debit');
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

  const monthly = new Map();
  transactions.forEach((transaction) => {
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
      if (transaction.bucketGroup === 'wealthReturn') {
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

  const yearly = new Map();
  transactions.forEach((transaction) => {
    const year = Number(transaction.year);
    const current = yearly.get(year) || { year, cashIn: 0, income: 0, wealthReturn: 0, outflow: 0, net: 0 };
    if (transaction.direction === 'credit') {
      current.cashIn += Number(transaction.amount || 0);
      if (transaction.bucketGroup === 'wealthReturn') {
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

  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => ({
    label,
    amount: 0,
    index,
  }));
  debits.forEach((transaction) => {
    const index = getDay(new Date(`${transaction.date}T00:00:00`));
    dayOfWeek[index].amount += Number(transaction.amount || 0);
  });

  const salaryLikeSources = detectSalaryLikeSources(incomeCredits);
  const subscriptions = detectSubscriptions(debits);
  const categoryRanking = buildRankings(debits, 'category');
  const merchantRanking = buildRankings(debits, 'merchant');
  const incomeSources = buildRankings(incomeCredits, 'merchant');
  const biggestDebit = [...debits].sort((left, right) => right.amount - left.amount)[0] || null;
  const biggestCredit = [...incomeCredits].sort((left, right) => right.amount - left.amount)[0] || null;
  const statementsInScope = (profile.statements || []).filter((statement) => (
    scope.statementId === 'all' || statement.id === scope.statementId
  ));

  const monthSeries = [...monthly.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const yearSeries = [...yearly.values()].sort((left, right) => left.year - right.year);
  const monthCount = new Set(transactions.map((transaction) => transaction.monthKey)).size || 1;
  const averageMonthlyOutflow = outflowTotal / monthCount;
  const averageMonthlyCashIn = cashInTotal / monthCount;
  const averageMonthlyIncome = incomeTotal / monthCount;
  const averageMonthlyWealthReturn = wealthReturnTotal / monthCount;
  const savingsRate = cashInTotal > 0 ? ((cashInTotal - outflowTotal) / cashInTotal) * 100 : 0;

  return {
    transactions,
    credits,
    incomeCredits,
    wealthReturnCredits,
    debits,
    statementsInScope,
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
    savingsRate,
    monthSeries,
    yearSeries,
    bucketTotals,
    categoryRanking,
    merchantRanking,
    incomeSources,
    salaryLikeSources,
    subscriptions,
    biggestDebit,
    biggestCredit,
    dayOfWeek,
    insights: buildInsights({
      monthSeries,
      categoryRanking,
      merchantRanking,
      biggestDebit,
      biggestCredit,
      coreSpend,
      lifestyleSpend,
      moneyMoves,
      passiveIncome,
      salaryLikeSources,
      wealthReturnTotal,
      outflowTotal,
    }),
  };
};
