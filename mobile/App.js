import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Share, Modal, ImageBackground, Platform, Image, Alert, AppState, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
const { decorateMedal, decorateMedals } = require('./miniprogram/utils/medals');

const getDefaultWsUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}/ws`;
  }
  return 'ws://127.0.0.1:8080/ws';
};

const normalizeWsUrl = (url) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('ws://')) {
    return `wss://${url.slice(5)}`;
  }
  return url;
};

const getWsUrlFromQuery = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('ws') || '';
  } catch (e) {
    return '';
  }
};

const resolveWsUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return normalizeWsUrl(getWsUrlFromQuery() || getDefaultWsUrl());
  }
  return normalizeWsUrl(process.env.EXPO_PUBLIC_WS_URL || getDefaultWsUrl());
};

const WS_URL = resolveWsUrl();
const HOME_BG = require('./assets/home-bg-optimized.jpg');
const IN_GAME_BG = require('./assets/in-game-bg-optimized.jpg');
const MISSION_SUCCESS_BG = require('./assets/quest-success-420x300.png');
const MISSION_FAIL_BG = require('./assets/quest-failed-420x300.png');
const FAIL_VOTE_ICON = require('./assets/ui-icons/vote-failed.png');
const UI_ICON_HISTORY = require('./assets/ui-icons/history_scroll.png');
const UI_ICON_STATS = require('./assets/ui-icons/stats_bars.png');
const UI_ICON_KILL = require('./assets/ui-icons/kill.png');
const ROLE_SPLIT_IMAGES = {
  merlin: require('./assets/role-split/merlin.png'),
  lancelotGood: require('./assets/role-split/lancelot_good.png'),
  percival: require('./assets/role-split/percival.png'),
  arthurLoyal: require('./assets/role-split/arthur_loyal.png'),
  morgana: require('./assets/role-split/morgana.png'),
  mordred: require('./assets/role-split/mordred.png'),
  oberon: require('./assets/role-split/oberon.png'),
  assassin: require('./assets/role-split/assassin.png'),
  minion: require('./assets/role-split/minion.png'),
  lancelotEvil: require('./assets/role-split/lancelot_evil.png'),
};
const PRELOAD_ASSETS = [HOME_BG, IN_GAME_BG, MISSION_SUCCESS_BG, MISSION_FAIL_BG, FAIL_VOTE_ICON, UI_ICON_HISTORY, UI_ICON_STATS, UI_ICON_KILL, ...Object.values(ROLE_SPLIT_IMAGES)];
const CN_FONT = Platform.select({
  ios: 'PingFang SC',
  android: 'sans-serif',
  default: 'sans-serif',
});
const IS_WEB = Platform.OS === 'web';

const ROLE_LABELS = {
  梅林: '好人(知情)',
  派西维尔: '好人(知梅林)',
  忠臣: '好人',
  '亚瑟的忠臣': '好人',
  '兰斯洛特（正义）': '好人',
  刺客: '坏人(刺杀)',
  莫甘娜: '坏人(假梅林)',
  莫德雷德: '坏人(不被梅林知)',
  奥伯伦: '坏人(不知同伴)',
  爪牙: '坏人',
  '兰斯洛特（邪恶）': '坏人',
};

const ROLE_ICONS = {
  随机: '🎲',
  梅林: '🧙',
  派西维尔: '🛡️',
  忠臣: '⚔️',
  刺客: '🗡️',
  莫甘娜: '🔮',
  莫德雷德: '👑',
  奥伯伦: '🌘',
  爪牙: '🦂',
};
const ALL_STATS_ROLES = ['梅林', '派西维尔', '忠臣', '莫甘娜', '刺客', '奥伯伦', '爪牙', '莫德雷德'];
const RULES_JOURNEY = [
  {
    step: '01',
    title: '登录与回到上局',
    scene: '首页',
    points: ['先登录账号，系统会尝试恢复上一次房间状态。', '首页可进入房间、查看游戏规则、历史对战和角色统计。'],
  },
  {
    step: '02',
    title: '圆桌选座与房间配置',
    scene: '房间页',
    points: ['玩家围绕圆桌入座，房主可调整人数、发言时长和角色配置。', '全部就位后由房主开始游戏。'],
  },
  {
    step: '03',
    title: '身份发放与发言',
    scene: '身份面板 / 发言阶段',
    points: ['开局先看自己的身份卡和可见信息。', '进入发言阶段后，按座位顺序依次讨论当前车队是否可信。'],
  },
  {
    step: '04',
    title: '投票、任务、刺杀',
    scene: '主界面',
    points: ['全员投票决定车队是否通过，通过后上车玩家执行任务。', '好人先拿到三次成功后，刺客进入刺杀翻盘阶段。'],
  },
];
const RULES_INTERFACE_TIPS = [
  '房间信息区会显示房号、人数、发言时长和当前角色配置。',
  '圆桌区会展示队长、发言顺序、是否上车和终局身份。',
  '底部操作区会根据阶段切换成组队、投票、任务、刺杀按钮。',
  '历史对战和角色统计里可以查看勋章、胜率和每局详情。',
];

const ROLE_SPRITE_FILE = {
  梅林: ROLE_SPLIT_IMAGES.merlin,
  派西维尔: ROLE_SPLIT_IMAGES.percival,
  忠臣: ROLE_SPLIT_IMAGES.arthurLoyal,
  '亚瑟的忠臣': ROLE_SPLIT_IMAGES.arthurLoyal,
  '兰斯洛特（正义）': ROLE_SPLIT_IMAGES.lancelotGood,
  莫甘娜: ROLE_SPLIT_IMAGES.morgana,
  刺客: ROLE_SPLIT_IMAGES.assassin,
  莫德雷德: ROLE_SPLIT_IMAGES.mordred,
  奥伯伦: ROLE_SPLIT_IMAGES.oberon,
  爪牙: ROLE_SPLIT_IMAGES.minion,
  '兰斯洛特（邪恶）': ROLE_SPLIT_IMAGES.lancelotEvil,
};

let SecureStore = null;
try {
  // Optional: install `expo-secure-store` for native persistent auto-login.
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = null;
}

const STORAGE_KEYS = {
  authToken: 'avalon_auth_token',
  phone: 'avalon_phone',
  activeRoomCode: 'avalon_active_room_code',
};

async function persistSet(key, value) {
  try {
    if (SecureStore && SecureStore.setItemAsync) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch (e) {}
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(key, value);
  } catch (e) {}
}

async function persistGet(key) {
  try {
    if (SecureStore && SecureStore.getItemAsync) {
      const v = await SecureStore.getItemAsync(key);
      if (v) return v;
    }
  } catch (e) {}
  try {
    if (globalThis.localStorage) return globalThis.localStorage.getItem(key) || '';
  } catch (e) {}
  return '';
}

async function persistRemove(key) {
  try {
    if (SecureStore && SecureStore.deleteItemAsync) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (e) {}
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem(key);
  } catch (e) {}
}

async function preloadStaticImages() {
  try {
    const tasks = PRELOAD_ASSETS.map((asset) => {
      try {
        const resolved = Image.resolveAssetSource(asset);
        if (!resolved || !resolved.uri) return Promise.resolve();
        return Image.prefetch(resolved.uri).catch(() => {});
      } catch (e) {
        return Promise.resolve();
      }
    });
    await Promise.all(tasks);
  } catch (e) {}
}

function roleTagColor(role) {
  if (!role) return '#9aa1ad';
  return ROLE_LABELS[role] && ROLE_LABELS[role].includes('坏人') ? '#ff5b5b' : '#2f7cf6';
}

function roleNameColor(role) {
  return ROLE_LABELS[role] && ROLE_LABELS[role].includes('坏人') ? '#ff4d66' : '#2ea7ff';
}

function rateColor(rate) {
  const n = Number(rate || 0);
  if (n <= 0) return '#ff4d4f';
  return '#22c55e';
}

function suggestedRoles(count) {
  if (count === 6) return ['梅林', '派西维尔', '莫甘娜', '刺客', '忠臣', '忠臣'];
  if (count === 7) return ['梅林', '派西维尔', '莫甘娜', '刺客', '忠臣', '忠臣', '奥伯伦'];
  if (count === 8) return ['梅林', '派西维尔', '莫甘娜', '刺客', '爪牙', '忠臣', '忠臣', '忠臣'];
  if (count === 9) return padRoles(['梅林', '派西维尔', '莫甘娜', '莫德雷德', '奥伯伦', '忠臣', '忠臣', '忠臣'], count);
  if (count === 10) return padRoles(['梅林', '派西维尔', '莫甘娜', '莫德雷德', '刺客', '奥伯伦', '忠臣', '忠臣', '忠臣'], count);
  return [];
}

function padRoles(roles, count) {
  const out = roles.slice();
  while (out.length < count) out.push('忠臣');
  return out;
}

function suggestedRolesLabel(count) {
  const roles = suggestedRoles(count);
  if (!roles.length) return '无';
  const counts = {};
  roles.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  return Object.entries(counts)
    .map(([r, c]) => `${c} ${r}`)
    .join('，');
}

function RoleTags({ roles }) {
  if (!roles || roles.length === 0) return null;
  return (
    <View style={styles.tags}>
      {roles.map((r, idx) => (
        <View key={`${r}-${idx}`} style={styles.tag}>
          <Text style={styles.tagText}>{r}</Text>
          <Text style={styles.tagSub}>{ROLE_LABELS[r] || '角色'}</Text>
        </View>
      ))}
    </View>
  );
}

