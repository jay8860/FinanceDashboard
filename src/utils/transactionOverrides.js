import { differenceInCalendarDays } from 'date-fns';

const INVESTMENT_TEXT = /GROWW|INVEST|SIP|MUTUAL|STOCK|FD|CLEARING/i;

const normalizeTags = (tags = []) => [...new Set((tags || []).filter(Boolean))];

const mergeNote = (currentNote, nextNote) => {
  const current = String(currentNote || '').trim();
  const next = String(nextNote || '').trim();
  if (!next) return current;
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current} | ${next}`;
};

const ruleLabel = (rule) => rule.label || `${rule.matchField} ${rule.operator} "${rule.matchValue}"`;

const matchesRule = (transaction, rule) => {
  if (!rule?.enabled) return false;
  if (rule.direction !== 'all' && transaction.direction !== rule.direction) return false;

  const haystack = String(transaction[rule.matchField] || '').toLowerCase();
  const needle = String(rule.matchValue || '').toLowerCase();

  if (!needle) return false;
  if (rule.operator === 'equals') return haystack === needle;
  return haystack.includes(needle);
};

export const applyRulesToTransactions = (transactions = [], rules = []) => (
  transactions.map((transaction) => {
    const startingPoint = {
      ...transaction,
      tags: normalizeTags(transaction.tags || []),
      note: transaction.note || '',
      excludedFromAnalysis: Boolean(transaction.excludedFromAnalysis),
      appliedRuleIds: [],
      appliedRuleLabels: [],
      hasRule: false,
      rawMerchant: transaction.rawMerchant || transaction.merchant,
      rawCategory: transaction.rawCategory || transaction.category,
      rawBucketGroup: transaction.rawBucketGroup || transaction.bucketGroup,
    };

    return (rules || []).reduce((current, rule) => {
      if (!matchesRule(transaction, rule)) return current;

      return {
        ...current,
        merchant: rule.patch.merchant || current.merchant,
        category: rule.patch.category || current.category,
        bucketGroup: rule.patch.bucketGroup || current.bucketGroup,
        tags: normalizeTags([...(current.tags || []), ...(rule.patch.tags || [])]),
        note: mergeNote(current.note, rule.patch.note),
        excludedFromAnalysis: current.excludedFromAnalysis || Boolean(rule.patch.excludeFromAnalysis),
        appliedRuleIds: [...current.appliedRuleIds, rule.id],
        appliedRuleLabels: [...current.appliedRuleLabels, ruleLabel(rule)],
        hasRule: true,
      };
    }, startingPoint);
  })
);

export const applyOverridesToTransactions = (transactions = [], overrides = {}) => (
  transactions.map((transaction) => {
    const override = overrides[transaction.uniqueKey] || null;
    const merchant = override?.merchant || transaction.merchant;
    const category = override?.category || transaction.category;
    const bucketGroup = override?.bucketGroup || transaction.bucketGroup;
    const note = override
      ? (override.note ?? transaction.note ?? '')
      : (transaction.note || '');
    const tags = override
      ? (override.tags !== undefined ? normalizeTags(override.tags) : normalizeTags(transaction.tags || []))
      : normalizeTags(transaction.tags || []);
    const excludedFromAnalysis = override
      ? (override.excludeFromAnalysis ?? Boolean(transaction.excludedFromAnalysis))
      : Boolean(transaction.excludedFromAnalysis);

    return {
      ...transaction,
      merchant,
      category,
      bucketGroup,
      note,
      tags,
      excludedFromAnalysis,
      hasOverride: Boolean(override),
      hasRule: Boolean(transaction.hasRule),
      appliedRuleIds: transaction.appliedRuleIds || [],
      appliedRuleLabels: transaction.appliedRuleLabels || [],
      rawMerchant: transaction.rawMerchant || transaction.merchant,
      rawCategory: transaction.rawCategory || transaction.category,
      rawBucketGroup: transaction.rawBucketGroup || transaction.bucketGroup,
    };
  })
);

const isInvestmentLike = (transaction) => (
  (transaction.accountType || 'cash') === 'cash'
  && transaction.entryKind !== 'cardSettlement'
  && transaction.direction === 'debit'
  && (
    transaction.bucketGroup === 'wealth'
    || INVESTMENT_TEXT.test(`${transaction.category} ${transaction.merchant} ${transaction.narration}`)
  )
);

const isPassThroughCandidate = (credit, debit) => {
  const daysApart = differenceInCalendarDays(new Date(`${debit.date}T00:00:00`), new Date(`${credit.date}T00:00:00`));
  if (daysApart < 0 || daysApart > 1) return false;

  const amountGap = Math.abs(Number(credit.amount || 0) - Number(debit.amount || 0));
  const largestAmount = Math.max(Number(credit.amount || 0), Number(debit.amount || 0), 1);
  const amountGapRatio = amountGap / largestAmount;

  return largestAmount >= 25000 && (amountGap <= 2500 || amountGapRatio <= 0.025);
};

export const buildPassThroughSuggestions = (transactions = [], dismissedSuggestionKeys = []) => {
  const ignored = new Set(dismissedSuggestionKeys || []);
  const credits = transactions
    .filter((transaction) => (
      (transaction.accountType || 'cash') === 'cash'
      && transaction.direction === 'credit'
      && !transaction.excludedFromAnalysis
    ))
    .sort((left, right) => (
      left.date.localeCompare(right.date)
      || Number(left.amount || 0) - Number(right.amount || 0)
    ));
  const debits = transactions
    .filter((transaction) => isInvestmentLike(transaction) && !transaction.excludedFromAnalysis)
    .sort((left, right) => (
      left.date.localeCompare(right.date)
      || Number(left.amount || 0) - Number(right.amount || 0)
    ));
  const usedDebits = new Set();
  const suggestions = [];

  credits.forEach((credit) => {
    const debit = debits.find((candidate) => {
      if (usedDebits.has(candidate.uniqueKey)) return false;
      if (candidate.accountLast4 !== credit.accountLast4) return false;
      return isPassThroughCandidate(credit, candidate);
    });

    if (!debit) return;

    const suggestionKey = `${credit.uniqueKey}__${debit.uniqueKey}`;
    if (ignored.has(suggestionKey)) return;

    usedDebits.add(debit.uniqueKey);

    suggestions.push({
      key: suggestionKey,
      credit,
      debit,
      amountGap: Math.abs(Number(credit.amount || 0) - Number(debit.amount || 0)),
      daysApart: differenceInCalendarDays(new Date(`${debit.date}T00:00:00`), new Date(`${credit.date}T00:00:00`)),
    });
  });

  return suggestions.sort((left, right) => (
    right.credit.date.localeCompare(left.credit.date)
    || Number(right.credit.amount || 0) - Number(left.credit.amount || 0)
  ));
};
