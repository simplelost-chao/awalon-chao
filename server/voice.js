/**
 * AI 语音合成模块
 * 调用 CosyVoice 服务（https://voice.zhuchao.life）为每个 persona 合成语音
 */
const fs   = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch    = require('node-fetch');

const VOICE_URL   = process.env.VOICE_SERVICE_URL || 'https://voice.zhuchao.life';
const REFS_DIR    = path.join(__dirname, 'voice_refs');

// persona key → 参考音频对应的文字（用作 prompt_text）
const PERSONA_REF_TEXTS = {
  '莫甘娜的微笑':   '逻辑上讲，这件事不能仅凭表面现象就下结论。大家可以仔细想想，真正有问题的人，是不需要反复解释的。',
  '梅林看穿你了':   '某些人心里应该很清楚。我不说，但懂的人自然懂。有些信息不必点破，结果会证明一切。',
  '奥伯龙没朋友':   '我有自己的判断。不必解释，结果会说明一切。',
  '我知道你知道':   '你知道我在看你。我们之间心知肚明，不需要说得太明白。信息战，从现在开始。',
  '背刺有理':       '前期我一直支持你，正是因为这样，现在我必须说实话了。对不起，但逻辑不允许我继续护着你。',
  '沉默即答案':     '懂的自然懂。',
  '任务失败不是我': '肯定是某人的问题！我早就说了不该带他，反正不是我，证据我都列出来了，大家好好想想！',
  '帕西法尔的直觉': '我感觉……就是感觉啦。直觉告诉我有问题，说不清楚，但就是有种感觉，大家信我一次嘛。',
  '三号位可疑':     '某号一直很奇怪。我锁定了，不管你们怎么想，我就认准这个人，每轮我都会提。',
  '不解释':         '随便。爱信不信。我不解释，结果会说话。',
};

/** 从 WAV buffer 解析时长（毫秒） */
function getWavDurationMs(buf) {
  try {
    const sampleRate  = buf.readUInt32LE(24);
    const byteRate    = buf.readUInt32LE(28);
    const dataSize    = buf.readUInt32LE(40);
    return Math.round((dataSize / byteRate) * 1000);
  } catch {
    return 0;
  }
}

/** 检查语音服务是否可用 */
async function isVoiceServiceAvailable() {
  try {
    const res = await fetch(`${VOICE_URL}/health`, { timeout: 3000 });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 启动时为所有 persona 预热 speaker embedding（调 /build_speaker）
 * voice service 重启后 spk2info 会清空，需要重建
 */
async function warmupPersonaEmbeddings() {
  try {
    const available = await isVoiceServiceAvailable();
    if (!available) { console.log('[voice] service unavailable, skip warmup'); return; }

    let built = 0, skipped = 0;
    for (const [personaKey, refText] of Object.entries(PERSONA_REF_TEXTS)) {
      const refFile = path.join(REFS_DIR, `${personaKey}.wav`);
      if (!fs.existsSync(refFile)) { skipped++; continue; }

      // 先测试 synthesize_cached，已有则跳过
      const testRes = await fetch(`${VOICE_URL}/synthesize_cached`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tts_text: '测', contact_id: personaKey }),
        timeout: 5000,
      }).catch(() => null);
      if (testRes && testRes.status === 200) { skipped++; continue; }

      const form = new FormData();
      form.append('contact_id',   personaKey);
      form.append('prompt_texts', JSON.stringify([refText]));
      form.append('prompt_wavs',  fs.createReadStream(refFile), { filename: 'ref.wav', contentType: 'audio/wav' });

      const res = await fetch(`${VOICE_URL}/build_speaker`, {
        method: 'POST', body: form, timeout: 60000,
      }).catch(e => { console.warn(`[voice] build_speaker ${personaKey} failed:`, e.message); return null; });

      if (res && res.ok) {
        built++;
        console.log(`[voice] warmup built: ${personaKey}`);
      }
    }
    console.log(`[voice] warmup done: ${built} built, ${skipped} skipped`);
  } catch (e) {
    console.error('[voice] warmup error:', e.message);
  }
}

// 启动后异步预热（不阻塞服务启动）
warmupPersonaEmbeddings().catch(() => {});

module.exports.warmupPersonaEmbeddings = warmupPersonaEmbeddings;

/**
 * 为 AI 角色合成语音
 * @param {string} text       - 要合成的文字
 * @param {string} personaKey - AI 性格键名
 * @returns {{ audioBase64: string, durationMs: number } | null}
 */
async function synthesizeAiSpeech(text, personaKey) {
  const refText = PERSONA_REF_TEXTS[personaKey];
  const refFile = path.join(REFS_DIR, `${personaKey}.wav`);

  if (!refText || !fs.existsSync(refFile)) {
    console.warn(`[voice] no ref for persona "${personaKey}"`);
    return null;
  }

  const form = new FormData();
  form.append('tts_text',    text);
  form.append('prompt_text', refText);
  form.append('contact_id',  personaKey);
  form.append('prompt_wav',  fs.createReadStream(refFile), { filename: 'ref.wav', contentType: 'audio/wav' });

  const t0 = Date.now();
  const res = await fetch(`${VOICE_URL}/synthesize`, {
    method:  'POST',
    body:    form,
    timeout: 90000,
  });

  if (!res.ok) {
    console.error(`[voice] synthesize failed: ${res.status}`);
    return null;
  }

  const wavBuf      = await res.buffer();
  const durationMs  = getWavDurationMs(wavBuf);
  const audioBase64 = wavBuf.toString('base64');
  console.log(`[voice] ${personaKey} ${durationMs}ms audio, took ${Date.now() - t0}ms`);
  return { audioBase64, durationMs };
}

module.exports = { synthesizeAiSpeech, isVoiceServiceAvailable, warmupPersonaEmbeddings };
