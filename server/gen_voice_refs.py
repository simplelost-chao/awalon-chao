"""生成 10 个 AI persona 的参考音频（WAV 格式）。
用法: /tmp/CosyVoice/.venv/bin/python server/gen_voice_refs.py
依赖: edge-tts（已在 CosyVoice venv 中），ffmpeg（系统路径）
"""
import asyncio
import subprocess
import tempfile
import os
from pathlib import Path

REFS_DIR = Path(__file__).parent / "voice_refs"
REFS_DIR.mkdir(exist_ok=True)

PERSONAS = {
    "莫甘娜的微笑": {
        "voice": "zh-CN-XiaoxiaoNeural",
        "text": "逻辑上讲，这件事不能仅凭表面现象就下结论。大家可以仔细想想，真正有问题的人，是不需要反复解释的。",
    },
    "梅林看穿你了": {
        "voice": "zh-CN-YunjianNeural",
        "text": "某些人心里应该很清楚。我不说，但懂的人自然懂。有些信息不必点破，结果会证明一切。",
    },
    "奥伯龙没朋友": {
        "voice": "zh-CN-YunxiaNeural",
        "text": "我有自己的判断。不必解释，结果会说明一切。",
    },
    "我知道你知道": {
        "voice": "zh-CN-YunyangNeural",
        "text": "你知道我在看你。我们之间心知肚明，不需要说得太明白。信息战，从现在开始。",
    },
    "背刺有理": {
        "voice": "zh-CN-YunxiNeural",
        "text": "前期我一直支持你，正是因为这样，现在我必须说实话了。对不起，但逻辑不允许我继续护着你。",
    },
    "沉默即答案": {
        "voice": "zh-CN-shaanxi-XiaoniNeural",
        "text": "懂的自然懂。",
    },
    "任务失败不是我": {
        "voice": "zh-CN-XiaoyiNeural",
        "text": "肯定是某人的问题！我早就说了不该带他，反正不是我，证据我都列出来了，大家好好想想！",
    },
    "帕西法尔的直觉": {
        "voice": "zh-TW-HsiaoYuNeural",
        "text": "我感觉……就是感觉啦。直觉告诉我有问题，说不清楚，但就是有种感觉，大家信我一次嘛。",
    },
    "三号位可疑": {
        "voice": "zh-CN-liaoning-XiaobeiNeural",
        "text": "某号一直很奇怪。我锁定了，不管你们怎么想，我就认准这个人，每轮我都会提。",
    },
    "不解释": {
        "voice": "zh-HK-WanLungNeural",
        "text": "随便。爱信不信。我不解释，结果会说话。",
    },
}


async def gen_one(name: str, voice: str, text: str):
    out_wav = REFS_DIR / f"{name}.wav"
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
        tmp_mp3 = tf.name

    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(tmp_mp3)

        # 转成 16kHz 单声道 WAV（CosyVoice 要求）
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_mp3,
             "-ar", "16000", "-ac", "1", str(out_wav)],
            check=True, capture_output=True,
        )
        size = out_wav.stat().st_size
        print(f"  ✓ {name}  ({voice})  {size//1024}KB")
    except Exception as e:
        print(f"  ✗ {name}: {e}")
    finally:
        try:
            os.unlink(tmp_mp3)
        except Exception:
            pass


async def main():
    print(f"生成 {len(PERSONAS)} 个 persona 参考音频 → {REFS_DIR}")
    for name, cfg in PERSONAS.items():
        await gen_one(name, cfg["voice"], cfg["text"])
    print("完成")


if __name__ == "__main__":
    asyncio.run(main())
