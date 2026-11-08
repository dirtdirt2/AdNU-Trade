const {
  ACTIVE_TRANSACTION_STATUSES,
  CANCELLABLE_TRANSACTION_STATUSES,
  isValidMeetupDate,
  isValidMeetupTime,
  validateTransactionTransition,
  partitionOtherActiveTransactions,
} = require('../utils/transactionRules');

describe('Transaction workflow rules', () => {
  describe('one-at-a-time purchase statuses', () => {
    it('treats placed, pending, confirmed, and ready transactions as active', () => {
      expect(ACTIVE_TRANSACTION_STATUSES).toEqual([
        'placed', 'pending', 'confirmed', 'ready',
      ]);
    });

    it('separates older pending requests from already accepted transactions', () => {
      const result = partitionOtherActiveTransactions([
        { id: 'a', status: 'placed' },
        { id: 'b', status: 'pending' },
        { id: 'c', status: 'confirmed' },
        { id: 'd', status: 'ready' },
      ]);

      expect(result.pendingRequests.map(({ id }) => id)).toEqual(['a', 'b']);
      expect(result.acceptedTransactions.map(({ id }) => id)).toEqual(['c', 'd']);
    });
  });

  describe('meetup date and time validation', () => {
    it('accepts real calendar dates, including leap days', () => {
      expect(isValidMeetupDate('2024-02-29')).toBe(true);
      expect(isValidMeetupDate('2026-11-08')).toBe(true);
    });

    it('rejects impossible dates and malformed date strings', () => {
      expect(isValidMeetupDate('2026-02-29')).toBe(false);
      expect(isValidMeetupDate('2026-02-31')).toBe(false);
      expect(isValidMeetupDate('2026-2-08')).toBe(false);
      expect(isValidMeetupDate('not-a-date')).toBe(false);
    });

    it('accepts valid 24-hour times and rejects invalid times', () => {
      expect(isValidMeetupTime('00:00')).toBe(true);
      expect(isValidMeetupTime('23:59')).toBe(true);
      expect(isValidMeetupTime('24:00')).toBe(false);
      expect(isValidMeetupTime('12:60')).toBe(false);
      expect(isValidMeetupTime('9:30')).toBe(false);
    });
  });

  describe('transaction status transitions', () => {
    const transition = (overrides) => validateTransactionTransition({
      currentStatus: 'pending',
      meetupStatus: 'pending_agreement',
      actorIsBuyer: false,
      actorIsSeller: false,
      nextStatus: 'ready',
      ...overrides,
    });

    it('allows only the seller to mark an agreed transaction ready', () => {
      expect(transition({
        currentStatus: 'confirmed',
        meetupStatus: 'agreed',
        actorIsSeller: true,
      })).toBeNull();

      expect(transition({
        currentStatus: 'confirmed',
        meetupStatus: 'agreed',
        actorIsBuyer: true,
      })).toMatchObject({ statusCode: 409 });
    });

    it('allows only the buyer to complete a ready transaction', () => {
      expect(transition({
        currentStatus: 'ready',
        nextStatus: 'completed',
        actorIsBuyer: true,
      })).toBeNull();

      expect(transition({
        currentStatus: 'ready',
        nextStatus: 'completed',
        actorIsSeller: true,
      })).toMatchObject({ statusCode: 409 });
    });

    it('allows either transaction participant to cancel a ready transaction', () => {
      expect(CANCELLABLE_TRANSACTION_STATUSES).toContain('ready');
      expect(transition({
        currentStatus: 'ready',
        nextStatus: 'cancelled',
        actorIsBuyer: true,
      })).toBeNull();
      expect(transition({
        currentStatus: 'ready',
        nextStatus: 'cancelled',
        actorIsSeller: true,
      })).toBeNull();
    });

    it('does not allow completed transactions to be cancelled', () => {
      expect(transition({
        currentStatus: 'completed',
        nextStatus: 'cancelled',
        actorIsBuyer: true,
      })).toMatchObject({ statusCode: 409 });
    });

    it('rejects unsupported status values', () => {
      expect(transition({
        nextStatus: 'sold',
        actorIsSeller: true,
      })).toMatchObject({ statusCode: 400 });
    });
  });
});