function RoleSprite({ role, size = 64 }) {
  const imgSrc = ROLE_SPRITE_FILE[role];
  if (!imgSrc) {
    return (
      <View style={[styles.statsRoleAvatar, { width: size, height: size }]}>
        <Text style={styles.statsRoleAvatarText}>{ROLE_ICONS[role] || '🧍'}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statsRoleAvatar, styles.spriteClip, { width: size, height: size }]}>
      <Image
        source={imgSrc}
        style={{
          width: size,
          height: size,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

function RoleTagThumb({ role }) {
  const imgSrc = ROLE_SPRITE_FILE[role];
  if (!imgSrc) return <Text style={styles.hostRoleThumbFallback}>{ROLE_ICONS[role] || '🎲'}</Text>;
  return <Image source={imgSrc} style={styles.hostRoleThumb} resizeMode="cover" />;
}

function RoleBadgeContent({ role }) {
  return (
    <View style={styles.roleBadgeRow}>
      <RoleTagThumb role={role} />
      <Text style={styles.roleTagText}>{role}</Text>
    </View>
  );
}

function MedalChip({ medal, onPress, compact = false }) {
  if (!medal) return null;
  const image = medal.image || '';
  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(medal)}
      style={[styles.medalChip, compact && styles.medalChipCompact]}
      activeOpacity={0.82}
    >
      {image ? (
        <Image source={{ uri: image }} style={[styles.medalChipImage, compact && styles.medalChipImageCompact]} resizeMode="cover" />
      ) : (
        <View style={[styles.medalChipFallback, compact && styles.medalChipFallbackCompact]}>
          <Text style={styles.medalChipFallbackText}>🏅</Text>
        </View>
      )}
      {!compact && (
        <View style={styles.medalChipTextWrap}>
          <Text style={styles.medalChipName} numberOfLines={1}>{medal.name}</Text>
          {typeof medal.total === 'number' && <Text style={styles.medalChipMeta}>x{medal.total}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function App() {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(1200);
  const appStateRef = useRef(AppState.currentState);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState('');
  const [phone, setPhone] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [room, setRoom] = useState(null);
  const [nickname, setNickname] = useState('玩家');
  const [avatar, setAvatar] = useState('🐺');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('7');
  const [speakingSeconds, setSpeakingSeconds] = useState('180');
  const [rolesText, setRolesText] = useState('');
  const [hostRole, setHostRole] = useState('随机');
  const [ladyOfLakeEnabled, setLadyOfLakeEnabled] = useState(false);
  const [showRoleConfig, setShowRoleConfig] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [myRole, setMyRole] = useState('');
  const [selectedTeam, setSelectedTeam] = useState([]);
  const [tableSize, setTableSize] = useState({ w: 0, h: 0 });
  const [speakRoundView, setSpeakRoundView] = useState('1-1');
  const [speakText, setSpeakText] = useState('');
  const [roleInfo, setRoleInfo] = useState(null);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [evilReveal, setEvilReveal] = useState(null);
  const [selectedAssassinate, setSelectedAssassinate] = useState(null);
  const [showTaskInfo, setShowTaskInfo] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [teamConfirmed, setTeamConfirmed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showMaxPlayersPicker, setShowMaxPlayersPicker] = useState(false);
  const [selectedMedal, setSelectedMedal] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [roleStats, setRoleStats] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [missionFx, setMissionFx] = useState(null);
  const missionFxOpacity = useRef(new Animated.Value(0)).current;
  const missionFxScale = useRef(new Animated.Value(0.92)).current;
  const missionFxBurst = useRef(new Animated.Value(0.2)).current;
  const missionFxTimerRef = useRef(null);
  const prevMissionCountRef = useRef(0);
  const missionResultBgReadyRef = useRef(false);
  const missionResultBgWarmupRef = useRef(null);
  const roleSyncRequestAtRef = useRef(0);
  const activeRoomCodeRef = useRef('');

  function ensureMissionResultBgReady() {
    if (missionResultBgReadyRef.current) return Promise.resolve();
    if (missionResultBgWarmupRef.current) return missionResultBgWarmupRef.current;
    missionResultBgWarmupRef.current = (async () => {
      try {
        const successResolved = Image.resolveAssetSource(MISSION_SUCCESS_BG);
        const failResolved = Image.resolveAssetSource(MISSION_FAIL_BG);
        const tasks = [];
        if (successResolved && successResolved.uri) tasks.push(Image.prefetch(successResolved.uri));
        if (failResolved && failResolved.uri) tasks.push(Image.prefetch(failResolved.uri));
        if (tasks.length) {
          await Promise.all(tasks);
          missionResultBgReadyRef.current = true;
        }
      } catch (e) {
      } finally {
        missionResultBgWarmupRef.current = null;
      }
    })();
    return missionResultBgWarmupRef.current;
  }

  useEffect(() => {
    (async () => {
      const savedPhone = await persistGet(STORAGE_KEYS.phone);
      const savedToken = await persistGet(STORAGE_KEYS.authToken);
      const savedRoomCode = await persistGet(STORAGE_KEYS.activeRoomCode);
      if (savedPhone) setPhone(savedPhone);
      if (savedToken) setAuthToken(savedToken);
      if (savedRoomCode) activeRoomCodeRef.current = savedRoomCode;
      preloadStaticImages();
      ensureMissionResultBgReady();
    })();
    connect();
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      clearInterval(t);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try {
        if (wsRef.current) wsRef.current.close();
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    return () => {
      if (missionFxTimerRef.current) clearTimeout(missionFxTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (!/inactive|background/.test(prevState || '') || nextState !== 'active') return;
      const ws = wsRef.current;
      const isAlive = ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
      if (!isAlive) {
        connect();
        return;
      }
      requestRoomRecovery();
    });
    return () => {
      try {
        sub.remove();
      } catch (e) {}
    };
  }, [authToken]);

  function connect() {
    try {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
    } catch (e) {}
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelayRef.current = 1200;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (authToken) {
        ws.send(JSON.stringify({ type: 'AUTH', payload: { token: authToken } }));
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (reconnectTimerRef.current) return;
      const delay = Math.min(reconnectDelayRef.current, 8000);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        reconnectDelayRef.current = Math.min(Math.floor(reconnectDelayRef.current * 1.6), 8000);
        connect();
      }, delay);
    };
    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.type === 'WELCOME') {
        setClientId(msg.clientId);
      }
      if (msg.type === 'ERROR') {
        const code = msg.code || 'UNKNOWN';
        const text = `错误: ${code}`;
        if (code === 'INVALID_TOKEN') {
          setAuthToken('');
          persistRemove(STORAGE_KEYS.authToken);
          if (phone && /^1\d{10}$/.test(phone)) {
            send('LOGIN', { phone });
            return;
          }
        }
        if (code === 'ROOM_NOT_FOUND' && pendingJoinCode) {
          send('CREATE_ROOM', {
            roomCode: pendingJoinCode,
            nickname,
            avatar,
            maxPlayers: 7,
            roles: suggestedRoles(7),
          });
          setPendingJoinCode('');
          return;
        }
        setErrorText(text);
        setPendingJoinCode('');
        if (code === 'NEED_LOGIN') setLoggedIn(false);
      }
      if (msg.type === 'LOGIN_OK' || msg.type === 'AUTH_OK') {
        const data = msg.data || {};
        const user = data.user || {};
        if (data.recoveredPlayerId) setClientId(String(data.recoveredPlayerId));
        if (data.token) setAuthToken(data.token);
        setLoggedIn(true);
        setShowAuthModal(false);
        if (user.phone) setPhone(user.phone);
        if (user.nickname) setNickname(user.nickname);
        if (user.avatar) setAvatar(user.avatar);
        if (data.token) persistSet(STORAGE_KEYS.authToken, data.token);
        if (user.phone) persistSet(STORAGE_KEYS.phone, user.phone);
        if (!data.recovered) requestRoomRecovery();
      }
      if (msg.type === 'RECOVERED') {
        if (msg.data && msg.data.playerId) setClientId(String(msg.data.playerId));
        const roomCode = msg.data && msg.data.roomCode ? String(msg.data.roomCode) : '';
        if (roomCode) {
          activeRoomCodeRef.current = roomCode;
          persistSet(STORAGE_KEYS.activeRoomCode, roomCode);
          setErrorText(`已恢复到房间 ${roomCode}`);
        }
      }
      if (msg.type === 'ROLE_INFO') {
        if (msg.data && msg.data.role) setMyRole(msg.data.role);
        setRoleInfo(msg.data || null);
        setShowRoleInfo(true);
      }
      if (msg.type === 'LADY_OF_LAKE_RESULT') {
        const data = msg.data || {};
        const targetName = data.targetNickname || '未知玩家';
        const alignment = data.alignment === 'evil' ? '坏人' : '好人';
        Alert.alert('验人结果', `${targetName} 的阵营是：${alignment}`);
      }
      if (msg.type === 'EVIL_REVEAL') {
        setEvilReveal(msg.data || null);
      }
      if (msg.type === 'PRIVATE_ROLE') {
        setMyRole(msg.role || '');
      }
      if (msg.type === 'ROOM_STATE') {
        setRoom(msg.room);
        setPendingJoinCode('');
        const nextRoomCode = msg.room && msg.room.code ? String(msg.room.code) : '';
        activeRoomCodeRef.current = nextRoomCode;
        if (nextRoomCode) {
          persistSet(STORAGE_KEYS.activeRoomCode, nextRoomCode);
        } else {
          persistRemove(STORAGE_KEYS.activeRoomCode);
        }
        if (msg.room && msg.room.hostId === clientId) {
          setMaxPlayers(String(msg.room.maxPlayers));
          setSpeakingSeconds(String(msg.room.speakingSeconds));
          if (Array.isArray(msg.room.roles)) setRolesText(msg.room.roles.join(', '));
          setHostRole(msg.room.hostRole || '随机');
        }
        setLadyOfLakeEnabled(!!(msg.room && msg.room.ladyOfLakeEnabled));
      }
      if (msg.type === 'GAME_HISTORY_LIST') {
        setHistoryList((msg.data && msg.data.list) || []);
      }
      if (msg.type === 'GAME_HISTORY_DETAIL') {
        setHistoryDetail(msg.data || null);
        setShowHistoryDetailModal(true);
      }
      if (msg.type === 'ROLE_STATS') {
        setRoleStats(msg.data || null);
      }
    };
  }

  function requestRoomRecovery() {
    const roomCode = (room && room.code ? room.code : activeRoomCodeRef.current || '').trim();
    if (!roomCode || !authToken) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomCode, nickname, avatar } }));
  }

  useEffect(() => {
    if (!connected || !authToken || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'AUTH', payload: { token: authToken } }));
  }, [connected, authToken]);

  useEffect(() => {
    // update suggested roles when maxPlayers changes
    const count = parseInt(maxPlayers, 10);
    if (!Number.isFinite(count)) return;
    const suggested = suggestedRoles(count);
    if (suggested && suggested.length) {
      setRolesText(suggested.join(', '));
    }
  }, [maxPlayers]);

  useEffect(() => {
    if (!room || !room.game) return;
    if (room.game.team && room.game.team.length > 0) {
      setSelectedTeam(room.game.team);
    } else if (room.game.teamSize) {
      setSelectedTeam([]);
    }
    if (!room.game.team || room.game.team.length !== room.game.teamSize) {
      setTeamConfirmed(false);
    }
  }, [room?.game?.round, room?.game?.leaderId, room?.game?.teamSize, JSON.stringify(room?.game?.team || [])]);

  useEffect(() => {
    if (room && room.game && room.game.round) {
      setSpeakRoundView(`${room.game.round}-${room.game.attempt || 1}`);
    }
    if (!room || !room.game) return;
    if (room.game.phase !== 'assassination') {
      setSelectedAssassinate(null);
    }
    if (room.game.phase === 'voting' || room.game.phase === 'mission' || room.game.phase === 'end') {
      setTeamConfirmed(false);
    }
  }, [room?.game?.round, room?.game?.phase]);

  useEffect(() => {
    if (!connected || !room || !room.game || !clientId) return;
    const inRoom = Array.isArray(room.players) && room.players.some((p) => p.id === clientId);
    if (!inRoom) return;
    if (myRole) return;
    const nowTs = Date.now();
    if (nowTs - roleSyncRequestAtRef.current < 2200) return;
    roleSyncRequestAtRef.current = nowTs;
    send('VIEW_ROLE');
  }, [connected, clientId, room?.code, room?.game?.phase, room?.game?.round, room?.players?.length, myRole]);

  useEffect(() => {
    const count = room?.game?.missionHistory?.length || 0;
    if (!room?.game) {
      prevMissionCountRef.current = 0;
      return;
    }
    if (count > prevMissionCountRef.current && room.game.phase !== 'mission') {
      const last = room.game.missionHistory[count - 1];
      if (last) showMissionResultFx(last);
    }
    prevMissionCountRef.current = count;
  }, [room?.game?.missionHistory?.length, room?.game?.phase]);

  async function showMissionResultFx(mission) {
    if (!mission) return;
    await ensureMissionResultBgReady();
    if (missionFxTimerRef.current) clearTimeout(missionFxTimerRef.current);
    setMissionFx({
      success: !!mission.success,
      fails: mission.fails || 0,
      round: mission.round || 0,
      ts: Date.now(),
    });
    missionFxOpacity.setValue(0);
    missionFxScale.setValue(0.92);
    missionFxBurst.setValue(0.15);
    Animated.parallel([
      Animated.timing(missionFxOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(missionFxScale, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(missionFxBurst, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    missionFxTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(missionFxOpacity, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(missionFxScale, {
          toValue: 1.04,
          duration: 360,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setMissionFx(null));
    }, 2500);
  }

  function toggleTeamMember(id) {
    let next;
    if (selectedTeam.includes(id)) {
      next = selectedTeam.filter((x) => x !== id);
    } else {
      if (selectedTeam.length >= teamSize) return;
      next = [...selectedTeam, id];
    }
    setSelectedTeam(next);
    setTeamConfirmed(false);
    updateTeam(next);
  }

  function send(type, payload) {
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setErrorText('连接未就绪，请稍后重试');
      return;
    }
    wsRef.current.send(JSON.stringify({ type, payload }));
  }

  function createRoom() {
    if (!loggedIn) return setErrorText('请先手机号登录');
    send('CREATE_ROOM', {
      nickname,
      avatar,
      maxPlayers: parseInt(maxPlayers, 10),
      speakingSeconds: parseInt(speakingSeconds, 10),
      roles: rolesFromText(),
      hostRole: hostRole === '随机' ? null : hostRole,
      ladyOfLakeEnabled: ladyOfLakeEnabled && parseInt(maxPlayers, 10) >= 8,
    });
  }

  function joinRoom() {
    if (!loggedIn) return setErrorText('请先手机号登录');
    send('JOIN_ROOM', { roomCode: roomCodeInput.trim().toUpperCase(), nickname, avatar });
  }

  function enterRoom() {
    if (!loggedIn) return setErrorText('请先手机号登录');
    const code = roomCodeInput.trim();
    setErrorText('');
    if (!code) {
      send('CREATE_ROOM', {
        nickname,
        avatar,
        maxPlayers: 7,
        roles: suggestedRoles(7),
        ladyOfLakeEnabled: false,
      });
      return;
    }
    if (!/^\d{5}$/.test(code)) {
      setErrorText('房间号必须是5位数字');
      return;
    }
    const normalized = code.toUpperCase();
    setPendingJoinCode(normalized);
    send('JOIN_ROOM', { roomCode: normalized, nickname, avatar });
  }

  function watchRoomByCode() {
    if (!loggedIn) return setErrorText('请先手机号登录');
    const code = roomCodeInput.trim();
    setErrorText('');
    if (!/^\d{5}$/.test(code)) {
      setErrorText('观战需要输入5位房间号');
      return;
    }
    send('WATCH_ROOM', { roomCode: code.toUpperCase(), nickname, avatar });
  }

  function leaveRoom() {
    send('LEAVE_ROOM');
    setRoom(null);
    activeRoomCodeRef.current = '';
    persistRemove(STORAGE_KEYS.activeRoomCode);
  }

  function updateProfile() {
    if (!loggedIn) return setErrorText('请先手机号登录');
    send('SET_PROFILE', { nickname, avatar });
  }

  function loginWithPhone() {
    const p = (phone || '').trim();
    if (!/^1\d{10}$/.test(p)) {
      setErrorText('手机号格式错误，应为11位并以1开头');
      return;
    }
    send('LOGIN', { phone: p });
  }

  async function logoutAccount() {
    setLoggedIn(false);
    setAuthToken('');
    setShowAuthModal(false);
    await persistRemove(STORAGE_KEYS.authToken);
    await persistRemove(STORAGE_KEYS.activeRoomCode);
    activeRoomCodeRef.current = '';
  }

  function chooseSeat(index) {
    send('CHOOSE_SEAT', { seatIndex: index });
  }

  function updateSettings(next = {}) {
    const nextCount = parseInt(next.maxPlayers ?? maxPlayers, 10);
    const resolvedCount = Number.isFinite(nextCount) ? nextCount : 7;
    const nextRoles = suggestedRoles(resolvedCount);
    const nextHostRoleRaw = next.hostRole !== undefined ? next.hostRole : hostRole;
    const resolvedHostRole = nextHostRoleRaw && nextHostRoleRaw !== '随机' && nextRoles.includes(nextHostRoleRaw) ? nextHostRoleRaw : '随机';

    if (next.maxPlayers !== undefined) {
      setMaxPlayers(String(resolvedCount));
      setRolesText(nextRoles.join(', '));
      if (resolvedHostRole !== hostRole) setHostRole(resolvedHostRole);
    }
    if (next.hostRole !== undefined) {
      setHostRole(resolvedHostRole);
    }

    send('UPDATE_SETTINGS', {
      maxPlayers: resolvedCount,
      speakingSeconds: parseInt(speakingSeconds, 10),
      roles: nextRoles,
      hostRole: resolvedHostRole === '随机' ? null : resolvedHostRole,
      ladyOfLakeEnabled: (next.ladyOfLakeEnabled !== undefined ? !!next.ladyOfLakeEnabled : ladyOfLakeEnabled) && resolvedCount >= 8,
    });
    if (next.maxPlayers !== undefined && resolvedCount < 8) {
      setLadyOfLakeEnabled(false);
    }
    if (next.ladyOfLakeEnabled !== undefined) {
      setLadyOfLakeEnabled(!!next.ladyOfLakeEnabled && resolvedCount >= 8);
    }
  }

  function startGame() {
    send('START_GAME');
  }

  function resetGame() {
    send('RESET_GAME');
  }

  function nextSpeaker() {
    send('NEXT_SPEAKER');
  }

  function startMissionPhase() {
    send('START_MISSION_PHASE');
  }

  function proposeTeam() {
    send('PROPOSE_TEAM', { team: selectedTeam });
  }

  function updateTeam(team) {
    send('UPDATE_TEAM', { team });
  }

  function confirmTeam() {
    if (selectedTeam.length !== teamSize) return;
    if (phase === 'team') {
      setTeamConfirmed(true);
      proposeTeam();
      return;
    }
    setTeamConfirmed(true);
    updateTeam(selectedTeam);
  }

  function handleLeaderTeamAction() {
    if (selectedTeam.length !== teamSize) return;
    if (phase === 'team') {
      confirmTeam();
      return;
    }
    if (phase === 'speaking') {
      if (teamConfirmed) {
        proposeTeam();
      } else {
        confirmTeam();
      }
    }
  }

  function leaderTeamButtonText() {
    if (selectedTeam.length !== teamSize) return `选择队员 ${selectedTeam.length}/${teamSize}`;
    if (phase === 'team') return '提名队伍';
    if (phase === 'speaking') return teamConfirmed ? '发起队伍投票' : '提名队伍';
    return `选择队员 ${selectedTeam.length}/${teamSize}`;
  }

  function voteTeam(approve) {
    send('VOTE_TEAM', { approve });
  }

  function executeMission(fail) {
    send('EXECUTE_MISSION', { fail });
  }

  function assassinate(targetId) {
    send('ASSASSINATE', { targetId });
  }

  function useLadyOfLake(targetId) {
    send('USE_LADY_OF_LAKE', { targetId });
  }

  function speak() {
    const text = speakText.trim();
    if (!text) return;
    send('SPEAK', { text });
    setSpeakText('');
  }

  function endSpeak() {
    send('END_SPEAK');
  }

  function startAssassination() {
    setShowRoleInfo(false);
    send('START_ASSASSINATION');
  }

  function redealIdentities() {
    Alert.alert('确认重发身份', '将按当前配置重新开始本局并给所有玩家重新发身份牌，是否继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => {
          send('REDEAL_IDENTITIES');
          setShowRoleInfo(false);
          setRoleInfo(null);
          setEvilReveal(null);
          setSelectedAssassinate(null);
        },
      },
    ]);
  }

  function viewRole() {
    send('VIEW_ROLE');
  }

  function openHistory(page = 1) {
    const p = Math.max(1, page);
    setHistoryPage(p);
    send('GET_GAME_HISTORY_LIST', { limit: 10, offset: (p - 1) * 10 });
    setShowHistoryModal(true);
  }

  function openHistoryDetail(gameId) {
    setShowHistoryModal(false);
    setHistoryDetail(null);
    send('GET_GAME_HISTORY_DETAIL', { gameId });
  }

  function openRoleStats() {
    send('GET_ROLE_STATS', {});
    setShowStatsModal(true);
  }

  function openRules() {
    setShowRulesModal(true);
  }

  function showMedalDetail(medal) {
    if (!medal) return;
    setSelectedMedal(decorateMedal(medal));
  }

  function fmtTs(ts) {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch (e) {
      return '-';
    }
  }

  function roleStatsRowsComplete(stats) {
    const map = new Map(((stats && stats.byRole) || []).map((r) => [r.role, r]));
    return ALL_STATS_ROLES.map((role) => {
      const row = map.get(role);
      if (row) return row;
      return { role, total: 0, wins: 0, winRate: 0 };
    });
  }

  const historyListDecorated = historyList.map((item) => ({ ...item, medals: decorateMedals(item.medals) }));
  const historyDetailDecorated = historyDetail ? { ...historyDetail, medals: decorateMedals(historyDetail.medals) } : null;
  const roleStatsDecorated = roleStats ? { ...roleStats, medals: decorateMedals(roleStats.medals) } : null;

  function roleVisibleSeatRows() {
    if (!room || !roleInfo || !Array.isArray(roleInfo.seats)) return [];
    return roleInfo.seats
      .map((seat) => {
        const playerId = room.seats && room.seats[seat - 1];
        const player = room.players ? room.players.find((p) => p.id === playerId) : null;
        return {
          seat,
          playerId,
          nickname: player ? player.nickname : '未知',
        };
      })
      .filter((x) => Number.isFinite(x.seat))
      .sort((a, b) => a.seat - b.seat);
  }

  function teamDisplayRows(teamIds) {
    if (!room || !Array.isArray(teamIds)) return [];
    return teamIds
      .map((id) => {
        const seat = room.seats ? room.seats.findIndex((x) => x === id) + 1 : 0;
        const player = room.players ? room.players.find((p) => p.id === id) : null;
        return { id, seat, nickname: player ? player.nickname : '未知', isMe: id === clientId };
      })
      .filter((x) => x.seat > 0)
      .sort((a, b) => a.seat - b.seat);
  }

  function ladyHistoryRows() {
    if (!room || !room.game || !room.game.ladyOfLake || !Array.isArray(room.game.ladyOfLake.history)) return [];
    return room.game.ladyOfLake.history.map((item) => {
      const holder = room.players ? room.players.find((p) => p.id === item.holderId) : null;
      const target = room.players ? room.players.find((p) => p.id === item.targetId) : null;
      return {
        round: item.round || 0,
        holderName: holder ? holder.nickname : seatNo(item.holderId),
        targetName: target ? target.nickname : seatNo(item.targetId),
      };
    });
  }

  const speakingRemainingSec =
    room && room.speaking && room.speaking.endAt ? Math.max(0, Math.floor((room.speaking.endAt - tick) / 1000)) : 0;
  const speakingTotalSec = room && room.speakingSeconds ? room.speakingSeconds : 180;
  const speakingProgress = Math.max(0, Math.min(1, speakingRemainingSec / Math.max(1, speakingTotalSec)));

  function detailSeat(detail, id) {
    if (!detail || !Array.isArray(detail.players)) return '?';
    const found = detail.players.find((p) => p.id === id);
    return found && found.seat ? found.seat : '?';
  }

  function historyDetailPlayers(detail) {
    if (!detail || !Array.isArray(detail.players)) return [];
    return detail.players.slice().sort((a, b) => (a.seat || 0) - (b.seat || 0));
  }

  function historyTaskRows(detail) {
    const missionByRound = new Map(((detail && detail.missionHistory) || []).map((m) => [m.round, m]));
    return ((detail && detail.voteHistory) || [])
      .map((v, idx) => ({
        round: v.round || 0,
        attempt: v.attempt || idx + 1,
        leaderSeat: detailSeat(detail, v.leaderId),
        teamSeats: (v.team || []).map((id) => detailSeat(detail, id)).sort((a, b) => a - b),
        approveSeats: Object.entries(v.votes || {})
          .filter(([, a]) => !!a)
          .map(([id]) => detailSeat(detail, id))
          .sort((a, b) => a - b),
        rejectSeats: Object.entries(v.votes || {})
          .filter(([, a]) => !a)
          .map(([id]) => detailSeat(detail, id))
          .sort((a, b) => a - b),
        approved: !!v.approved,
        mission: missionByRound.get(v.round) || null,
      }))
      .sort((a, b) => (b.round - a.round) || (b.attempt - a.attempt));
  }

  function rolesFromText() {
    const parts = rolesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }

  function uniqueRoles() {
    if (!room || !room.roles) return [];
    return Array.from(new Set(room.roles));
  }

  function seatNo(id) {
    if (!room || !room.seats) return '?';
    const idx = room.seats.findIndex((x) => x === id);
    return idx >= 0 ? `#${idx + 1}` : '?';
  }

  function missionMatrix(count) {
    const sizes = {
      5: [2, 3, 2, 3, 3],
      6: [2, 3, 4, 3, 4],
      7: [2, 3, 3, 4, 4],
      8: [3, 4, 4, 5, 5],
      9: [3, 4, 4, 5, 5],
      10: [3, 4, 4, 5, 5],
    }[count] || [2, 3, 3, 4, 4];
    const fails = {
      5: [1, 1, 1, 1, 1],
      6: [1, 1, 1, 1, 1],
      7: [1, 1, 1, 2, 1],
      8: [1, 1, 1, 2, 1],
      9: [1, 1, 1, 2, 1],
      10: [1, 1, 1, 2, 1],
    }[count] || [1, 1, 1, 2, 1];
    return { sizes, fails };
  }

  function missionMapByRound() {
    if (!room || !room.game) return {};
    const map = {};
    (room.game.missionHistory || []).forEach((m) => {
      map[m.round] = m;
    });
    return map;
  }

  const isHost = room && room.hostId === clientId;
  const isSpectator = !!(room && room.players && !room.players.find((p) => p.id === clientId));
  const isLeader = room && room.game && room.game.leaderId === clientId;
  const teamSize = room && room.game ? room.game.teamSize : 0;
  const phase = room && room.game ? room.game.phase : null;
  const ladyOfLake = room && room.game ? room.game.ladyOfLake : null;
  const isLadyHolder = !!(phase === 'lady' && ladyOfLake && ladyOfLake.holderId === clientId);
  const ladyEligibleTargets = room && room.seats && ladyOfLake
    ? room.seats.filter((id) => {
        if (!id || id === ladyOfLake.holderId) return false;
        const previousHolders = new Set((ladyOfLake.history || []).map((item) => item.holderId));
        previousHolders.add(ladyOfLake.holderId);
        return !previousHolders.has(id);
      })
    : [];
  const myVoted = room && room.game && room.game.votes ? room.game.votes[clientId] !== undefined : false;
  const inTeam = room && room.game && room.game.team ? room.game.team.includes(clientId) : false;
  const myMissionDone = room && room.game && room.game.missionVotes ? room.game.missionVotes[clientId] !== undefined : false;
  const isAssassin = myRole === '刺客';
  const isMyTurn = room && room.speaking && room.seats[room.speaking.index] === clientId;
  const displayTeam =
    phase === 'end' || phase === 'assassination'
      ? []
      : phase === 'team' && isLeader
        ? selectedTeam
        : room && room.game && room.game.team
          ? room.game.team
          : [];
  const speakKeys = room && room.game && room.game.speakHistory
    ? Object.keys(room.game.speakHistory).sort((a, b) => {
        const [ar, aa] = a.split('-').map((n) => parseInt(n, 10));
        const [br, ba] = b.split('-').map((n) => parseInt(n, 10));
        if (ar !== br) return ar - br;
        return aa - ba;
      })
    : [];
  const speakIndex = speakKeys.indexOf(speakRoundView);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {!room ? (
        IS_WEB ? (
          <View style={styles.homeBgFixed} pointerEvents="none">
            <Image source={HOME_BG} style={[styles.webBgImage, styles.webBgImageHome]} resizeMode="contain" />
            <View style={styles.homeOverlay} />
          </View>
        ) : (
          <ImageBackground
            source={HOME_BG}
            style={styles.homeBgFixed}
            imageStyle={styles.homeBgImage}
            resizeMode="cover"
            pointerEvents="none"
          >
            <View style={styles.homeOverlay} />
          </ImageBackground>
        )
      ) : (
        IS_WEB ? (
          <View style={styles.homeBgFixed} pointerEvents="none">
            <Image source={IN_GAME_BG} style={[styles.webBgImage, styles.webBgImageGame]} resizeMode="contain" />
            <View style={styles.inGameOverlay} />
          </View>
        ) : (
          <ImageBackground
            source={IN_GAME_BG}
            style={styles.homeBgFixed}
            imageStyle={styles.inGameBgImage}
            resizeMode="cover"
            pointerEvents="none"
          >
            <View style={styles.inGameOverlay} />
          </ImageBackground>
        )
      )}
      <ScrollView contentContainerStyle={[styles.scroll, !room && styles.scrollHome]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity style={styles.authTopBtn} onPress={() => setShowAuthModal(true)}>
              <Text style={styles.authTopBtnText}>{loggedIn ? nickname : '登录'}</Text>
            </TouchableOpacity>
            {room ? (
              <TouchableOpacity style={styles.roomCodeChip} onPress={() => setShowConfig((v) => !v)}>
                <Text style={styles.roomCodeChipText}>{room.code}{showConfig ? ' ▲' : ' ▼'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {room && (
            <TouchableOpacity
              style={styles.viewRoleSmall}
              onPress={() => {
                if (showRoleInfo) {
                  setShowRoleInfo(false);
                } else {
                  viewRole();
                }
              }}
            >
              <Text style={styles.viewRoleSmallText}>查看身份</Text>
            </TouchableOpacity>
          )}
        </View>
        {room && showConfig && (
          <View style={styles.cardInner}>
            <Text style={styles.label}>连接状态: {connected ? '已连接' : '未连接'}</Text>
            <Text style={styles.label}>WS: {WS_URL}</Text>
            <Text style={styles.label}>房间号: {room.code}</Text>
            <Text style={styles.label}>房主: {room.hostId === clientId ? '你' : room.hostId}</Text>
            <Text style={styles.label}>人数: {room.maxPlayers}</Text>
            <Text style={styles.label}>观战: {room.spectatorCount || 0}</Text>
            <Text style={styles.label}>发言限制: {room.speakingSeconds}s</Text>
            <Text style={styles.label}>湖中仙女: {room.ladyOfLakeEnabled ? '开启' : '关闭'}</Text>
            <Text style={styles.label}>角色配置: {room.roles.join('，')}</Text>
            {isSpectator && <Text style={styles.label}>当前身份: 观战者（只读）</Text>}
            <View style={styles.row}>
              <TouchableOpacity style={styles.button} onPress={() => Share.share({ message: `阿瓦隆房间号: ${room.code}` })}>
                <Text style={styles.buttonText}>邀请好友</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonAlt} onPress={leaveRoom}>
                <Text style={styles.buttonText}>离开房间</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!room && (
          <View style={styles.homePanelWrap}>
            <View style={[styles.card, styles.homeCard]}>
              {errorText ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorText}</Text>
                </View>
              ) : null}
              <TextInput
                style={styles.roomEntryInput}
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
                placeholder="输入5位房间号（留空则创建7人新房间）"
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity style={[styles.button, !loggedIn && styles.centerButtonDisabled]} onPress={enterRoom} disabled={!loggedIn}>
                <Text style={styles.buttonText}>进入房间</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonAlt, !loggedIn && styles.centerButtonDisabled]} onPress={watchRoomByCode} disabled={!loggedIn}>
                <Text style={styles.buttonText}>观战进入</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonAlt} onPress={openRules}>
                <Text style={styles.buttonText}>游戏规则</Text>
              </TouchableOpacity>
              <View style={styles.cardInner}>
                <Text style={styles.label}>连接状态: {connected ? '已连接' : '未连接'}</Text>
                <Text style={styles.label}>WS: {WS_URL}</Text>
                {loggedIn && <Text style={styles.label}>账号: {phone}</Text>}
              </View>
            </View>
          </View>
        )}

        <Modal visible={showAuthModal} transparent animationType="fade" onRequestClose={() => setShowAuthModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {!loggedIn && (
                <>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="请输入11位手机号"
                    keyboardType="phone-pad"
                    maxLength={11}
                  />
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                      loginWithPhone();
                    }}
                  >
                    <Text style={styles.buttonText}>确定</Text>
                  </TouchableOpacity>
                </>
              )}
              {loggedIn && (
                <>
                  <Text style={styles.label}>手机号：{phone}</Text>
                  <TextInput
                    style={styles.input}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="修改昵称"
                  />
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                      updateProfile();
                      setShowAuthModal(false);
                    }}
                  >
                    <Text style={styles.buttonText}>保存昵称</Text>
                  </TouchableOpacity>
                  <View style={styles.authActionRow}>
                    <TouchableOpacity
                      style={styles.authFeatureBtn}
                      onPress={() => {
                        setShowAuthModal(false);
                        setTimeout(() => openHistory(1), 50);
                      }}
                    >
                      <Image source={UI_ICON_HISTORY} style={styles.authFeatureIconImg} resizeMode="contain" />
                      <Text style={styles.authFeatureText}>对战记录</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.authFeatureBtn}
                      onPress={() => {
                        setShowAuthModal(false);
                        setTimeout(() => openRoleStats(), 50);
                      }}
                    >
                      <Image source={UI_ICON_STATS} style={styles.authFeatureIconImg} resizeMode="contain" />
                      <Text style={styles.authFeatureText}>角色统计</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.authFeatureBtn}
                      onPress={() => {
                        setShowAuthModal(false);
                        setTimeout(() => openRules(), 50);
                      }}
                    >
                      <Text style={styles.authFeatureEmoji}>📜</Text>
                      <Text style={styles.authFeatureText}>游戏规则</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.buttonAlt} onPress={logoutAccount}>
                    <Text style={styles.buttonText}>登出</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.buttonAlt} onPress={() => setShowAuthModal(false)}>
                <Text style={styles.buttonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showRulesModal} transparent animationType="slide" onRequestClose={() => setShowRulesModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.largeModalCard]}>
              <Text style={styles.section}>游戏规则</Text>
              <ScrollView style={styles.historyListWrap}>
                <View style={styles.cardInner}>
                  <Text style={styles.section}>界面式上手流程</Text>
                  {RULES_JOURNEY.map((item) => (
                    <View key={`rule-${item.step}`} style={styles.rulesJourneyCard}>
                      <View style={styles.rulesJourneyHead}>
                        <View style={styles.rulesJourneyStep}>
                          <Text style={styles.rulesJourneyStepText}>{item.step}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rulesJourneyTitle}>{item.title}</Text>
                          <Text style={styles.rulesJourneyScene}>{item.scene}</Text>
                        </View>
                      </View>
                      {item.points.map((point, idx) => (
                        <Text key={`rule-point-${item.step}-${idx}`} style={styles.rulesJourneyPoint}>{point}</Text>
                      ))}
                    </View>
                  ))}
                </View>
                <View style={styles.cardInner}>
                  <Text style={styles.section}>主界面怎么看</Text>
                  {RULES_INTERFACE_TIPS.map((tip, idx) => (
                    <Text key={`rule-tip-${idx}`} style={styles.label}>{tip}</Text>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.buttonAlt} onPress={() => setShowRulesModal(false)}>
                <Text style={styles.buttonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.largeModalCard]}>
              <Text style={styles.section}>历史对战记录</Text>
              <ScrollView style={styles.historyListWrap}>
                {historyListDecorated.length === 0 ? (
                  <Text style={styles.label}>暂无历史记录</Text>
                ) : (
                  historyListDecorated.map((item) => (
                    <TouchableOpacity
                      key={`h-${item.gameId}`}
                      style={[styles.historyItem, item.result === 'win' && styles.historyItemWin]}
                      onPress={() => openHistoryDetail(item.gameId)}
                    >
                      <View style={styles.historyRowTop}>
                        <RoleTagThumb role={item.role} />
                        <Text style={styles.historyRoleFirst}>{item.role}</Text>
                        <Text style={[styles.historyResultBadge, item.result === 'win' ? styles.historyResultWin : styles.historyResultLose]}>
                          {item.result === 'win' ? '胜利' : '失败'}
                        </Text>
                      </View>
                      <Text style={styles.historyTitle}>
                        {fmtTs(item.playedAt)} · {item.maxPlayers}人 · 座位 {item.seat}
                      </Text>
                      <Text style={styles.historySub}>房间 {item.roomCode} · 对局ID {item.gameId}</Text>
                      {item.medals && item.medals.length > 0 && (
                        <View style={styles.medalGridCompact}>
                          {item.medals.slice(0, 4).map((medal, idx) => (
                            <MedalChip key={`history-medal-${item.gameId}-${idx}`} medal={medal} onPress={showMedalDetail} compact />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <View style={styles.historyPagerRow}>
                <TouchableOpacity
                  style={[styles.buttonAlt, historyPage <= 1 && styles.centerButtonDisabled]}
                  onPress={() => historyPage > 1 && openHistory(historyPage - 1)}
                  disabled={historyPage <= 1}
                >
                  <Text style={styles.buttonText}>上一页</Text>
                </TouchableOpacity>
                <Text style={styles.historyPageText}>第 {historyPage} 页</Text>
                <TouchableOpacity
                  style={[styles.buttonAlt, historyList.length < 10 && styles.centerButtonDisabled]}
                  onPress={() => historyList.length === 10 && openHistory(historyPage + 1)}
                  disabled={historyList.length < 10}
                >
                  <Text style={styles.buttonText}>下一页</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.buttonAlt} onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.buttonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showHistoryDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHistoryDetailModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.largeModalCard, styles.historyDetailModalCard]}>
              <View style={styles.historyDetailHeader}>
                <TouchableOpacity
                  style={styles.buttonAlt}
                  onPress={() => {
                    setShowHistoryDetailModal(false);
                    setShowHistoryModal(true);
                  }}
                >
                  <Text style={styles.buttonText}>返回</Text>
                </TouchableOpacity>
                <Text style={styles.section}>对局详情</Text>
                <View style={styles.historyDetailHeaderSpacer} />
              </View>
              {historyDetailDecorated && historyDetailDecorated.detail ? (
                <ScrollView style={styles.historyListWrap}>
                  <View style={styles.cardInner}>
                    <View style={styles.historyDetailTopRow}>
                      <RoleSprite role={historyDetailDecorated.myRole} size={52} />
                      <View style={styles.historyDetailTopMeta}>
                        <View style={styles.historyDetailTopTitleRow}>
                          <Text style={styles.historyDetailRoleName}>{historyDetailDecorated.myRole || '未知身份'}</Text>
                          <Text
                            style={[
                              styles.historyResultBadge,
                              historyDetailDecorated.myResult === 'win' ? styles.historyResultWin : styles.historyResultLose,
                            ]}
                          >
                            {historyDetailDecorated.myResult === 'win' ? '胜利' : '失败'}
                          </Text>
                        </View>
                        <Text style={styles.historySub}>时间：{fmtTs(historyDetailDecorated.detail.endedAt)}</Text>
                        <Text style={styles.historySub}>
                          房间号：{historyDetailDecorated.detail.roomCode} · {historyDetailDecorated.detail.maxPlayers}人 · 座位 {historyDetailDecorated.mySeat || '-'}
                        </Text>
                      </View>
                    </View>
                    {historyDetailDecorated.medals && historyDetailDecorated.medals.length > 0 && (
                      <View style={styles.historyDetailMedalBlock}>
                        <Text style={styles.section}>本局勋章</Text>
                        <View style={styles.medalGrid}>
                          {historyDetailDecorated.medals.map((medal, idx) => (
                            <MedalChip key={`detail-medal-${idx}`} medal={medal} onPress={showMedalDetail} compact />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardInner}>
                    <Text style={styles.section}>圆桌详情</Text>
                    <View style={styles.historyRoundWrap}>
                    <View style={styles.historyRoundTable}>
                      <View style={styles.historyRoundCenterResult} pointerEvents="none">
                        <Text
                          style={[
                            styles.historyRoundCenterResultText,
                            historyDetailDecorated.detail.winner === 'good' && styles.winGood,
                            historyDetailDecorated.detail.winner === 'evil' && styles.winEvil,
                          ]}
                        >
                          {historyDetailDecorated.detail.winner === 'good'
                            ? '好人胜利'
                            : historyDetailDecorated.detail.winner === 'evil'
                              ? '坏人胜利'
                              : '结果未记录'}
                        </Text>
                      </View>
                      {historyDetailPlayers(historyDetailDecorated.detail).map((p) => {
                        const idx = Math.max(0, (p.seat || 1) - 1);
                        const n = Math.max(5, historyDetailDecorated.detail.maxPlayers || 7);
                        const seatSize = 76;
                        const radius = 112;
                        const cx = 146;
                        const cy = 146;
                        const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
                        const left = cx + radius * Math.cos(angle) - seatSize / 2;
                        const top = cy + radius * Math.sin(angle) - seatSize / 2;
                        const isAssassinatedHistory =
                          historyDetailDecorated.detail.assassination && historyDetailDecorated.detail.assassination.targetId === p.id;
                        return (
                          <View
                            key={`h-seat-${p.id}`}
                            style={[
                              styles.historySeatNode,
                              { left, top, width: seatSize, height: seatSize },
                              isAssassinatedHistory && styles.historySeatNodeAssassinated,
                            ]}
                          >
                            <View style={styles.historySeatNumberWrap} pointerEvents="none">
                              <Text style={styles.historySeatNumberBg}>{p.seat}</Text>
                            </View>
                            <Text style={[styles.historySeatNodeName, isAssassinatedHistory && styles.historySeatNodeNameDead]} numberOfLines={1}>
                              {p.nickname}
                            </Text>
                            {isAssassinatedHistory ? (
                              <View style={styles.historySeatSlashWrap}>
                                <View style={styles.historySeatSlashLine} />
                                <View style={[styles.historySeatSlashLine, styles.historySeatSlashLineMid]} />
                                <View style={styles.historySeatSlashLine} />
                              </View>
                            ) : null}
                            <View style={[styles.roleTag, { backgroundColor: roleTagColor(p.role), marginTop: 2 }]}>
                              <RoleBadgeContent role={p.role} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  </View>
                  <View style={[styles.cardInner, styles.historyTaskSectionCard]}>
                    <Text style={[styles.section, styles.historyTaskSectionTitle]}>任务详情</Text>
                    <View style={[styles.table, styles.historyDetailTaskTable]}>
                      <View style={styles.tableRowHead}>
                        <Text style={[styles.tableCell, styles.colRound]}>轮次</Text>
                        <Text style={[styles.tableCell, styles.historyColLeader]}>队长</Text>
                        <Text style={[styles.tableCell, styles.colTeam]}>队伍</Text>
                        <Text style={[styles.tableCell, styles.historyColVote]}>同意/反对</Text>
                        <Text style={[styles.tableCell, styles.historyColResult]}>结果</Text>
                      </View>
                      {historyTaskRows(historyDetailDecorated.detail).map((row, idx) => {
                        const missionSeats = row.mission
                          ? ((row.mission.team || [])
                              .map((id) => detailSeat(historyDetailDecorated.detail, id))
                              .sort((a, b) => a - b)
                              .join(','))
                          : '';
                        const approvesText = (row.approveSeats || []).join(',');
                        const rejectsText = (row.rejectSeats || []).join(',');
                        const resultText = row.approved
                          ? row.mission
                            ? row.mission.success
                              ? `✅ ${row.mission.fails || 0}`
                              : `❌ ${row.mission.fails || 0}`
                            : '执行中'
                          : '-';
                        const isFail = row.approved && row.mission ? !row.mission.success : false;
                        const isSuccess = row.approved && row.mission ? !!row.mission.success : false;
                        return (
                          <View key={`hrow-${idx}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.colRound]}>{row.round}-{row.attempt}</Text>
                            <Text style={[styles.tableCell, styles.historyColLeader]}>{row.leaderSeat}</Text>
                            <Text style={[styles.tableCell, styles.historyColTeam]}>{row.teamSeats.join(',') || missionSeats || '-'}</Text>
                            <Text style={[styles.tableCell, styles.historyColVote]}>
                              {approvesText || '-'} / <Text style={styles.voteReject}>{rejectsText || '-'}</Text>
                            </Text>
                            <Text
                              style={[
                                styles.tableCell,
                                styles.historyColResult,
                                isFail && styles.resultFail,
                                isSuccess && styles.resultSuccess,
                              ]}
                            >
                              {resultText}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.label}>暂无详情</Text>
              )}
              <TouchableOpacity style={styles.buttonAlt} onPress={() => setShowHistoryDetailModal(false)}>
                <Text style={styles.buttonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showStatsModal} transparent animationType="slide" onRequestClose={() => setShowStatsModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.largeModalCard, styles.statsModalCard]}>
              {roleStatsDecorated ? (
                <ScrollView style={styles.historyListWrap} contentContainerStyle={styles.statsScrollContent}>
                  <View style={styles.statsSummaryRow}>
                    <View style={styles.statsSummaryBox}>
                      <Text style={[styles.statsSummaryValue, styles.statsSummaryBlue]}>{roleStatsDecorated.totalGames}</Text>
                      <Text style={styles.statsSummaryLabel}>对局</Text>
                    </View>
                    <View style={styles.statsSummaryBox}>
                      <Text style={[styles.statsSummaryValue, styles.statsSummaryGreen]}>{roleStatsDecorated.overallWinRate}%</Text>
                      <Text style={styles.statsSummaryLabel}>胜率</Text>
                    </View>
                  </View>
                  <View style={styles.statsGrid}>
                    {roleStatsRowsComplete(roleStatsDecorated).map((row) => (
                      <View key={`s-${row.role}`} style={styles.statsRoleCard}>
                        <RoleSprite role={row.role} size={72} />
                        <Text style={[styles.statsRoleName, { color: roleNameColor(row.role) }]} numberOfLines={1}>
                          {row.role}
                        </Text>
                        <Text style={styles.statsRoleMeta}>对局 {row.total}</Text>
                        <Text style={styles.statsRoleMeta}>
                          胜率 <Text style={{ color: rateColor(row.winRate) }}>{row.winRate}%</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.cardInner}>
                    <Text style={styles.section}>勋章</Text>
                    <View style={styles.medalGridStats}>
                      {(roleStatsDecorated.medals || []).map((medal, idx) => (
                        <MedalChip key={`stats-medal-${idx}`} medal={medal} onPress={showMedalDetail} compact />
                      ))}
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.label}>暂无统计数据</Text>
              )}
              <TouchableOpacity style={styles.buttonAlt} onPress={() => setShowStatsModal(false)}>
                <Text style={styles.buttonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {room && (
          <View style={styles.gameShell}>
            {errorText ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}
            {showRoleInfo && roleInfo && (
              <View style={[styles.cardInner, styles.roleInfoModalCard]}>
                <View style={styles.roleHeroWrap}>
                  <RoleSprite role={roleInfo.role} size={112} />
                  <View style={styles.roleHeroTextWrap}>
                    <Text style={styles.roleHeroTitle}>{roleInfo.role}</Text>
                    <Text style={styles.roleHeroSub}>{ROLE_LABELS[roleInfo.role] || '角色'}</Text>
                    <View style={styles.roleHeroMeRow}>
                      <View style={[styles.roleSeatBadge, styles.roleHeroMeBadge]}>
                        <Text style={styles.roleSeatBadgeText}>{seatNo(clientId).replace('#', '')}</Text>
                      </View>
                      <Text style={styles.roleSeatName}>{room.players.find((p) => p.id === clientId)?.nickname || nickname}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.roleInfoSectionCard}>
                  <Text style={styles.roleInfoSectionTitle}>可见座位</Text>
                  {roleVisibleSeatRows().length > 0 ? (
                    roleVisibleSeatRows().map((item) => (
                      <View key={`vis-${item.seat}`} style={styles.roleSeatRow}>
                        <View style={styles.roleSeatBadge}>
                          <Text style={styles.roleSeatBadgeText}>{item.seat}</Text>
                        </View>
                        <Text style={styles.roleSeatName}>{item.nickname}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.label}>无可见座位号</Text>
                  )}
                </View>

                {evilReveal && (
                  <View style={styles.roleInfoSectionCard}>
                    <Text style={styles.roleInfoSectionTitle}>坏人同伴身份（亮明）</Text>
                    {Object.entries(evilReveal).map(([id, role]) => {
                      const player = room && room.players ? room.players.find((p) => p.id === id) : null;
                      return (
                        <View key={`evil-${id}`} style={styles.roleSeatRow}>
                          <View style={styles.roleSeatBadge}>
                            <Text style={styles.roleSeatBadgeText}>{seatNo(id).replace('#', '')}</Text>
                          </View>
                          <Text style={styles.roleSeatName}>{player ? player.nickname : '未知'}</Text>
                          <View style={[styles.roleTag, { backgroundColor: roleTagColor(role), marginTop: 0, marginLeft: 'auto' }]}>
                            <RoleBadgeContent role={role} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {isAssassin && room.game && room.game.phase !== 'end' && (
                  <View style={styles.roleInfoSectionCard}>
                    <Text style={styles.roleInfoSectionTitle}>刺杀操作（仅刺客）</Text>
                    {room.game.phase !== 'assassination' && (
                      <TouchableOpacity style={styles.buttonAlt} onPress={startAssassination}>
                        <Text style={styles.buttonText}>翻牌刺杀</Text>
                      </TouchableOpacity>
                    )}
                    {room.game.phase === 'assassination' && (
                      <>
                        <Text style={styles.label}>请在圆桌点选目标</Text>
                        <Text style={styles.label}>已选：{selectedAssassinate ? seatNo(selectedAssassinate) : '未选择'}</Text>
                        <TouchableOpacity
                          style={[styles.button, !selectedAssassinate && styles.centerButtonDisabled]}
                          onPress={() => selectedAssassinate && assassinate(selectedAssassinate)}
                          disabled={!selectedAssassinate}
                        >
                          <Text style={styles.buttonText}>刺杀</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
                {isHost && room.started ? (
                  <TouchableOpacity style={styles.buttonAlt} onPress={redealIdentities}>
                    <Text style={styles.buttonText}>重发身份</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            <View
              style={styles.roundTable}
              onLayout={(e) => setTableSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            >
              <View style={styles.tableTextureOuter} pointerEvents="none" />
              <View style={styles.tableTextureInner} pointerEvents="none" />
              <View style={styles.tableTextureCross} pointerEvents="none" />
              {Array.from({ length: room.maxPlayers }).map((_, idx) => {
                const playerId = room.seats[idx];
                const player = room.players.find((p) => p.id === playerId);
                const me = playerId === clientId;
                const isOffline = !!(player && player.offline);
                const leaderSeatIndex = room.game ? room.seats.findIndex((id) => id === room.game.leaderId) : -1;
                const seatSize = 86;
                const centerX = tableSize.w / 2;
                const centerY = tableSize.h / 2;
                const radius = Math.max(0, Math.min(centerX, centerY) - seatSize / 2 - 6);
                const angle = (2 * Math.PI * idx) / room.maxPlayers - Math.PI / 2;
                const left = centerX + radius * Math.cos(angle) - seatSize / 2;
                const top = centerY + radius * Math.sin(angle) - seatSize / 2;
                const revealedRole = room.game && room.game.revealedRoles ? room.game.revealedRoles[playerId] : null;
                const revealedEvilRole = room.game && room.game.revealedEvil ? room.game.revealedEvil[playerId] : null;
                const isLadyHolderSeat = !!(ladyOfLake && ladyOfLake.holderId === playerId);
                const isEvil = revealedRole && ROLE_LABELS[revealedRole] && ROLE_LABELS[revealedRole].includes('坏人');
                const isAssassinated =
                  room.game && room.game.assassination && room.game.assassination.targetId === playerId;
                let seatActionStatus = '';
                let seatActionDone = false;
                if (room.game && room.game.phase === 'speaking' && playerId) {
                  const speakingPlayerId = room.speaking ? room.seats[room.speaking.index] : null;
                  if (speakingPlayerId === playerId) {
                    seatActionStatus = '发言中';
                    seatActionDone = false;
                  }
                } else if (room.game && room.game.phase === 'voting' && playerId) {
                  seatActionStatus = room.game.votes && room.game.votes[playerId] !== undefined ? '已投票' : '投票中';
                  seatActionDone = room.game.votes && room.game.votes[playerId] !== undefined;
                } else if (room.game && room.game.phase === 'mission' && playerId && room.game.team && room.game.team.includes(playerId)) {
                  seatActionStatus =
                    room.game.missionVotes && room.game.missionVotes[playerId] !== undefined ? '出征完毕' : '出征中';
                  seatActionDone = room.game.missionVotes && room.game.missionVotes[playerId] !== undefined;
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.seatRound,
                      { width: seatSize, height: seatSize, left, top },
                      isAssassinated && styles.seatAssassinated,
                      phase === 'assassination' && isAssassin && selectedAssassinate === playerId && styles.seatAssassinateSelected,
                      displayTeam.includes(playerId) && styles.seatTeamSelected,
                      me && styles.seatMe,
                    ]}
                    onPress={() => {
                      if (!room.started) return chooseSeat(idx);
                      if ((phase === 'team' || phase === 'speaking') && isLeader && playerId) return toggleTeamMember(playerId);
                      if (phase === 'lady' && isLadyHolder && playerId && ladyEligibleTargets.includes(playerId)) return useLadyOfLake(playerId);
                      if (phase === 'assassination' && isAssassin && playerId) return setSelectedAssassinate(playerId);
                    }}
                  >
                    {leaderSeatIndex === idx && <Text style={styles.crown}>👑</Text>}
                    {isLadyHolderSeat && <Text style={styles.ladyBadge}>🧝</Text>}
                    <View style={styles.seatNumberWrap} pointerEvents="none">
                      <Text style={styles.seatNumberBg}>{idx + 1}</Text>
                    </View>
                    <View style={styles.nameWrap}>
                      <Text style={styles.seatName}>
                        {player ? `${player.nickname}` : '空'}
                      </Text>
                      {isOffline ? (
                        <Text style={styles.seatOffline}>离线</Text>
                      ) : (
                        !!seatActionStatus && (
                        <Text style={[styles.seatActionStatus, seatActionDone ? styles.seatActionStatusDone : styles.seatActionStatusPending]}>
                          {seatActionStatus}
                        </Text>
                        )
                      )}
                    </View>
                    {isAssassinated && (
                      <View pointerEvents="none" style={styles.killOverlayWrap}>
                        <Image source={UI_ICON_KILL} style={styles.killOverlayIcon} resizeMode="contain" />
                      </View>
                    )}
                    {revealedRole && (
                      <View style={[styles.roleTag, { backgroundColor: roleTagColor(revealedRole) }]}>
                        <RoleBadgeContent role={revealedRole} />
                      </View>
                    )}
                    {!revealedRole && revealedEvilRole && (
                      <View style={[styles.roleTag, { backgroundColor: roleTagColor(revealedEvilRole) }]}>
                        <RoleBadgeContent role={revealedEvilRole} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {isLeader && (phase === 'team' || phase === 'speaking') && (
                <View style={styles.centerButtonWrap} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[styles.centerButton, selectedTeam.length !== teamSize && styles.centerButtonDisabled]}
                    onPress={handleLeaderTeamAction}
                    disabled={selectedTeam.length !== teamSize}
                  >
                    <Text style={styles.buttonText}>{leaderTeamButtonText()}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {phase === 'assassination' && isAssassin && (
                <View style={styles.centerButtonWrap} pointerEvents="box-none">
                  <View style={styles.assassinateCenterPanel}>
                    <TouchableOpacity
                      style={[styles.centerButton, !selectedAssassinate && styles.centerButtonDisabled]}
                      onPress={() => selectedAssassinate && assassinate(selectedAssassinate)}
                      disabled={!selectedAssassinate}
                    >
                      <Text style={styles.buttonText}>
                        {selectedAssassinate ? `刺杀：${seatNo(selectedAssassinate).replace('#', '')}号` : '选择刺杀对象'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {room.game && room.game.revealedRoles && (
                <View style={styles.centerResult}>
                  <View style={styles.centerResultCard}>
                    <Text style={styles.resultText}>游戏结束</Text>
                    <Text
                      style={[
                        styles.resultTextSmall,
                        room.game.winner === 'good' && styles.winGood,
                        room.game.winner === 'evil' && styles.winEvil,
                      ]}
                    >
                      {room.game.winner === 'good' ? '好人胜利' : room.game.winner === 'evil' ? '坏人胜利' : '结果已判定'}
                    </Text>
                    {isHost && (
                      <TouchableOpacity style={styles.resultButton} onPress={resetGame}>
                        <Text style={styles.resultButtonText}>再来一局</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {room.started && room.game && (
              <>
                <Text style={styles.section}>任务详情</Text>
                <View style={styles.missionRow}>
                  {missionMatrix(room.maxPlayers).sizes.map((s, i) => {
                    const needFail = missionMatrix(room.maxPlayers).fails[i];
                    const round = i + 1;
                    const mission = missionMapByRound()[round];
                    const isCurrent = room.game.round === round && room.game.phase !== 'end';
                    const isSuccess = mission ? mission.success : null;
                    return (
                      <View
                        key={`req-${i}`}
                        style={[
                          styles.missionPill,
                          isSuccess === true && styles.missionPillSuccess,
                          isSuccess === false && styles.missionPillFail,
                          isCurrent && styles.missionPillCurrent,
                        ]}
                      >
                        <Text style={[styles.missionSize, needFail === 2 && styles.missionSizeUnderline]}>{s}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.table}>
                  <View style={styles.tableRowHead}>
                    <Text style={[styles.tableCell, styles.colRound]}>轮次</Text>
                    <Text style={[styles.tableCell, styles.colLeader]}>队长</Text>
                    <Text style={[styles.tableCell, styles.colTeam]}>队伍</Text>
                    <Text style={[styles.tableCell, styles.colVote]}>同意/反对</Text>
                    <Text style={[styles.tableCell, styles.colResult]}>结果</Text>
                  </View>
                  {(() => {
                    const counts = {};
                    const rows = (room.game.voteHistory || []).map((v, idx) => {
                      counts[v.round] = (counts[v.round] || 0) + 1;
                      return { ...v, _idx: idx, _attempt: v.attempt || counts[v.round] };
                    });
                    rows.sort((a, b) => {
                      if ((b.round || 0) !== (a.round || 0)) return (b.round || 0) - (a.round || 0);
                      if ((b._attempt || 0) !== (a._attempt || 0)) return (b._attempt || 0) - (a._attempt || 0);
                      return (b._idx || 0) - (a._idx || 0);
                    });
                    return rows.map((v, idx) => {
                      const attempt = v._attempt;
                      const approves = Object.entries(v.votes || {})
                        .filter(([, a]) => a)
                        .map(([pid]) => seatNo(pid).replace('#', ''))
                        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                        .join(',');
                      const rejects = Object.entries(v.votes || {})
                        .filter(([, a]) => !a)
                        .map(([pid]) => seatNo(pid).replace('#', ''))
                        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                        .join(',');
                      const missionByRound = missionMapByRound();
                      const m = v.approved ? missionByRound[v.round] : null;
                      const resultText = v.approved
                        ? m
                          ? m.success
                            ? `✅ ${m.fails}`
                            : `❌ ${m.fails}`
                          : '执行中'
                        : '-';
                      const isFail = v.approved && m ? !m.success : false;
                      const isSuccess = v.approved && m ? m.success : false;
                      return (
                        <View key={`row-${idx}`} style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.colRound]}>{v.round}-{attempt}</Text>
                          <Text style={[styles.tableCell, styles.colLeader]}>{seatNo(v.leaderId).replace('#', '')}</Text>
                          <Text style={[styles.tableCell, styles.colTeam]}>
                            {v.team
                              .map((id) => seatNo(id).replace('#', ''))
                              .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                              .join(',')}
                          </Text>
                          <Text style={[styles.tableCell, styles.colVote]}>
                            {approves || '-'} / <Text style={styles.voteReject}>{rejects || '-'}</Text>
                          </Text>
                          <Text
                            style={[
                              styles.tableCell,
                              styles.colResult,
                              isFail && styles.resultFail,
                              isSuccess && styles.resultSuccess,
                            ]}
                          >
                            {resultText}
                          </Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              </>
            )}

            {isHost && !room.started && (
              <View style={styles.cardInner}>
                <Text style={styles.section}>房间设置(房主)</Text>
                <View style={styles.pickGrid}>
                  {[5, 6, 7, 8, 9, 10].map((n) => (
                    <TouchableOpacity
                      key={`mp-${n}`}
                      style={[styles.pickItem, String(n) === maxPlayers && styles.pickItemActive]}
                      onPress={() => updateSettings({ maxPlayers: n })}
                    >
                      <Text style={styles.pickText}>{n} 人</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {false && showRoleConfig && (
                  <View style={styles.cardInner}>
                    <Text style={styles.label}>推荐配置: {suggestedRolesLabel(parseInt(maxPlayers, 10))}</Text>
                    <Text style={styles.label}>当前配置(可编辑):</Text>
                    <TextInput
                      style={styles.input}
                      value={rolesText}
                      onChangeText={setRolesText}
                      placeholder="角色列表(用逗号分隔)"
                    />
                    <RoleTags roles={rolesFromText()} />
                  </View>
                )}
                <View style={styles.tags}>
                  <TouchableOpacity
                    style={[styles.tag, hostRole === '随机' && styles.tagActive]}
                    onPress={() => updateSettings({ hostRole: '随机' })}
                  >
                    <View style={styles.hostRoleTagRow}>
                      <Text style={styles.hostRoleThumbFallback}>🎲</Text>
                      <Text style={styles.tagText}>随机</Text>
                    </View>
                  </TouchableOpacity>
                  {uniqueRoles().map((r) => (
                    <TouchableOpacity
                      key={`hr-${r}`}
                      style={[styles.tag, hostRole === r && styles.tagActive]}
                      onPress={() => updateSettings({ hostRole: r })}
                    >
                      <View style={styles.hostRoleTagRow}>
                        <RoleTagThumb role={r} />
                        <Text style={styles.tagText}>{r}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.cardInner}>
                  <Text style={styles.label}>扩展玩法</Text>
                  <View style={styles.tags}>
                    <TouchableOpacity
                      style={[styles.tag, !ladyOfLakeEnabled && styles.tagActive, parseInt(maxPlayers, 10) < 8 && styles.centerButtonDisabled]}
                      onPress={() => parseInt(maxPlayers, 10) >= 8 && updateSettings({ ladyOfLakeEnabled: false })}
                      disabled={parseInt(maxPlayers, 10) < 8}
                    >
                      <Text style={styles.tagText}>标准局</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tag, ladyOfLakeEnabled && styles.tagActive, parseInt(maxPlayers, 10) < 8 && styles.centerButtonDisabled]}
                      onPress={() => parseInt(maxPlayers, 10) >= 8 && updateSettings({ ladyOfLakeEnabled: true })}
                      disabled={parseInt(maxPlayers, 10) < 8}
                    >
                      <Text style={styles.tagText}>湖中仙女</Text>
                    </TouchableOpacity>
                  </View>
                  {parseInt(maxPlayers, 10) < 8 && <Text style={styles.label}>湖中仙女仅支持 8 人及以上对局</Text>}
                </View>
                <TouchableOpacity style={[styles.button, styles.startGameButtonSpacing]} onPress={startGame}>
                  <Text style={styles.buttonText}>开始游戏</Text>
                </TouchableOpacity>
              </View>
            )}

            {room.started && phase === 'speaking' && (
              <View style={[styles.cardInner, styles.speakingPhaseCard]}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.speakingPhaseBgFill,
                    { width: `${speakingProgress * 100}%` },
                    speakingRemainingSec <= 30 && styles.speakingPhaseBgFillDanger,
                  ]}
                />
                <View style={styles.speakingPhaseContent}>
                  <Text style={styles.section}>
                    当前发言：{room.speaking?.index + 1}号，{room.players.find((p) => p.id === room.seats[room.speaking?.index])?.nickname || '未知'}
                  </Text>
                  <View style={styles.speakingTimerWrap}>
                    <Text style={[styles.speakingTimerText, speakingRemainingSec <= 30 && styles.speakingTimerTextDanger]}>
                      剩余时间: {speakingRemainingSec}s
                    </Text>
                  </View>
                  {isMyTurn ? (
                    <>
                      <TextInput
                        style={styles.input}
                        value={speakText}
                        onChangeText={setSpeakText}
                        placeholder="输入发言内容"
                      />
                      <View style={styles.row}>
                        <TouchableOpacity style={styles.button} onPress={speak}>
                          <Text style={styles.buttonText}>发送发言</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.buttonAlt} onPress={endSpeak}>
                          <Text style={styles.buttonText}>发言完毕</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.label}>等待轮到你发言</Text>
                  )}
                </View>
              </View>
            )}

            {room.started && phase === 'lady' && (
              <View style={styles.cardInner}>
                <Text style={styles.section}>验人阶段</Text>
                <Text style={styles.label}>
                  当前操作玩家：{ladyOfLake && ladyOfLake.holderId ? `${seatNo(ladyOfLake.holderId)} ${room.players.find((p) => p.id === ladyOfLake.holderId)?.nickname || ''}` : '未知'}
                </Text>
                <Text style={styles.label}>当前操作玩家要查看 1 名玩家是好人还是坏人。验完后，下一轮由被查看的人继续验人。</Text>
                {ladyHistoryRows().length > 0 && (
                  <View style={styles.cardInner}>
                    <Text style={styles.label}>之前是谁验了谁</Text>
                    {ladyHistoryRows().map((item, idx) => (
                      <Text key={`lady-history-${idx}`} style={styles.label}>
                        第 {item.round} 轮：{item.holderName} 验了 {item.targetName}
                      </Text>
                    ))}
                  </View>
                )}
                {isLadyHolder && !isSpectator ? (
                  <Text style={styles.label}>请直接点击圆桌上的目标玩家进行验人。</Text>
                ) : (
                  <Text style={styles.label}>等待当前操作玩家选择目标</Text>
                )}
              </View>
            )}

            {room.game && (
              <View style={styles.cardInner}>
                <Text style={styles.section}>发言记录（按回合）</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.buttonAlt}
                    onPress={() => {
                      if (speakIndex <= 0) return;
                      setSpeakRoundView(speakKeys[speakIndex - 1]);
                    }}
                  >
                    <Text style={styles.buttonText}>上一轮</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.buttonAlt}
                    onPress={() => {
                      if (speakIndex < 0 || speakIndex >= speakKeys.length - 1) return;
                      setSpeakRoundView(speakKeys[speakIndex + 1]);
                    }}
                  >
                    <Text style={styles.buttonText}>下一轮</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>当前查看：第 {speakRoundView} 轮</Text>
                {(room.game.speakHistory && room.game.speakHistory[speakRoundView]
                  ? room.game.speakHistory[speakRoundView]
                  : []
                ).length === 0 && <Text style={styles.label}>暂无发言</Text>}
                {(room.game.speakHistory && room.game.speakHistory[speakRoundView] ? room.game.speakHistory[speakRoundView] : []).map(
                  (m, idx) => {
                    const player = room.players.find((p) => p.nickname === m.from);
                    const seat = player ? seatNo(player.id).replace('#', '') : '?';
                    const isMeSpeaker = player && player.id === clientId;
                    return (
                      <View key={`sp-${idx}`} style={[styles.speakRow, isMeSpeaker && styles.speakRowMe]}>
                        <View style={[styles.speakLine, isMeSpeaker && styles.speakLineMe]}>
                          {!isMeSpeaker && (
                            <View style={styles.speakAvatarBox}>
                              <Text style={styles.speakAvatarSeat}>#{seat}</Text>
                              <Text style={styles.speakAvatarName}>{m.from}</Text>
                            </View>
                          )}
                          {isMeSpeaker && (
                            <View style={[styles.speakAvatarBox, styles.speakAvatarBoxMe]}>
                              <Text style={styles.speakAvatarSeat}>#{seat}</Text>
                              <Text style={styles.speakAvatarName}>{m.from}</Text>
                            </View>
                          )}
                          <View style={[styles.speakBubble, isMeSpeaker && styles.speakBubbleMe]}>
                            <Text style={[styles.speakBody, isMeSpeaker && styles.speakBodyMe]}>{m.text}</Text>
                            <View style={[styles.speakTail, isMeSpeaker && styles.speakTailMe]} />
                          </View>
                        </View>
                      </View>
                    );
                  }
                )}
                {room.game.recap && room.game.recap.length > 0 && (
                  <View style={styles.cardInner}>
                    <Text style={styles.section}>复盘（AI观点）</Text>
                    {room.game.recap.map((r) => (
                      <View key={`recap-${r.id}`} style={styles.speakRow}>
                        <View style={styles.speakBubbleWide}>
                          <Text style={styles.speakHeaderInline}>
                            #{r.seat} {r.nickname}{r.info ? `（${r.info.role}）` : ''}
                          </Text>
                          {r.info && (
                            <View style={styles.recapTagRow}>
                              <View style={styles.recapTag}>
                                <Text style={styles.recapTagText}>已知</Text>
                              </View>
                              <Text style={styles.recapTagValue}>
                                {(() => {
                                  if (r.info.role === '派西维尔') return `拇指位：${r.info.seats && r.info.seats.length ? r.info.seats.join('，') : '暂无'}`;
                                  if (r.info.role === '梅林') return `坏人位：${r.info.seats && r.info.seats.length ? r.info.seats.join('，') : '暂无'}`;
                                  if (r.info.role === '奥伯伦') return '同伴：无';
                                  if (r.info.role && r.info.role.includes('坏人')) {
                                    return `同伴位：${r.info.seats && r.info.seats.length ? r.info.seats.join('，') : '暂无'}`;
                                  }
                                  return '信息：无';
                                })()}
                              </Text>
                            </View>
                          )}
                          {r.merlin && (
                            <>
                              <Text style={styles.speakBody}>坏人位：{(r.merlin.evilSeats || []).join('，') || '暂无'}</Text>
                              <Text style={styles.speakBody}>莫德雷德猜测：{r.merlin.guessMordredSeat || '暂无'}</Text>
                              <Text style={styles.speakBody}>复盘：{r.reason}</Text>
                            </>
                          )}
                          {r.percival && (
                            <>
                              <Text style={styles.speakBody}>梅林猜测：{r.percival.guessMerlinSeat || '暂无'}</Text>
                              <Text style={styles.speakBody}>莫甘娜猜测：{r.percival.guessMorganaSeat || '暂无'}</Text>
                              <Text style={styles.speakBody}>复盘：{r.reason}</Text>
                            </>
                          )}
                          {r.evil && (
                            <>
                              <Text style={styles.speakBody}>队友身份：{(r.evil.teammateRoles || []).map((t) => `${t.seat}:${t.role}`).join('，') || '暂无'}</Text>
                              <Text style={styles.speakBody}>梅林猜测：{r.evil.guessMerlinSeat || '暂无'}</Text>
                              <Text style={styles.speakBody}>复盘：{r.reason}</Text>
                            </>
                          )}
                          {r.loyal && (
                            <>
                              <Text style={styles.speakBody}>怀疑位：{(r.loyal.suspicious || []).join('，') || '暂无'}</Text>
                              <Text style={styles.speakBody}>梅林猜测：{r.loyal.guessMerlinSeat || '暂无'}</Text>
                              <Text style={styles.speakBody}>复盘：{r.reason}</Text>
                            </>
                          )}
                          {r.review && (
                            <View style={styles.recapReviewBlock}>
                              <Text style={styles.recapReviewTitle}>行为复盘</Text>
                              {r.review.overview ? <Text style={styles.speakBody}>总览：{r.review.overview}</Text> : null}
                              {r.review.speak ? <Text style={styles.speakBody}>发言：{r.review.speak.thought} 调整：{r.review.speak.adjustment}</Text> : null}
                              {r.review.team ? <Text style={styles.speakBody}>组队：{r.review.team.thought} 调整：{r.review.team.adjustment}</Text> : null}
                              {r.review.vote ? <Text style={styles.speakBody}>投票：{r.review.vote.thought} 调整：{r.review.vote.adjustment}</Text> : null}
                              {r.review.mission ? <Text style={styles.speakBody}>任务：{r.review.mission.thought} 调整：{r.review.mission.adjustment}</Text> : null}
                              {r.review.assassination && (r.review.assassination.thought || r.review.assassination.adjustment) ? (
                                <Text style={styles.speakBody}>刺杀：{r.review.assassination.thought} 调整：{r.review.assassination.adjustment}</Text>
                              ) : null}
                              {r.review.nextGamePlan ? <Text style={styles.speakBody}>下局计划：{r.review.nextGamePlan}</Text> : null}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                    {room.game.assassination && (
                      <View style={styles.speakRow}>
                        <View style={styles.speakBubbleWide}>
                          <Text style={styles.speakHeaderInline}>刺杀复盘</Text>
                          <Text style={styles.speakBody}>
                            候选：{(room.game.assassination.candidateSeats || []).join('，') || '暂无'}
                          </Text>
                          <Text style={styles.speakBody}>
                            选择：{room.game.assassination && room.game.assassination.targetId ? seatNo(room.game.assassination.targetId).replace('#', '') : '暂无'}
                          </Text>
                          <Text style={styles.speakBody}>
                            实际梅林：{room.game.assassination.merlinSeat || '暂无'}
                          </Text>
                          {room.game.assassination.reasoning && (
                            <Text style={styles.speakBody}>刺杀理由：{room.game.assassination.reasoning}</Text>
                          )}
                          {room.game.evilIntel && room.game.evilIntel.length > 0 && (
                            <Text style={styles.speakBody}>
                              坏人交流：
                              {room.game.evilIntel
                                .map((e) => `#${e.seat}→${e.guessMerlinSeat || '暂无'}`)
                                .join('，')}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {room.started && room.game && (
              <>
                {room.game.phase === 'team' && (
                  <View style={styles.cardInner}>
                    <Text style={styles.label}>队伍选择请在圆桌上点选（选中变绿）</Text>
                    {isLeader ? (
                      <Text style={styles.label}>点圆桌成员后，点击中心按钮提交队伍</Text>
                    ) : (
                      <Text style={styles.label}>等待队长选择队伍</Text>
                    )}
                  </View>
                )}

                <Modal visible={room.game.phase === 'voting' && !myVoted && !isSpectator} transparent animationType="fade">
                  <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                      <Text style={styles.section}>投票提示</Text>
                      <View style={styles.voteTeamList}>
                        {teamDisplayRows(room.game.team).map((item) => (
                          <View key={`vote-team-${item.id}`} style={[styles.voteTeamRow, item.isMe && styles.voteTeamRowMe]}>
                            <View style={[styles.roleSeatBadge, item.isMe && styles.roleSeatBadgeMe]}>
                              <Text style={styles.roleSeatBadgeText}>{item.seat}</Text>
                            </View>
                            <Text style={[styles.voteTeamName, item.isMe && styles.voteTeamNameMe]}>{item.nickname}</Text>
                            {item.id === room.game.leaderId && <Text style={styles.voteLeaderTag}>队长</Text>}
                            {item.isMe && <Text style={styles.voteTeamMeTag}>你</Text>}
                          </View>
                        ))}
                      </View>
                      {!myVoted ? (
                        <View style={styles.row}>
                          <TouchableOpacity style={styles.button} onPress={() => voteTeam(true)}>
                            <Text style={styles.buttonText}>赞成</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.buttonAlt} onPress={() => voteTeam(false)}>
                            <Text style={styles.buttonText}>反对</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.label}>你已投票，等待其他玩家</Text>
                      )}
                    </View>
                  </View>
                </Modal>

                <Modal visible={room.game.phase === 'mission' && inTeam && !myMissionDone && !isSpectator} transparent animationType="fade">
                  <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                      <Text style={styles.section}>任务执行</Text>
                      <Text style={styles.label}>执行队伍</Text>
                      <View style={styles.voteTeamList}>
                        {teamDisplayRows(room.game.team).map((item) => (
                          <View key={`mission-team-${item.id}`} style={[styles.voteTeamRow, item.isMe && styles.voteTeamRowMe]}>
                            <View style={[styles.roleSeatBadge, item.isMe && styles.roleSeatBadgeMe]}>
                              <Text style={styles.roleSeatBadgeText}>{item.seat}</Text>
                            </View>
                            <Text style={[styles.voteTeamName, item.isMe && styles.voteTeamNameMe]}>{item.nickname}</Text>
                            {item.isMe && <Text style={styles.voteTeamMeTag}>你</Text>}
                          </View>
                        ))}
                      </View>
                      <View style={styles.row}>
                        <TouchableOpacity style={styles.button} onPress={() => executeMission(false)}>
                          <Text style={styles.buttonText}>执行成功</Text>
                        </TouchableOpacity>
                        {myRole && ROLE_LABELS[myRole] && ROLE_LABELS[myRole].includes('坏人') && (
                          <TouchableOpacity style={styles.buttonAlt} onPress={() => executeMission(true)}>
                            <Text style={styles.buttonText}>执行失败</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </Modal>
              </>
            )}

          </View>
        )}
      </ScrollView>
      {missionFx && (
        <View pointerEvents="none" style={styles.missionFxOverlay}>
          <Animated.View
            style={[
              styles.missionFxFullscreenTint,
              missionFx.success ? styles.missionFxFullscreenTintSuccess : styles.missionFxFullscreenTintFail,
              {
                opacity: missionFxOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.missionFxCard,
              {
                opacity: missionFxOpacity,
                transform: [{ scale: missionFxScale }],
              },
            ]}
          >
            <View style={[styles.missionFxCardScrim, missionFx.success ? styles.missionFxCardScrimSuccess : styles.missionFxCardScrimFail]}>
              <Image
                source={missionFx.success ? MISSION_SUCCESS_BG : MISSION_FAIL_BG}
                style={styles.missionFxCardArt}
                resizeMode="contain"
              />
              {!missionFx.success ? (
                <View style={styles.missionFxFailIconsRow}>
                  {Array.from({ length: Math.max(1, Number(missionFx.fails || 0)) }).map((_, idx) => (
                    <View key={`fail-icon-${idx}`} style={styles.missionFxFailIconWrap}>
                      <Image source={FAIL_VOTE_ICON} style={styles.missionFxFailIconImg} resizeMode="contain" />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      )}
      <Modal visible={!!selectedMedal} transparent animationType="fade" onRequestClose={() => setSelectedMedal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedMedal && (
              <>
                <View style={styles.medalModalHead}>
                  <MedalChip medal={selectedMedal} compact />
                  <Text style={styles.historyDetailRoleName}>{selectedMedal.name}</Text>
                </View>
                <Text style={styles.label}>{selectedMedal.description || '暂无说明'}</Text>
              </>
            )}
            <TouchableOpacity style={styles.buttonAlt} onPress={() => setSelectedMedal(null)}>
              <Text style={styles.buttonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#f5f5f5',
    fontFamily: CN_FONT,
    fontSize: 16,
  },
  scroll: {
    padding: 16,
    flexGrow: 1,
  },
  scrollHome: {
    justifyContent: 'flex-start',
  },
  homeBgFixed: {
    ...StyleSheet.absoluteFillObject,
  },
  homeBgImage: {
    resizeMode: 'cover',
    opacity: 0.96,
  },
  homeBgImageWeb: {
    opacity: 0.9,
  },
  inGameBgImage: {
    resizeMode: 'cover',
    opacity: 0.92,
  },
  inGameBgImageWeb: {
    opacity: 0.88,
  },
  webBgImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  webBgImageHome: {
    opacity: 0.9,
  },
  webBgImageGame: {
    opacity: 0.88,
  },
  homeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 12, 0.18)',
  },
  inGameOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 16, 0.42)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: CN_FONT,
    color: '#f5f5f5',
    marginBottom: 12,
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  authTopBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: '#3b5bdb',
    borderWidth: 2,
    borderColor: '#a9b8ff',
    shadowColor: '#0a0a0a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    maxWidth: 140,
  },
  authTopBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  roomCodeChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: 'rgba(214, 190, 129, 0.85)',
    backgroundColor: 'rgba(56, 39, 20, 0.72)',
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.9,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    maxWidth: 120,
  },
  roomCodeChipText: {
    color: '#f6e7c9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: CN_FONT,
  },
  viewRoleSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: '#3b5bdb',
    borderWidth: 2,
    borderColor: '#a9b8ff',
    shadowColor: '#0a0a0a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  viewRoleSmallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: CN_FONT,
  },
  card: {
    backgroundColor: 'rgba(23, 23, 33, 0.72)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  gameShell: {
    marginBottom: 12,
  },
  homeCard: {
    backgroundColor: 'rgba(23, 23, 33, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(220, 220, 235, 0.25)',
  },
  homePanelWrap: {
    flex: 1,
    justifyContent: 'center',
    width: '80%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  cardInner: {
    backgroundColor: 'rgba(31, 31, 43, 0.70)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(214, 221, 236, 0.12)',
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: CN_FONT,
    color: '#f0f0f0',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  label: {
    color: '#c9c9d4',
    marginBottom: 6,
    fontFamily: CN_FONT,
  },
  input: {
    backgroundColor: '#0f0f15',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    fontFamily: CN_FONT,
  },
  inputTextLike: {
    color: '#fff',
    fontFamily: CN_FONT,
    lineHeight: 20,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  roomEntryInput: {
    backgroundColor: 'rgba(15, 15, 21, 0.48)',
    color: '#fff',
    height: 96,
    fontSize: 34,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(220, 220, 235, 0.28)',
    fontFamily: CN_FONT,
  },
  button: {
    backgroundColor: '#3b5bdb',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 2,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a9b8ff',
    shadowColor: '#0a0a0a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  startGameButtonSpacing: {
    marginTop: 12,
  },
  buttonAlt: {
    backgroundColor: '#2f2f3f',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 2,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6d7694',
    shadowColor: '#0a0a0a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0.6,
    fontFamily: CN_FONT,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  authActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  authFeatureBtn: {
    flex: 1,
    minHeight: 52,
    marginBottom: 0,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#91a4ff',
    backgroundColor: 'rgba(45, 65, 156, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#0a0a0a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  authFeatureIconImg: {
    width: 18,
    height: 18,
  },
  authFeatureText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: CN_FONT,
    fontSize: 13,
  },
  authFeatureEmoji: {
    fontSize: 22,
  },
  errorBanner: {
    backgroundColor: '#3a1f1f',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  roundTable: {
    position: 'relative',
    height: 368,
    marginHorizontal: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#8b6a3a',
    padding: 8,
    backgroundColor: 'rgba(43, 31, 20, 0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  seatRound: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 58, 40, 0.74)',
    padding: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a67c3c',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  seatNumberWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNumberBg: {
    width: '100%',
    lineHeight: 86,
    margin: 0,
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 76,
    fontWeight: '900',
    letterSpacing: 0,
    color: 'rgba(246, 231, 201, 0.18)',
    includeFontPadding: false,
    transform: [{ translateY: 0 }],
    fontFamily: 'System',
  },
  seatTeamSelected: {
    backgroundColor: '#2f6b3e',
  },
  crown: {
    position: 'absolute',
    top: -10,
    fontSize: 14,
  },
  ladyBadge: {
    position: 'absolute',
    top: -10,
    right: 2,
    fontSize: 14,
  },
  centerButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assassinateCenterPanel: {
    alignItems: 'center',
    gap: 8,
  },
  assassinateCenterText: {
    color: '#f6e7c9',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: CN_FONT,
  },
  centerButton: {
    width: 140,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#3b5bdb',
    alignItems: 'center',
  },
  centerButtonDisabled: {
    backgroundColor: '#2b2b3b',
  },
  seatMe: {
    borderWidth: 2,
    borderColor: '#3b5bdb',
  },
  seatAssassinated: {
    borderWidth: 2,
    borderColor: '#b91c1c',
    backgroundColor: '#3a1414',
  },
  seatAssassinateSelected: {
    borderWidth: 2,
    borderColor: '#f87171',
    backgroundColor: 'rgba(127, 29, 29, 0.82)',
  },
  seatName: {
    color: '#f6e7c9',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0,
    margin: 0,
    padding: 0,
    includeFontPadding: false,
    fontFamily: CN_FONT,
  },
  seatActionStatus: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    fontFamily: CN_FONT,
  },
  seatActionStatusPending: {
    color: '#facc15',
  },
  seatActionStatusDone: {
    color: '#22c55e',
  },
  seatOffline: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#f87171',
    includeFontPadding: false,
    fontFamily: CN_FONT,
  },
  nameWrap: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  killOverlayWrap: {
    position: 'absolute',
    left: 10,
    right: 2,
    top: 2,
    bottom: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 3,
  },
  killOverlayIcon: {
    width: 80,
    height: 80,
    opacity: 0.96,
  },
  tableTextureOuter: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    bottom: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3c2a17',
    opacity: 0.8,
  },
  tableTextureInner: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 36,
    bottom: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#52361d',
    opacity: 0.7,
  },
  tableTextureCross: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '50%',
    height: 1,
    backgroundColor: '#3a2a1b',
    opacity: 0.5,
  },
  evilText: {
    color: '#ff3b3b',
  },
  roleTag: {
    marginTop: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: CN_FONT,
  },
  centerResult: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerResultCard: {
    width: 140,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1b1b28',
    alignItems: 'center',
  },
  resultText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  resultTextSmall: {
    color: '#c9c9d4',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  winGood: {
    color: '#22c55e',
  },
  winEvil: {
    color: '#ef4444',
  },
  resultButton: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#2f7cf6',
  },
  resultButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
  },
  tag: {
    backgroundColor: '#26263a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  hostRoleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostRoleThumb: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  hostRoleThumbFallback: {
    width: 20,
    height: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  tagText: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: CN_FONT,
  },
  tagActive: {
    borderWidth: 2,
    borderColor: '#2f7cf6',
  },
  tagSub: {
    color: '#b8b8c6',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  pickItem: {
    backgroundColor: '#232336',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  pickItemActive: {
    borderWidth: 2,
    borderColor: '#3b5bdb',
  },
  pickItemActiveGreen: {
    backgroundColor: '#1f7a3a',
  },
  pickText: {
    color: '#e9e9ef',
    fontFamily: CN_FONT,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#171721',
    padding: 16,
    borderRadius: 12,
  },
  largeModalCard: {
    maxHeight: '80%',
  },
  roleInfoModalCard: {
    backgroundColor: '#12131a',
    borderWidth: 1,
    borderColor: '#2b3347',
    zIndex: 2,
  },
  roleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  roleHeroWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1b2130',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  roleHeroTextWrap: {
    flex: 1,
  },
  roleHeroTitle: {
    color: '#f6e7c9',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: CN_FONT,
  },
  roleHeroSub: {
    color: '#aab2c3',
    fontSize: 13,
    fontFamily: CN_FONT,
  },
  roleHeroMeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleHeroMeBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  roleInfoSectionCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c3448',
    padding: 10,
    marginBottom: 10,
  },
  roleInfoSectionTitle: {
    color: '#e8ebf3',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: CN_FONT,
  },
  roleSeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  roleSeatBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2f7cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSeatBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  roleSeatBadgeMe: {
    backgroundColor: '#22c55e',
  },
  roleSeatName: {
    color: '#e5e7eb',
    fontSize: 14,
    flexShrink: 1,
    fontFamily: CN_FONT,
  },
  voteTeamList: {
    backgroundColor: '#1a1d27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c3448',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  voteTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  voteTeamRowMe: {
    backgroundColor: 'transparent',
  },
  voteTeamName: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: CN_FONT,
  },
  voteLeaderTag: {
    marginLeft: 8,
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  voteTeamNameMe: {
    color: '#ecfdf5',
  },
  voteTeamMeTag: {
    marginLeft: 8,
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  speakingTimerWrap: {
    marginBottom: 8,
  },
  speakingPhaseCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 0,
  },
  speakingPhaseContent: {
    padding: 12,
  },
  speakingPhaseBgFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderRadius: 10,
  },
  speakingPhaseBgFillDanger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  speakingTimerTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#232a3a',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 6,
  },
  speakingTimerFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  speakingTimerFillDanger: {
    backgroundColor: '#ef4444',
  },
  speakingTimerText: {
    color: '#c9d3e7',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  speakingTimerTextDanger: {
    color: '#f87171',
    fontWeight: '700',
  },
  historyListWrap: {
    maxHeight: 440,
    marginBottom: 10,
  },
  historyRoundWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  historyDetailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyDetailTopMeta: {
    flex: 1,
    minWidth: 0,
  },
  historyDetailTopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  historyDetailRoleName: {
    color: '#f6e7c9',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  historyRoundTable: {
    width: 292,
    height: 292,
    borderRadius: 146,
    position: 'relative',
    backgroundColor: 'rgba(43,31,20,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(166,124,60,0.45)',
    marginHorizontal: -8,
  },
  historyRoundCenterResult: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: 118,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  historyRoundCenterResultText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: CN_FONT,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  historySeatNode: {
    position: 'absolute',
    borderRadius: 18,
    backgroundColor: 'rgba(74,58,40,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(166,124,60,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  historySeatNodeAssassinated: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(88,22,22,0.78)',
  },
  historySeatNumberWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySeatNumberBg: {
    width: '100%',
    textAlign: 'center',
    lineHeight: 76,
    fontSize: 70,
    fontWeight: '900',
    letterSpacing: 0,
    color: 'rgba(246, 231, 201, 0.18)',
    includeFontPadding: false,
    fontFamily: 'System',
  },
  historySeatNodeName: {
    color: '#e5e7eb',
    fontSize: 10,
    marginTop: -2,
    fontFamily: CN_FONT,
    textAlign: 'center',
    maxWidth: '100%',
    paddingHorizontal: 3,
  },
  historySeatNodeNameDead: {
    color: '#fca5a5',
  },
  historySeatSlashWrap: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 26,
    height: 12,
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  historySeatSlashLine: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#ef4444',
    transform: [{ rotate: '-10deg' }],
  },
  historySeatSlashLineMid: {
    opacity: 0.9,
  },
  historyItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
    borderRadius: 10,
    marginBottom: 6,
  },
  historyItemWin: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.20)',
    borderWidth: 1,
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  historyRoleFirst: {
    color: '#f6e7c9',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  historyResultBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontFamily: CN_FONT,
  },
  historyResultWin: {
    color: '#dcfce7',
    backgroundColor: '#16a34a',
  },
  historyResultLose: {
    color: '#fee2e2',
    backgroundColor: '#dc2626',
  },
  historyTitle: {
    color: '#f6e7c9',
    fontSize: 13,
    marginBottom: 4,
    fontFamily: CN_FONT,
  },
  historySub: {
    color: '#c9c9d4',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: CN_FONT,
  },
  medalGridCompact: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyDetailMedalBlock: {
    marginTop: 12,
  },
  historyTaskRow: {
    backgroundColor: 'rgba(26,29,39,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(44,52,72,0.7)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  historyRejectText: {
    color: '#ef4444',
  },
  historyPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  historyPageText: {
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  statsModalCard: {
    backgroundColor: '#12131a',
    borderWidth: 1,
    borderColor: '#2b3347',
  },
  historyDetailModalCard: {
    backgroundColor: '#12131a',
    borderWidth: 1,
    borderColor: '#2b3347',
  },
  historyDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  historyDetailHeaderSpacer: {
    width: 76,
  },
  statsScrollContent: {
    paddingBottom: 8,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2c3448',
  },
  statsSummaryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#2c3448',
  },
  statsSummaryValue: {
    fontSize: 32,
    fontWeight: '500',
    fontFamily: CN_FONT,
  },
  statsSummaryBlue: {
    color: '#1e73ea',
  },
  statsSummaryGreen: {
    color: '#22c55e',
  },
  statsSummaryLabel: {
    marginTop: 4,
    color: '#9aa3b5',
    fontSize: 13,
    fontFamily: CN_FONT,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 12,
    rowGap: 12,
  },
  medalGridStats: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsRoleCard: {
    width: '30.6%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statsRoleAvatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  spriteClip: {
    overflow: 'hidden',
  },
  statsRoleAvatarText: {
    fontSize: 30,
  },
  statsRoleName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: CN_FONT,
  },
  statsRoleMeta: {
    color: '#aab2c3',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: CN_FONT,
  },
  table: {
    borderWidth: 1,
    borderColor: '#2b3347',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 26, 38, 0.74)',
  },
  historyDetailTaskTable: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginHorizontal: -1,
  },
  historyTaskSectionCard: {
    paddingHorizontal: 0,
  },
  historyTaskSectionTitle: {
    paddingHorizontal: 12,
  },
  speakRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
    overflow: 'hidden',
    paddingLeft: 0,
    marginLeft: -2,
  },
  speakRowMe: {
    justifyContent: 'flex-end',
  },
  speakLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '84%',
    minWidth: 0,
    gap: 6,
  },
  speakLineMe: {
    flexDirection: 'row-reverse',
  },
  speakAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#23202c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  speakAvatarBoxMe: {
    backgroundColor: '#1f2d3f',
  },
  speakAvatarSeat: {
    color: '#f3e3c5',
    fontWeight: '700',
    fontSize: 10,
    fontFamily: CN_FONT,
  },
  speakAvatarName: {
    color: '#c9c9d4',
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
    fontFamily: CN_FONT,
  },
  speakBubble: {
    backgroundColor: '#171721',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2b3347',
    position: 'relative',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  speakBubbleMe: {
    backgroundColor: '#1f2d3f',
    borderColor: '#2f7cf6',
  },
  speakBody: {
    color: '#c9c9d4',
    lineHeight: 18,
    fontFamily: CN_FONT,
    flexShrink: 1,
    minWidth: 0,
    ...(IS_WEB ? { width: '100%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' } : null),
  },
  speakBodyMe: {
    color: '#d6e3ff',
  },
  speakTail: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#171721',
  },
  speakTailMe: {
    left: undefined,
    right: -6,
    borderRightWidth: 0,
    borderLeftWidth: 8,
    borderLeftColor: '#1f2d3f',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  speakHeaderInline: {
    color: '#e8eefc',
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  speakHeaderMe: {
    color: '#dbe8ff',
  },
  speakBubbleWide: {
    maxWidth: '100%',
    backgroundColor: '#171721',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2b3347',
    minWidth: 0,
  },
  recapTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    gap: 6,
  },
  recapTag: {
    backgroundColor: '#2b2f3f',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  recapTagText: {
    color: '#cfe3ff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  recapTagValue: {
    color: '#c9c9d4',
    fontFamily: CN_FONT,
  },
  recapReviewBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2b3347',
    gap: 4,
  },
  recapReviewTitle: {
    color: '#f6e7c9',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  rulesJourneyCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1a1d27',
    borderWidth: 1,
    borderColor: '#2c3448',
  },
  rulesJourneyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rulesJourneyStep: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d6a35a',
  },
  rulesJourneyStepText: {
    color: '#16181f',
    fontWeight: '800',
    fontFamily: CN_FONT,
  },
  rulesJourneyTitle: {
    color: '#f6e7c9',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  rulesJourneyScene: {
    marginTop: 2,
    color: '#97acd3',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  rulesJourneyPoint: {
    color: '#d8dfec',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: CN_FONT,
  },
  medalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  medalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#1a1d27',
    borderWidth: 1,
    borderColor: '#2c3448',
  },
  medalChipCompact: {
    width: 56,
    height: 56,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  medalChipImage: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  medalChipImageCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  medalChipFallback: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e3444',
  },
  medalChipFallbackCompact: {
    width: 32,
    height: 32,
  },
  medalChipFallbackText: {
    fontSize: 18,
  },
  medalChipTextWrap: {
    minWidth: 0,
    flexShrink: 1,
  },
  medalChipName: {
    color: '#eef2fb',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  medalChipMeta: {
    color: '#9fb0cc',
    fontSize: 11,
    marginTop: 2,
    fontFamily: CN_FONT,
  },
  medalModalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tableRowHead: {
    flexDirection: 'row',
    backgroundColor: '#1a2233',
    borderBottomWidth: 1,
    borderBottomColor: '#2b3347',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f273a',
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    color: '#e6eaf2',
    fontSize: 12,
    fontFamily: CN_FONT,
  },
  voteReject: {
    color: '#ef4444',
  },
  resultFail: {
    color: '#ef4444',
    fontWeight: '700',
  },
  resultSuccess: {
    color: '#22c55e',
    fontWeight: '700',
  },
  missionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  missionPill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1a2233',
    borderWidth: 1,
    borderColor: '#2b3347',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionPillSuccess: {
    backgroundColor: '#1f3a2a',
  },
  missionPillFail: {
    backgroundColor: '#3a1f1f',
  },
  missionPillCurrent: {
    borderWidth: 2,
    borderColor: '#c9b27a',
    shadowColor: '#f5d27a',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  missionSize: {
    color: '#f6e7c9',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: CN_FONT,
  },
  missionSizeUnderline: {
    textDecorationLine: 'underline',
    textDecorationColor: '#f6e7c9',
  },
  colRound: {
    width: 48,
  },
  colLeader: {
    width: 36,
  },
  colTeam: {
    width: 68,
  },
  colVote: {
    flex: 1,
    minWidth: 132,
  },
  historyColTeam: {
    width: 64,
  },
  historyColLeader: {
    width: 38,
  },
  historyColVote: {
    flex: 1,
    minWidth: 104,
  },
  historyColResult: {
    width: 40,
  },
  missionFxOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  missionFxFullscreenTint: {
    ...StyleSheet.absoluteFillObject,
  },
  missionFxFullscreenTintSuccess: {
    backgroundColor: 'rgba(22, 84, 166, 0.28)',
  },
  missionFxFullscreenTintFail: {
    backgroundColor: 'rgba(153, 27, 27, 0.28)',
  },
  missionFxCard: {
    width: '88%',
    maxWidth: 360,
    minWidth: 280,
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 2,
  },
  missionFxCardScrim: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  missionFxCardScrimSuccess: {
    backgroundColor: 'transparent',
  },
  missionFxCardScrimFail: {
    backgroundColor: 'transparent',
  },
  missionFxCardArt: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1.4,
    marginBottom: 6,
  },
  missionFxFailIconsRow: {
    marginTop: 2,
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 2,
    minHeight: 58,
  },
  missionFxFailIconWrap: {
    width: 78,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(80, 10, 10, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionFxFailIconImg: {
    width: 40,
    height: 40,
  },
  colResult: {
    width: 58,
  },
});
