const STORAGE_KEY = 'statement-atlas-profile-v1';

export const createEmptyProfile = () => ({
  version: 5,
  statements: [],
  transactions: [],
  rules: [],
  overrides: {},
  dismissedSuggestionKeys: [],
  lastUpdatedAt: null,
});

export const buildTransactionKey = (transaction) => ([
  transaction.sourceType || 'bank',
  transaction.accountType || 'cash',
  transaction.accountLast4 || '0000',
  transaction.date,
  transaction.valueDate,
  transaction.direction,
  Number(transaction.amount || 0).toFixed(2),
  transaction.balance === null || transaction.balance === undefined
    ? 'na'
    : Number(transaction.balance || 0).toFixed(2),
  transaction.refNo || '',
  transaction.narration || '',
].join('|'));

const normalizeTextField = (value) => {
  const next = String(value ?? '').trim();
  return next || undefined;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((tag) => normalizeTextField(tag)).filter(Boolean))];
  }
  return [...new Set(String(value ?? '')
    .split(',')
    .map((tag) => normalizeTextField(tag))
    .filter(Boolean))];
};

const normalizeOverride = (override) => {
  if (!override || typeof override !== 'object') return null;

  const hasTagsProp = Object.prototype.hasOwnProperty.call(override, 'tags');
  const hasNoteProp = Object.prototype.hasOwnProperty.call(override, 'note');
  const hasExcludeProp = Object.prototype.hasOwnProperty.call(override, 'excludeFromAnalysis');

  const next = {
    merchant: normalizeTextField(override.merchant),
    category: normalizeTextField(override.category),
    bucketGroup: normalizeTextField(override.bucketGroup),
    note: hasNoteProp ? String(override.note ?? '').trim() : undefined,
    tags: hasTagsProp ? normalizeTags(override.tags) : undefined,
    excludeFromAnalysis: hasExcludeProp ? Boolean(override.excludeFromAnalysis) : undefined,
  };

  const hasValues = hasExcludeProp
    || Boolean(next.merchant)
    || Boolean(next.category)
    || Boolean(next.bucketGroup)
    || hasNoteProp
    || hasTagsProp;

  return hasValues ? next : null;
};

const normalizeRule = (rule) => {
  if (!rule || typeof rule !== 'object') return null;

  const matchField = ['merchant', 'narration', 'refNo'].includes(rule.matchField) ? rule.matchField : 'merchant';
  const operator = ['equals', 'contains'].includes(rule.operator) ? rule.operator : 'contains';
  const direction = ['all', 'credit', 'debit'].includes(rule.direction) ? rule.direction : 'all';
  const matchValue = normalizeTextField(rule.matchValue);
  const patch = normalizeOverride(rule.patch);

  if (!matchValue || !patch) return null;

  return {
    id: normalizeTextField(rule.id) || crypto.randomUUID(),
    label: normalizeTextField(rule.label),
    enabled: rule.enabled !== false,
    matchField,
    operator,
    direction,
    matchValue,
    patch,
    createdAt: normalizeTextField(rule.createdAt) || new Date().toISOString(),
    updatedAt: normalizeTextField(rule.updatedAt) || new Date().toISOString(),
  };
};

