const ACTIVE_TRANSACTION_STATUSES = Object.freeze([
  'placed',
  'pending',
  'confirmed',
  'ready',
]);

const PENDING_PURCHASE_STATUSES = Object.freeze(['placed', 'pending']);
const ACCEPTED_TRANSACTION_STATUSES = Object.freeze(['confirmed', 'ready']);
const CANCELLABLE_TRANSACTION_STATUSES = Object.freeze([
  'placed',
  'pending',
  'confirmed',
  'ready',
]);

function isValidMeetupDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidMeetupTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function validateTransactionTransition({
  currentStatus,
  meetupStatus,
  actorIsBuyer,
  actorIsSeller,
  nextStatus,
}) {
  if (!['ready', 'completed', 'cancelled'].includes(nextStatus)) {
    return {
      statusCode: 400,
      error: 'Invalid transaction status transition.',
    };
  }

  if (nextStatus === 'ready' &&
      (!actorIsSeller || currentStatus !== 'confirmed' || meetupStatus !== 'agreed')) {
    return {
      statusCode: 409,
      error: 'Only the seller can mark an agreed transaction ready for meetup.',
    };
  }

  if (nextStatus === 'completed' && (!actorIsBuyer || currentStatus !== 'ready')) {
    return {
      statusCode: 409,
      error: 'Only the buyer can complete a transaction after the seller marks the item ready.',
    };
  }

  if (nextStatus === 'cancelled' &&
      ((!actorIsBuyer && !actorIsSeller) || !CANCELLABLE_TRANSACTION_STATUSES.includes(currentStatus))) {
    return {
      statusCode: 409,
      error: 'This transaction can no longer be cancelled.',
    };
  }

  return null;
}

function partitionOtherActiveTransactions(transactions) {
  const pendingRequests = [];
  const acceptedTransactions = [];

  for (const transaction of transactions || []) {
    if (PENDING_PURCHASE_STATUSES.includes(transaction.status)) {
      pendingRequests.push(transaction);
    } else if (ACCEPTED_TRANSACTION_STATUSES.includes(transaction.status)) {
      acceptedTransactions.push(transaction);
    }
  }

  return { pendingRequests, acceptedTransactions };
}

module.exports = {
  ACTIVE_TRANSACTION_STATUSES,
  PENDING_PURCHASE_STATUSES,
  ACCEPTED_TRANSACTION_STATUSES,
  CANCELLABLE_TRANSACTION_STATUSES,
  isValidMeetupDate,
  isValidMeetupTime,
  validateTransactionTransition,
  partitionOtherActiveTransactions,
};
