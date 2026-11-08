/**
 * Notification helpers shared by route handlers. Notifications are private to
 * their recipient and are used for the in-app activity feed only.
 */
async function createNotification(client, notification) {
  if (!notification?.userId || !notification?.title || !notification?.body) return null;
  return client.notification.create({
    data: {
      userId: notification.userId,
      type: notification.type || 'general',
      title: notification.title,
      body: notification.body,
      link: notification.link || null,
      entityId: notification.entityId || null,
    },
  });
}

async function notifyAdmins(client, notification) {
  const admins = await client.user.findMany({
    where: { role: 'admin', isVerified: true, isApproved: true },
    select: { id: true },
  });
  if (!admins.length) return { count: 0 };
  return client.notification.createMany({
    data: admins.map(({ id }) => ({
      userId: id,
      type: notification.type || 'admin_action',
      title: notification.title,
      body: notification.body,
      link: notification.link || null,
      entityId: notification.entityId || null,
    })),
  });
}

module.exports = { createNotification, notifyAdmins };