const normalizeProfile = (profile) => {
  const next = profile || createEmptyProfile();
  const statements = [...(next.statements || [])]
    .map((statement) => ({
      sourceType: 'bank',
      accountType: 'cash',
      ...statement,
      sourceType: statement?.sourceType || (statement?.accountType === 'credit' ? 'creditCard' : 'bank'),
      accountType: statement?.accountType || (statement?.sourceType === 'creditCard' ? 'credit' : 'cash'),
    }))
    .sort((left, right) => (
      String(right.toDate || '').localeCompare(String(left.toDate || ''))
      || String(right.importedAt || '').localeCompare(String(left.importedAt || ''))
    ));
  const transactionKeyMap = new Map();
  const normalizedTransactions = [];
  const transactionIds = new Set();

  [...(next.transactions || [])].forEach((transaction) => {
    const normalizedTransaction = {
      sourceType: 'bank',
      accountType: 'cash',
      entryKind: transaction?.direction === 'credit' ? 'income' : 'directExpense',
      ...transaction,
      sourceType: transaction?.sourceType || (transaction?.accountType === 'credit' ? 'creditCard' : 'bank'),
      accountType: transaction?.accountType || (transaction?.sourceType === 'creditCard' ? 'credit' : 'cash'),
      entryKind: transaction?.entryKind || (transaction?.direction === 'credit' ? 'income' : 'directExpense'),
      balance: transaction?.balance === undefined ? null : transaction.balance,
    };
    const nextKey = buildTransactionKey(normalizedTransaction);
    if (transaction.uniqueKey) transactionKeyMap.set(transaction.uniqueKey, nextKey);
    transactionKeyMap.set(nextKey, nextKey);

    if (transactionIds.has(nextKey)) return;
    transactionIds.add(nextKey);
    normalizedTransactions.push({
      ...normalizedTransaction,
      uniqueKey: nextKey,
    });
  });

  const transactions = normalizedTransactions.sort((left, right) => (
    String(right.date).localeCompare(String(left.date))
    || String(right.valueDate || '').localeCompare(String(left.valueDate || ''))
    || Number(right.amount || 0) - Number(left.amount || 0)
  ));
  const rules = [...(next.rules || [])]
    .map((rule) => normalizeRule(rule))
    .filter(Boolean)
    .sort((left, right) => (
      Number(right.enabled) - Number(left.enabled)
      || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
      || String(left.label || '').localeCompare(String(right.label || ''))
    ));
  const transactionKeys = new Set(transactions.map((transaction) => transaction.uniqueKey));
  const rawOverrides = next.overrides || {};
  const overrides = Object.fromEntries(
    Object.entries(rawOverrides)
      .map(([uniqueKey, override]) => {
        const resolvedKey = transactionKeyMap.get(uniqueKey) || uniqueKey;
        if (!transactionKeys.has(resolvedKey)) return null;
        const normalized = normalizeOverride(override);
        return normalized ? [resolvedKey, normalized] : null;
      })
      .filter(Boolean),
  );
  const dismissedSuggestionKeys = [...new Set((next.dismissedSuggestionKeys || [])
    .map((suggestionKey) => {
      const [leftKey, rightKey] = String(suggestionKey || '').split('__');
      const resolvedLeft = transactionKeyMap.get(leftKey) || leftKey;
      const resolvedRight = transactionKeyMap.get(rightKey) || rightKey;
      if (!resolvedLeft || !resolvedRight) return null;
      return `${resolvedLeft}__${resolvedRight}`;
    })
    .filter(Boolean))];

  return {
    version: 5,
    statements,
    transactions,
    rules,
    overrides,
    dismissedSuggestionKeys,
    lastUpdatedAt: next.lastUpdatedAt || null,
  };
};

export const loadStoredProfile = () => {
  if (typeof window === 'undefined') return createEmptyProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return createEmptyProfile();
  }
};

export const saveStoredProfile = (profile) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProfile(profile)));
};

