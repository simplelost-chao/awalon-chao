const { userDb } = require('./db');
const { now } = require('./constants');

// 发送好友请求
function sendFriendRequest(fromPhone, toPhone) {
  if (fromPhone === toPhone) return { error: 'SELF' };

  // 检查双向是否已存在记录
  const existing = userDb.prepare(
    'SELECT status FROM friends WHERE (phone_a = ? AND phone_b = ?) OR (phone_a = ? AND phone_b = ?)'
  ).get(fromPhone, toPhone, toPhone, fromPhone);

  if (existing) {
    if (existing.status === 'accepted') return { error: 'ALREADY_FRIENDS' };
    return { error: 'ALREADY_PENDING' };
  }

  userDb.prepare(
    'INSERT INTO friends(phone_a, phone_b, status, created_at) VALUES(?,?,\'pending\',?)'
  ).run(fromPhone, toPhone, now());

  return { ok: true };
}

// 响应好友请求（接受或拒绝）
function respondFriendRequest(myPhone, fromPhone, accept) {
  const row = userDb.prepare(
    'SELECT id FROM friends WHERE phone_a = ? AND phone_b = ? AND status = \'pending\''
  ).get(fromPhone, myPhone);

  if (!row) return { error: 'NOT_FOUND' };

  if (accept) {
    userDb.prepare(
      'UPDATE friends SET status = \'accepted\', accepted_at = ? WHERE id = ?'
    ).run(now(), row.id);
  } else {
    userDb.prepare('DELETE FROM friends WHERE id = ?').run(row.id);
  }

  return { ok: true, accepted: !!accept };
}

// 删除好友关系（双向）
function deleteFriend(myPhone, theirPhone) {
  userDb.prepare(
    'DELETE FROM friends WHERE (phone_a = ? AND phone_b = ?) OR (phone_a = ? AND phone_b = ?)'
  ).run(myPhone, theirPhone, theirPhone, myPhone);
}

// 获取好友列表（已接受），附带昵称和头像
function getFriendsList(myPhone) {
  return userDb.prepare(`
    SELECT
      CASE WHEN f.phone_a = ? THEN f.phone_b ELSE f.phone_a END AS phone,
      u.nickname,
      u.avatar
    FROM friends f
    JOIN users u ON u.phone = CASE WHEN f.phone_a = ? THEN f.phone_b ELSE f.phone_a END
    WHERE (f.phone_a = ? OR f.phone_b = ?) AND f.status = 'accepted'
  `).all(myPhone, myPhone, myPhone, myPhone);
}

// 获取发给我的待处理请求，附带昵称和头像
function getPendingRequests(myPhone) {
  return userDb.prepare(`
    SELECT f.phone_a AS phone, u.nickname, u.avatar
    FROM friends f
    JOIN users u ON u.phone = f.phone_a
    WHERE f.phone_b = ? AND f.status = 'pending'
  `).all(myPhone);
}

// 获取我发出的待确认请求
function getSentRequests(myPhone) {
  return userDb.prepare(`
    SELECT f.phone_b AS phone, u.nickname, u.avatar
    FROM friends f
    JOIN users u ON u.phone = f.phone_b
    WHERE f.phone_a = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(myPhone);
}

// 获取所有已接受好友的手机号列表
function getFriendPhones(myPhone) {
  const rows = userDb.prepare(`
    SELECT CASE WHEN phone_a = ? THEN phone_b ELSE phone_a END AS phone
    FROM friends
    WHERE (phone_a = ? OR phone_b = ?) AND status = 'accepted'
  `).all(myPhone, myPhone, myPhone);
  return rows.map((r) => r.phone);
}

module.exports = {
  sendFriendRequest,
  respondFriendRequest,
  deleteFriend,
  getFriendsList,
  getPendingRequests,
  getSentRequests,
  getFriendPhones,
};
