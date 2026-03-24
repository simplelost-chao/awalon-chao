# Roundtable Display Backup (2026-03-13)

Source files:
- `/Users/chao/Documents/Projects/avalon-online/mobile/miniprogram/pages/index/index.wxml`
- `/Users/chao/Documents/Projects/avalon-online/mobile/miniprogram/pages/index/index.wxss`
- `/Users/chao/Documents/Projects/avalon-online/mobile/miniprogram/pages/index/index.js`

## WXML

```xml
<view class="table-wrap">
  <view class="table-ring"></view>
  <view
    class="seat-round {{item.selectedTeam ? 'seat-team' : ''}} {{item.selectedAssassinate ? 'seat-kill' : ''}} {{item.isMe ? 'seat-me' : ''}} {{item.isAssassinated ? 'seat-assassinated' : ''}}"
    wx:for="{{roundSeats}}"
    wx:key="seat"
    bindtap="onChooseSeat"
    data-index="{{item.index}}"
    style="{{item.leftStyle}}"
  >
    <text class="seat-crown" wx:if="{{item.isLeader}}">👑</text>
    <text class="seat-no">{{item.seat}}</text>
    <text class="seat-name">{{item.name}}</text>
    <view class="seat-role-pill {{item.roleClass}}" wx:if="{{item.roleLabel}}">
      <image class="seat-role-img" wx:if="{{item.roleImage}}" src="{{item.roleImage}}" mode="aspectFill" />
      <text class="seat-role">{{item.roleLabel}}</text>
    </view>
    <text class="seat-mark-killed" wx:if="{{item.isAssassinated}}">☠</text>
    <text class="seat-action {{item.actionDone ? 'seat-action-done' : 'seat-action-pending'}}" wx:if="{{!item.offline && item.action}}">{{item.action}}</text>
    <text class="seat-offline" wx:if="{{item.offline}}">离线</text>
  </view>
  <view class="center-result" wx:if="{{showCenterResult}}">
    <text class="center-result-title">{{centerResultText}}</text>
    <text class="center-result-sub">{{centerResultSub}}</text>
    <view class="end-medal-wrap" wx:if="{{endMedals && endMedals.length}}">
      <text class="end-medal-title">本局获得勋章</text>
      <view class="end-medal-row">
        <view class="end-medal-chip {{item.faction==='evil' ? 'end-medal-evil' : 'end-medal-good'}}" wx:for="{{endMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
          <image class="end-medal-image" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
          <text class="end-medal-icon" wx:else>🏅</text>
          <text class="end-medal-name">{{item.name}}</text>
        </view>
      </view>
    </view>
    <button class="btn primary center-leader-btn" wx:if="{{isHost && phase==='end'}}" bindtap="onRedealIdentities">
      重新开始
    </button>
  </view>
  <view class="mission-anim-overlay {{missionAnimClass}}" wx:if="{{showMissionAnim}}">
    <image class="mission-anim-image" src="{{missionAnimImage}}" mode="widthFix" />
    <text class="mission-anim-title">{{missionAnimText}}</text>
    <text class="mission-anim-sub">第 {{missionAnimRound}} 轮任务结算</text>
  </view>
  <view class="center-leader-panel" wx:if="{{isLeader && (phase==='team' || phase==='speaking') && !showCenterResult}}">
    <button class="btn primary center-leader-btn" bindtap="onLeaderTeamAction" disabled="{{leaderActionDisabled}}">
      {{leaderActionText}}
    </button>
  </view>
  <view class="center-leader-panel" wx:if="{{isAssassin && phase==='assassination' && !showCenterResult}}">
    <button class="btn primary center-leader-btn" bindtap="onConfirmAssassinate" disabled="{{!selectedAssassinate}}">
      执行刺杀
    </button>
  </view>
</view>
```

## WXSS

