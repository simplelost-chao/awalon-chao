import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Share } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080';

export default function App() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState('');
  const [room, setRoom] = useState(null);
  const [nickname, setNickname] = useState('玩家');
  const [avatar, setAvatar] = useState('🐺');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('7');
  const [speakingSeconds, setSpeakingSeconds] = useState('60');
  const [rolesText, setRolesText] = useState('');
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    connect();
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function connect() {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

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
      if (msg.type === 'ROOM_STATE') {
        setRoom(msg.room);
        if (msg.room && msg.room.hostId === clientId) {
          setMaxPlayers(String(msg.room.maxPlayers));
          setSpeakingSeconds(String(msg.room.speakingSeconds));
          if (Array.isArray(msg.room.roles)) setRolesText(msg.room.roles.join(', '));
        }
      }
    };
  }

  function send(type, payload) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type, payload }));
  }

  function createRoom() {
    send('CREATE_ROOM', {
      nickname,
      avatar,
      maxPlayers: parseInt(maxPlayers, 10),
      speakingSeconds: parseInt(speakingSeconds, 10),
      roles: rolesFromText(),
    });
  }

  function joinRoom() {
    send('JOIN_ROOM', { roomCode: roomCodeInput.trim().toUpperCase(), nickname, avatar });
  }

  function leaveRoom() {
    send('LEAVE_ROOM');
    setRoom(null);
  }

  function updateProfile() {
    send('SET_PROFILE', { nickname, avatar });
  }

  function chooseSeat(index) {
    send('CHOOSE_SEAT', { seatIndex: index });
  }

  function updateSettings() {
    send('UPDATE_SETTINGS', {
      maxPlayers: parseInt(maxPlayers, 10),
      speakingSeconds: parseInt(speakingSeconds, 10),
      roles: rolesFromText(),
    });
  }

  function startGame() {
    send('START_GAME');
  }

  function nextSpeaker() {
    send('NEXT_SPEAKER');
  }

  function rolesFromText() {
    const parts = rolesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }

  const isHost = room && room.hostId === clientId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Avalon Online</Text>

        <View style={styles.card}>
          <Text style={styles.label}>连接状态: {connected ? '已连接' : '未连接'}</Text>
          <Text style={styles.label}>WS: {WS_URL}</Text>
        </View>

        {!room && (
          <View style={styles.card}>
            <Text style={styles.section}>个人资料</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="昵称"
            />
            <TextInput
              style={styles.input}
              value={avatar}
              onChangeText={setAvatar}
              placeholder="头像(表情)"
            />
            <TouchableOpacity style={styles.button} onPress={updateProfile}>
              <Text style={styles.buttonText}>更新昵称/头像</Text>
            </TouchableOpacity>

            <Text style={styles.section}>创建房间</Text>
            <TextInput
              style={styles.input}
              value={maxPlayers}
              onChangeText={setMaxPlayers}
              placeholder="人数(5-10)"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              value={speakingSeconds}
              onChangeText={setSpeakingSeconds}
              placeholder="发言秒数(10-300)"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              value={rolesText}
              onChangeText={setRolesText}
              placeholder="角色列表(用逗号分隔)"
            />
            <TouchableOpacity style={styles.button} onPress={createRoom}>
              <Text style={styles.buttonText}>创建</Text>
            </TouchableOpacity>

            <Text style={styles.section}>加入房间</Text>
            <TextInput
              style={styles.input}
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              placeholder="房间号"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.button} onPress={joinRoom}>
              <Text style={styles.buttonText}>加入</Text>
            </TouchableOpacity>
          </View>
        )}

        {room && (
          <View style={styles.card}>
            <Text style={styles.section}>房间 {room.code}</Text>
            <Text style={styles.label}>房主: {room.hostId === clientId ? '你' : room.hostId}</Text>
            <Text style={styles.label}>人数: {room.players.length}/{room.maxPlayers}</Text>
            <Text style={styles.label}>发言限制: {room.speakingSeconds}s</Text>

            <View style={styles.row}>
              <TouchableOpacity style={styles.button} onPress={() => Share.share({ message: `阿瓦隆房间号: ${room.code}` })}>
                <Text style={styles.buttonText}>邀请好友</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonAlt} onPress={leaveRoom}>
                <Text style={styles.buttonText}>离开房间</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>座位选择</Text>
            <View style={styles.seatGrid}>
              {Array.from({ length: room.maxPlayers }).map((_, idx) => {
                const playerId = room.seats[idx];
                const player = room.players.find((p) => p.id === playerId);
                const me = playerId === clientId;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.seat, me && styles.seatMe]}
                    onPress={() => chooseSeat(idx)}
                  >
                    <Text style={styles.seatText}>#{idx + 1}</Text>
                    <Text style={styles.seatText}>{player ? `${player.avatar} ${player.nickname}` : '空'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.section}>玩家列表</Text>
            {room.players.map((p) => (
              <Text key={p.id} style={styles.label}>
                {p.avatar} {p.nickname} {p.id === room.hostId ? '(房主)' : ''} {p.id === clientId ? '(你)' : ''}
              </Text>
            ))}

            {isHost && !room.started && (
              <View style={styles.cardInner}>
                <Text style={styles.section}>房间设置(房主)</Text>
                <TextInput
                  style={styles.input}
                  value={maxPlayers}
                  onChangeText={setMaxPlayers}
                  placeholder="人数(5-10)"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  value={speakingSeconds}
                  onChangeText={setSpeakingSeconds}
                  placeholder="发言秒数(10-300)"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  value={rolesText}
                  onChangeText={setRolesText}
                  placeholder="角色列表(用逗号分隔)"
                />
                <TouchableOpacity style={styles.button} onPress={updateSettings}>
                  <Text style={styles.buttonText}>应用设置</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={startGame}>
                  <Text style={styles.buttonText}>开始游戏</Text>
                </TouchableOpacity>
              </View>
            )}

            {room.started && (
              <View style={styles.cardInner}>
                <Text style={styles.section}>发言环节</Text>
                <Text style={styles.label}>当前座位: #{room.speaking?.index + 1}</Text>
                <Text style={styles.label}>
                  剩余时间: {Math.max(0, Math.floor((room.speaking?.endAt - tick) / 1000))}s
                </Text>
                {isHost && (
                  <TouchableOpacity style={styles.button} onPress={nextSpeaker}>
                    <Text style={styles.buttonText}>下一个发言</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  scroll: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#171721',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardInner: {
    backgroundColor: '#1f1f2b',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f0f0f0',
    marginBottom: 8,
  },
  label: {
    color: '#c9c9d4',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f0f15',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  button: {
    backgroundColor: '#3b5bdb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonAlt: {
    backgroundColor: '#2f2f3f',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seat: {
    width: '48%',
    backgroundColor: '#232336',
    padding: 8,
    borderRadius: 8,
  },
  seatMe: {
    borderWidth: 2,
    borderColor: '#3b5bdb',
  },
  seatText: {
    color: '#e9e9ef',
  },
});