export const mergeProfiles = (existingProfile, incomingProfile, mode = 'merge') => {
  const incoming = normalizeProfile(incomingProfile);
  if (mode === 'replace') {
    return normalizeProfile({
      ...incoming,
      rules: [],
      overrides: {},
      dismissedSuggestionKeys: [],
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  const existing = normalizeProfile(existingProfile);
  const statementIds = new Set(existing.statements.map((statement) => statement.checksum));
  const transactionIds = new Set(existing.transactions.map((transaction) => transaction.uniqueKey));

  const statements = [...existing.statements];
  const transactions = [...existing.transactions];

  incoming.statements.forEach((statement) => {
    if (statementIds.has(statement.checksum)) return;
    statementIds.add(statement.checksum);
    statements.push(statement);
  });

  incoming.transactions.forEach((transaction) => {
    if (transactionIds.has(transaction.uniqueKey)) return;
    transactionIds.add(transaction.uniqueKey);
    transactions.push(transaction);
  });

  return normalizeProfile({
    version: 5,
    statements,
    transactions,
    rules: existing.rules,
    overrides: existing.overrides,
    dismissedSuggestionKeys: existing.dismissedSuggestionKeys,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const removeStatementFromProfile = (profile, statementId) => normalizeProfile({
  version: 5,
  statements: (profile.statements || []).filter((statement) => statement.id !== statementId),
  transactions: (profile.transactions || []).filter((transaction) => transaction.statementId !== statementId),
  rules: profile.rules,
  overrides: profile.overrides,
  dismissedSuggestionKeys: profile.dismissedSuggestionKeys,
  lastUpdatedAt: new Date().toISOString(),
});

export const upsertTransactionOverride = (profile, uniqueKey, patch) => {
  const current = profile?.overrides?.[uniqueKey] || null;
  const nextOverride = normalizeOverride({ ...current, ...patch });
  const overrides = { ...(profile?.overrides || {}) };

  if (nextOverride) {
    overrides[uniqueKey] = nextOverride;
  } else {
    delete overrides[uniqueKey];
  }

  return normalizeProfile({
    ...(profile || createEmptyProfile()),
    overrides,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const upsertMultipleTransactionOverrides = (profile, patchMap = {}) => {
  const overrides = { ...(profile?.overrides || {}) };

  Object.entries(patchMap).forEach(([uniqueKey, patch]) => {
    const current = overrides[uniqueKey] || null;
    const nextOverride = normalizeOverride({ ...current, ...patch });

    if (nextOverride) {
      overrides[uniqueKey] = nextOverride;
    } else {
      delete overrides[uniqueKey];
    }
  });

  return normalizeProfile({
    ...(profile || createEmptyProfile()),
    overrides,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const clearTransactionOverride = (profile, uniqueKey) => {
  const overrides = { ...(profile?.overrides || {}) };
  delete overrides[uniqueKey];

  return normalizeProfile({
    ...(profile || createEmptyProfile()),
    overrides,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const clearMultipleTransactionOverrides = (profile, uniqueKeys = []) => {
  const overrides = { ...(profile?.overrides || {}) };
  uniqueKeys.forEach((uniqueKey) => {
    delete overrides[uniqueKey];
  });

  return normalizeProfile({
    ...(profile || createEmptyProfile()),
    overrides,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const dismissSuggestion = (profile, suggestionKey) => normalizeProfile({
  ...(profile || createEmptyProfile()),
  dismissedSuggestionKeys: [...new Set([...(profile?.dismissedSuggestionKeys || []), suggestionKey])],
  lastUpdatedAt: new Date().toISOString(),
});

export const upsertBulkRule = (profile, rule) => {
  const normalized = normalizeRule({
    ...rule,
    updatedAt: new Date().toISOString(),
  });
  if (!normalized) return normalizeProfile(profile);

  const rules = [...(profile?.rules || [])];
  const index = rules.findIndex((existingRule) => existingRule.id === normalized.id);

  if (index >= 0) {
    rules[index] = {
      ...rules[index],
      ...normalized,
      createdAt: rules[index].createdAt || normalized.createdAt,
    };
  } else {
    rules.push(normalized);
  }

  return normalizeProfile({
    ...(profile || createEmptyProfile()),
    rules,
    lastUpdatedAt: new Date().toISOString(),
  });
};

export const removeBulkRule = (profile, ruleId) => normalizeProfile({
  ...(profile || createEmptyProfile()),
  rules: (profile?.rules || []).filter((rule) => rule.id !== ruleId),
  lastUpdatedAt: new Date().toISOString(),
});

export const toggleBulkRule = (profile, ruleId) => normalizeProfile({
  ...(profile || createEmptyProfile()),
  rules: (profile?.rules || []).map((rule) => (
    rule.id === ruleId
      ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
      : rule
  )),
  lastUpdatedAt: new Date().toISOString(),
});