```css
.table-wrap {
  position: relative;
}

.center-result {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.center-result-title {
  display: block;
}

.center-result-sub {
  display: block;
}

.center-leader-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.seat-round {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 156rpx;
  height: 156rpx;
  padding: 8rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.42);
  border-radius: 50%;
  display: grid;
  align-content: center;
  justify-items: center;
  background: rgba(66, 44, 24, 0.52);
  box-shadow: none;
}

.seat-team {
  border-color: rgba(122, 212, 145, 0.9);
  background: rgba(52, 118, 74, 0.55);
  box-shadow: 0 0 0 2rpx rgba(122, 212, 145, 0.35) inset;
}

.seat-kill {
  border-color: rgba(239, 102, 102, 0.95);
  box-shadow: 0 0 0 2rpx rgba(239, 102, 102, 0.32) inset;
}

.seat-me {
  border-color: rgba(233, 191, 112, 0.95);
  box-shadow: 0 0 0 2rpx rgba(233, 191, 112, 0.38) inset;
}

.seat-no {
  font-size: 28rpx;
  color: #e6c17d;
}

.seat-crown {
  position: absolute;
  top: -20rpx;
  font-size: 22rpx;
}

.seat-name {
  font-size: 24rpx;
  color: #d0d8e8;
  max-width: 140rpx;
  white-space: normal;
  word-break: break-all;
  text-align: center;
  line-height: 1.2;
}

.seat-role {
  font-size: 20rpx;
  color: #fff;
}

.seat-role-pill {
  margin-top: 4rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 5rpx 14rpx;
  border-radius: 999rpx;
}

.seat-role-img {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
}

.seat-assassinated {
  border-color: rgba(240, 102, 102, 0.95);
  background: rgba(116, 36, 36, 0.62);
  box-shadow: 0 0 0 2rpx rgba(240, 102, 102, 0.34) inset;
}

.seat-mark-killed {
  margin-top: 2rpx;
  font-size: 21rpx;
  color: #ff9f9f;
}

.seat-offline {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #ff9696;
}

.seat-action {
  margin-top: 3rpx;
  font-size: 19rpx;
}

.seat-action-done {
  color: #7fe1ac;
}

.seat-action-pending {
  color: #d8c99b;
}
```

## JS

```js
buildSeatSlots(room, selectedTeam = [], selectedAssassinate = "") {
  const max = Number(room.maxPlayers || 0);
  const seats = Array.isArray(room.seats) ? room.seats : [];
  const players = Array.isArray(room.players) ? room.players : [];
  const game = room && room.game ? room.game : null;
  const phase = room && room.phase ? room.phase : "";
  const leaderId = game ? game.leaderId : "";
  const isLeaderNow = !!(this.data.clientId && leaderId && this.data.clientId === leaderId);
  const assTargetId = game && game.assassination ? game.assassination.targetId : "";
  const out = [];
  for (let i = 0; i < max; i += 1) {
    const pid = seats[i] || null;
    const p = pid ? players.find((it) => it.id === pid) : null;
    let action = "";
    let actionDone = false;
    if (pid && game) {
      if (phase === "team" || phase === "speaking") {
        const tags = [];
        if (pid === leaderId) tags.push("队长");
        if (phase === "speaking" && room.speaking && room.seats[room.speaking.index] === pid) tags.push("发言中");
        action = tags.join(" · ");
        actionDone = false;
      } else if (phase === "voting") {
        const voted = game.votes && game.votes[pid] !== undefined;
        action = voted ? "已投票" : "投票中";
        actionDone = !!voted;
      } else if (phase === "mission" && Array.isArray(game.team) && game.team.includes(pid)) {
        const done = game.missionVotes && game.missionVotes[pid] !== undefined;
        action = done ? "出征完毕" : "出征中";
        actionDone = !!done;
      }
    }
    out.push({
      index: i,
      seat: i + 1,
      name: p ? p.nickname : "空位",
      playerId: pid,
      offline: !!(p && p.offline),
      isMe: !!(pid && pid === this.data.clientId),
      isLeader: !!(pid && pid === leaderId),
      selectedTeam: !!(
        pid &&
        ["team", "speaking", "voting", "mission"].includes(phase) &&
        ((phase === "team" || phase === "speaking")
          ? (isLeaderNow ? selectedTeam.includes(pid) : (Array.isArray(game.team) && game.team.includes(pid)))
          : (Array.isArray(game.team) && game.team.includes(pid)))
      ),
      selectedAssassinate: !!(pid && selectedAssassinate && selectedAssassinate === pid),
      isAssassinated: !!(pid && assTargetId && pid === assTargetId),
      roleLabel: this.getRevealedRoleLabel(room, pid),
      roleImage: this.roleImageFor(this.getRevealedRoleLabel(room, pid)),
      roleClass: this.roleClassFor(this.getRevealedRoleLabel(room, pid)),
      action,
      actionDone
    });
  }
  return out;
},

buildRoundSeats(seatSlots = [], maxPlayers = 7) {
  const n = Math.max(5, Number(maxPlayers) || 7);
  return seatSlots.map((s, idx) => {
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
    const r = 39;
    const cx = 50;
    const cy = 50;
    const left = cx + r * Math.cos(angle);
    const top = cy + r * Math.sin(angle);
    return {
      ...s,
      leftStyle: `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;`
    };
  });
}
```
