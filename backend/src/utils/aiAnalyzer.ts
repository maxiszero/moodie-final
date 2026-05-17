// @ts-nocheck
function clampFeedQuality(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Heuristic when AI is unavailable: shorter / spam-like text ranks lower for feed ordering. */
function estimateFeedQuality(rawText) {
  const t = (rawText || '').trim();
  if (t.length < 8) return 38;
  if (t.length < 24) return 55;
  let q = 72;
  const lower = t.toLowerCase();
  if (/купи скорее|кликни|viagra|casino|казино|заработок в интернет|реклама бесплатн|buy now|click here/i.test(lower)) q = 18;
  else if (/(https?:\/\/|www\.)/i.test(lower)) q = 25;
  else if (/^(.)\1{12,}$/u.test(t.replace(/\s/g, ''))) q = 22;
  return q;
}

function pythonMoodServiceUrl() {
  const raw = String(process.env.PYTHON_MOOD_SERVICE_URL || 'http://127.0.0.1:8000').trim();
  return raw.replace(/\/+$/, '');
}

function pythonMoodServiceEnabled() {
  return String(process.env.DISABLE_PYTHON_MOOD_SERVICE || '').toLowerCase() !== 'true';
}

async function postPythonMood(path, body, timeoutOverride) {
  if (!pythonMoodServiceEnabled()) return null;
  const timeoutMs =
    typeof timeoutOverride === 'number' && timeoutOverride > 0
      ? timeoutOverride
      : parseInt(process.env.PYTHON_MOOD_SERVICE_TIMEOUT_MS, 10) || 2500;
  try {
    const res = await fetch(`${pythonMoodServiceUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

function coercePythonAnalysis(data, text) {
  if (!data || typeof data !== 'object' || !data.emotion) return null;
  return {
    emotion: String(data.emotion || 'neutral').toLowerCase(),
    emoji: typeof data.emoji === 'string' && data.emoji ? data.emoji : '😐',
    intensity: typeof data.intensity === 'number' ? data.intensity : 50,
    color: typeof data.color === 'string' && data.color ? data.color : '#9E9E9E',
    color2: typeof data.color2 === 'string' && data.color2 ? data.color2 : data.color || '#757575',
    color3: typeof data.color3 === 'string' && data.color3 ? data.color3 : data.color2 || data.color || '#616161',
    reasoning: typeof data.reasoning === 'string' ? data.reasoning : '',
    tip: typeof data.tip === 'string' ? data.tip : '',
    feedQuality: clampFeedQuality(data.feedQuality) ?? estimateFeedQuality(text),
  };
}

function coerceMoodSong(data) {
  const song = data && typeof data === 'object' ? data.song : null;
  if (!song || typeof song !== 'object') return null;
  const title = typeof song.moodSongTitle === 'string' ? song.moodSongTitle.trim() : '';
  const artist = typeof song.moodSongArtist === 'string' ? song.moodSongArtist.trim() : '';
  const previewUrl = typeof song.moodSongPreviewUrl === 'string' ? song.moodSongPreviewUrl.trim() : '';
  const externalUrl = typeof song.moodSongExternalUrl === 'string' ? song.moodSongExternalUrl.trim() : '';
  if (!title || !artist || !previewUrl || !externalUrl) return null;
  return {
    moodSongTitle: title,
    moodSongArtist: artist,
    moodSongPreviewUrl: previewUrl,
    moodSongExternalUrl: externalUrl,
    moodSongArtworkUrl: typeof song.moodSongArtworkUrl === 'string' ? song.moodSongArtworkUrl.trim() : '',
    moodSongSource: typeof song.moodSongSource === 'string' ? song.moodSongSource.trim() : 'itunes',
  };
}

/** Accept only Apple/iTunes preview and store URLs (defense in depth for stored user fields). */
function assertSafeMoodSongUrls(song) {
  if (!song) return null;
  try {
    const p = new URL(song.moodSongPreviewUrl);
    if (p.protocol !== 'https:') return null;
    const ph = p.hostname.toLowerCase();
    if (ph !== 'audio-ssl.itunes.apple.com' && !ph.endsWith('.itunes.apple.com')) return null;
  } catch {
    return null;
  }
  try {
    const e = new URL(song.moodSongExternalUrl);
    if (e.protocol !== 'https:') return null;
    const eh = e.hostname.toLowerCase();
    if (
      eh !== 'music.apple.com' &&
      eh !== 'itunes.apple.com' &&
      !eh.endsWith('.music.apple.com') &&
      !eh.endsWith('.itunes.apple.com')
    ) {
      return null;
    }
  } catch {
    return null;
  }
  if (song.moodSongArtworkUrl) {
    try {
      const a = new URL(song.moodSongArtworkUrl);
      if (a.protocol !== 'https:') return null;
      if (!a.hostname.toLowerCase().endsWith('.mzstatic.com')) return null;
    } catch {
      return null;
    }
  }
  return song;
}

/** Validates client-submitted mood song payload for POST /posts. */
function normalizeClientMoodSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const coerced = coerceMoodSong({ song: raw });
  if (!coerced) return null;
  return assertSafeMoodSongUrls(coerced);
}

async function suggestMoodSongs(text, limit = 5) {
  const cap = Math.min(8, Math.max(1, limit));
  const data = await postPythonMood('/api/mood-song/suggest', { text, limit: cap }, 18_000);
  if (!data || typeof data !== 'object') return { emotion: null, songs: [] };
  const emotion = typeof data.emotion === 'string' ? data.emotion.toLowerCase() : null;
  const rawSongs = Array.isArray(data.songs) ? data.songs : [];
  const songs = rawSongs
    .map((s) => assertSafeMoodSongUrls(coerceMoodSong({ song: s })))
    .filter(Boolean);
  return { emotion, songs };
}

/**
 * Analyzes text and returns { emotion, emoji, color, color2, color3, reasoning, tip, feedQuality } (fallback provided).
 * Supports API key rotation.
 */
const analyzeEmotionFallback = async (text, isTipOnly = false) => {
  const apiKeys = (process.env.AI_API_KEYS || process.env.AI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k && k !== 'your_ai_api_key_here');
  
  for (const apiKey of apiKeys) {
    try {
      // Do not log API keys (even partial) to avoid accidental leakage via logs.
      
      let systemPrompt = "";
      if (isTipOnly) {
        systemPrompt = `You are a supportive and empathetic friend. 
        Analyze the text and provide a very short (max 15 words) supportive tip, advice or a fitting quote in Russian. 
        Use standard colorful Unicode emojis.
        CRITICAL: All emojis must be INSIDE the double quotes of the JSON value.
        Respond ONLY with a valid JSON object: {"tip": "..."}`;
      } else {
        systemPrompt = `You are an AI emotion analyzer. Analyze the text and return a JSON object.
Rules:
1. "emotion" field MUST be EXACTLY ONE English word (e.g. happy, sad, angry, tired, anxious, neutral). DO NOT use Russian for this field.
2. "emoji" is a single unicode emoji.
3. "intensity" is a number from 0 to 100 representing how strong the emotion is.
4. "color1", "color2", "color3" are HEX colors representing the emotion.
   CRITICAL STYLE: Use soft pastel gradients, muted lavender and cream tones, low saturation, matte finish, elegant and calm aesthetic.
   AVOID: harsh yellows, golden reflections, highly saturated colors, or dark colors.
   PREFER: Complementary calm pairs (e.g., pale blue + soft pink, light grey + mint).

5. "reasoning" and "tip" must be in Russian (max 20 words each).
6. "feedQuality" is an integer 0-100: how suitable this post is for showing high in the community feed (thoughtful, supportive, on-topic, not spam). Low for empty noise, spam patterns, hate, harassment, or off-topic junk. Do NOT refuse posts—only score for ordering.
7. Output ONLY valid JSON. No extra text.

Example:
{
  "emotion": "happy",
  "emoji": "😊",
  "intensity": 85,
  "color1": "#B3E5FC",
  "color2": "#F8BBD0",
  "color3": "#E1BEE7",
  "reasoning": "Текст выражает сильную радость.",
  "tip": "Отличное настроение! Поделись им с миром!",
  "feedQuality": 82
}

TEXT TO ANALYZE:
`
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{
            role: 'system',
            content: systemPrompt
          }, {
            role: 'user',
            content: text
          }],
          response_format: { type: "json_object" },
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        let aiResponse = JSON.parse(data.choices[0].message.content.trim());
        
        if (isTipOnly) {
          return { tip: aiResponse.tip };
        }

        if (aiResponse.emotion && aiResponse.emoji && aiResponse.color1) {
          console.log(`Groq AI определил:`, aiResponse);
          
          // Improved emoji extraction: keep only the first actual emoji
          let emoji = '😐';
          const emojiMatch = (aiResponse.emoji || '').match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
          if (emojiMatch) {
            emoji = emojiMatch[0];
          }

          const fq = clampFeedQuality(aiResponse.feedQuality) ?? estimateFeedQuality(text);
          return {
            emotion: aiResponse.emotion.toLowerCase(),
            emoji: emoji,
            intensity: aiResponse.intensity || 50,
            color: aiResponse.color1,
            color2: aiResponse.color2 || aiResponse.color1,
            color3: aiResponse.color3 || aiResponse.color2 || aiResponse.color1,
            reasoning: aiResponse.reasoning || "",
            tip: aiResponse.tip || "",
            feedQuality: fq,
          };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Ошибка API Groq (ключ ${apiKey.substring(0, 8)}...):`, JSON.stringify(errorData));
        if (errorData.error && errorData.error.failed_generation) {
          console.log('Попытка восстановить данные из failed_generation...');
          try {
             let raw = errorData.error.failed_generation.trim();
             
             // 1. Fix cases where JSON is cut off or has trailing garbage
             if (!raw.endsWith('}')) {
               const lastBrace = raw.lastIndexOf('}');
               if (lastBrace !== -1) raw = raw.substring(0, lastBrace + 1);
             }

             // 2. Fix unquoted or improperly quoted emojis/values at the end
             raw = raw.replace(/"emoji":\s*"?["']?([^"',\s}]+)["']?"?\s*}/, '"emoji": "$1"}');
             
             // 3. Ensure last property is closed before the final brace
             if (raw.endsWith('}') && !raw.match(/"\s*}$/) && !raw.match(/\d\s*}$/) && !raw.match(/true\s*}$|false\s*}$|null\s*}$/)) {
                raw = raw.replace(/\s*}\s*$/, '"}');
             }

             const fixed = JSON.parse(raw);
             if (isTipOnly && fixed.tip) return { tip: fixed.tip };
             if (fixed.emotion) {
                let emo = '😊';
                const emoMatch = (fixed.emoji || '').match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
                if (emoMatch) emo = emoMatch[0];

                const fq = clampFeedQuality(fixed.feedQuality) ?? estimateFeedQuality(text);
                return {
                    emotion: fixed.emotion.toLowerCase(),
                    emoji: emo,
                    intensity: fixed.intensity || 50,
                    color: fixed.color1 || '#9E9E9E',
                    color2: fixed.color2 || fixed.color1 || '#757575',
                    color3: fixed.color3 || fixed.color2 || '#616161',
                    reasoning: fixed.reasoning || "",
                    tip: fixed.tip || "",
                    feedQuality: fq,
                };
             }
          } catch (e) { 
             console.error('Не удалось восстановить JSON:', e.message);
          }
        }
      }
    } catch (apiError) {
      console.error(`Не удалось подключиться к Groq API (ключ ${apiKey.substring(0, 8)}...):`, apiError.message);
    }
  }

  // Fallback if all keys fail or no keys provided
  console.log('Используем локальный fallback анализатор эмоций...');
  const lowerText = text.toLowerCase();
  
  // Default fallback
  let result = { 
    emotion: 'neutral', 
    emoji: '😐', 
    intensity: 30,
    color: '#9E9E9E', 
    color2: '#757575', 
    color3: '#616161',
    reasoning: 'Текст кажется нейтральным по смыслу.',
    tip: 'Просто хороший день, чтобы ничего не делать ☁️',
    feedQuality: estimateFeedQuality(text),
  };

  if (isTipOnly) return { tip: result.tip };

  // Basic Keyword Fallback
  if (lowerText.match(/апати|всё равно|ничего не чувств|numb|apat/)) 
    result = { emotion: 'apathy', emoji: '😶', intensity: 40, color: '#CBD5E1', color2: '#94A3B8', color3: '#64748B', reasoning: 'Чувство безразличия.', tip: 'Иногда ничего не чувствовать — это тоже нормально 😶' };
  else if (lowerText.match(/спокой|умиротвор|гармон|zen|calm|peaceful/)) 
    result = { emotion: 'calm', emoji: '😌', intensity: 20, color: '#99F6E4', color2: '#5EEAD4', color3: '#2DD4BF', reasoning: 'Спокойствие и дзен.', tip: 'Вдох-выдох... Поймай этот момент 😌' };
  else if (lowerText.match(/меланхол|ностальг|тосклив|wistful|melanchol/)) 
    result = { emotion: 'melancholy', emoji: '🌧️', intensity: 45, color: '#C7D2FE', color2: '#A5B4FC', color3: '#818CF8', reasoning: 'Светлая грусть или ностальгия.', tip: 'Включи любимый плейлист и помечтай 🌧️' };
  else if (lowerText.match(/драйв|рвусь|мотивац|hustle|drive|на подъёме/)) 
    result = { emotion: 'driven', emoji: '🚀', intensity: 90, color: '#FED7AA', color2: '#FDBA74', color3: '#FB923C', reasoning: 'Энергия и мотивация.', tip: 'Полный вперед! Тебя не остановить 🚀' };
  else if (lowerText.match(/тревож|на взводе|anxiety|переживаю|волнуюсь/)) 
    result = { emotion: 'anxious', emoji: '😰', intensity: 75, color: '#FDE68A', color2: '#FCD34D', color3: '#FBBF24', reasoning: 'Чувство беспокойства.', tip: 'Всё будет хорошо, ты со всем справишься ❤️' };
  else if (lowerText.match(/вдохнов|идеи|творч|muse|inspir/)) 
    result = { emotion: 'inspired', emoji: '✨', intensity: 80, color: '#E9D5FF', color2: '#D8B4FE', color3: '#C084FC', reasoning: 'Творческий подъем.', tip: 'Твори и вдохновляй! ✨' };
  else if (lowerText.match(/устал|tired|sleep|спать/)) 
    result = { emotion: 'tired', emoji: '😫', intensity: 60, color: '#E7E5E4', color2: '#D6D3D1', color3: '#A8A29E', reasoning: 'Нужен отдых.', tip: 'Пора отдохнуть и набраться сил 🔋' };
  else if (lowerText.match(/страш|panic|terror|ужас|боюсь/) && !lowerText.match(/тревож/)) 
    result = { emotion: 'scared', emoji: '😨', intensity: 85, color: '#DDD6FE', color2: '#C4B5FD', color3: '#A78BFA', reasoning: 'Чувство страха.', tip: 'Ты сильнее, чем кажешься 🛡️' };
  else if (lowerText.match(/любл|love|обожаю/)) 
    result = { emotion: 'love', emoji: '🥰', intensity: 95, color: '#FBCFE8', color2: '#F9A8D4', color3: '#F472B6', reasoning: 'Теплые чувства.', tip: 'Любовь спасет мир 🥰' };
  else if (lowerText.match(/ура|excited|hyped|жду не дождусь/)) 
    result = { emotion: 'hyped', emoji: '🤩', intensity: 100, color: '#FEF08A', color2: '#FDE047', color3: '#FACC15', reasoning: 'Радостное ожидание.', tip: 'Это будет круто! 🤩' };
  else if (lowerText.match(/бесит|angry|mad|ненавижу/)) 
    result = { emotion: 'angry', emoji: '😠', intensity: 90, color: '#FECACA', color2: '#FCA5A5', color3: '#F87171', reasoning: 'Гнев или раздражение.', tip: 'Выпусти пар, но не давай злости победить 😤' };
  else if (lowerText.match(/груст|sad|bad|обидно|плачу/)) 
    result = { emotion: 'sad', emoji: '😢', intensity: 70, color: '#BFDBFE', color2: '#93C5FD', color3: '#60A5FA', reasoning: 'Грусть или печаль.', tip: 'Плакать — это нормально. Завтра станет легче 🫂' };
  else if (lowerText.match(/рад|happy|good|отлично|супер/)) 
    result = { emotion: 'happy', emoji: '😊', intensity: 80, color: '#BBF7D0', color2: '#86EFAC', color3: '#4ADE80', reasoning: 'Положительные эмоции.', tip: 'Отличное настроение! Так держать 😊' };

  result.feedQuality = estimateFeedQuality(text);
  return result;
};

function weeklySummaryFallback(posts, lang) {
  const emotions = posts.map((p) => p.emotion || 'neutral');
  const counts = {};
  emotions.forEach((e) => {
    counts[e] = (counts[e] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const n = posts.length;
  const combined = posts
    .map((p) => (p.text || '').replace(/\s+/g, ' ').trim())
    .join(' ')
    .slice(0, 400)
    .toLowerCase();
  const hasWork = /работ|офис|начальник|deadline|проект|work|boss|job/i.test(combined);
  const hasRel = /друг|семь|парен|девушк|мам|пап|любов|friend|family|mom|dad/i.test(combined);
  const themeHint =
    lang === 'en'
      ? [hasWork && 'work stress', hasRel && 'relationships'].filter(Boolean).join(', ')
      : [hasWork && 'работа/нагрузка', hasRel && 'отношения'].filter(Boolean).join(', ');
  if (lang === 'en') {
    let line = `Over the week (${n} posts), themes include ${themeHint || 'everyday ups and downs'}.`;
    if (top) line += ` Automated mood tags most often: ${top[0]}${second ? `, then ${second[0]}` : ''}.`;
    return line;
  }
  let line = `За неделю (${n} публ.): в текстах заметны ${themeHint || 'бытовые перепады'}.`;
  if (top) line += ` По авто-тегам чаще «${top[0]}»${second ? `, также «${second[0]}»` : ''}.`;
  return line;
}

function parseWeeklySummaryJson(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  const o = JSON.parse(s);
  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  if (!summary) return '';
  return summary.length > 500 ? summary.slice(0, 497) + '…' : summary;
}

function weeklySummarySystemPrompt(langName) {
  return `You write a short weekly reflection for a mood journal app.

INPUT FORMAT: Lines are posts from the LAST 7 DAYS only:
[YYYY-MM-DD] (automated_emotion_tag) full post text

YOUR JOB (content-first):
1. Read the POST TEXT as the PRIMARY evidence. Infer what the person talks about: situations, worries, wins, relationships, work, health, plans, self-talk—only from their actual words.
2. The (automated_emotion_tag) is a rough machine guess—use it only as a light hint. Do NOT write a report that mainly lists or paraphrases emotion labels (e.g. "first anxious then happy"). Instead, synthesize what the week was about for them as a person.
3. Write 2–3 sentences, max ~380 characters: reflective, warm, non-judgmental. No medical or psychiatric diagnosis. No "you have depression/anxiety disorder".
4. If posts contradict each other, acknowledge nuance (e.g. mixed week, tension vs relief)—still grounded in what they wrote.
5. Output language: ${langName} only.

Respond with ONLY valid JSON: {"summary":"..."}`;
}

/**
 * @param {Array<{ text: string, emotion?: string, emoji?: string, createdAt?: Date }>} posts - last 7 days, newest first
 * @param {'ru'|'en'} lang - output language (profile owner's preference)
 */
const summarizeWeeklyMoodFallback = async (posts, lang) => {
  if (!posts || posts.length === 0) return '';

  const groqKeys = (process.env.AI_API_KEYS || process.env.AI_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && k !== 'your_ai_api_key_here');

  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  /** @type {'auto'|'gemini'|'groq'} */
  const primary = (process.env.AI_WEEKLY_PRIMARY || 'auto').toLowerCase();
  // Override if your AI Studio project only exposes certain IDs, e.g. gemini-1.5-flash
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const lines = posts.slice(0, 60).map((p) => {
    const d = p.createdAt ? new Date(p.createdAt) : new Date();
    const day = d.toISOString().slice(0, 10);
    const em = p.emotion || 'neutral';
    const snippet = (p.text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    return `[${day}] (${em}) ${snippet}`;
  });

  const bundle = lines.join('\n');
  const langName = lang === 'en' ? 'English' : 'Russian';
  const systemPrompt = weeklySummarySystemPrompt(langName);
  const userBlock = `Posts (newest lines may appear first):\n${bundle}`;

  const tryGemini = async () => {
    if (!geminiKey) return '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      geminiModel
    )}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userBlock }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('summarizeWeeklyMood Gemini HTTP:', res.status, err.slice(0, 200));
      return '';
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw || typeof raw !== 'string') return '';
    try {
      return parseWeeklySummaryJson(raw);
    } catch (e) {
      console.error('summarizeWeeklyMood Gemini JSON:', e.message);
      return '';
    }
  };

  const tryGroq = async () => {
    for (const apiKey of groqKeys) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userBlock },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 280,
            temperature: 0.5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data.choices[0].message.content.trim();
          const summary = parseWeeklySummaryJson(raw);
          if (summary) return summary;
        }
      } catch (e) {
        console.error('summarizeWeeklyMood Groq error:', e.message);
      }
    }
    return '';
  };

  let out = '';
  if (primary === 'gemini') {
    out = await tryGemini();
    if (!out) out = await tryGroq();
  } else if (primary === 'groq') {
    out = await tryGroq();
    if (!out) out = await tryGemini();
  } else {
    // auto: prefer Gemini if key is set (Google AI Studio), else Groq
    if (geminiKey) {
      out = await tryGemini();
    }
    if (!out) {
      out = await tryGroq();
    }
  }

  return out || weeklySummaryFallback(posts, lang);
};

const analyzeEmotion = async (text, isTipOnly = false) => {
  if (isTipOnly) {
    const data = await postPythonMood('/tip', { text });
    if (data && typeof data.tip === 'string' && data.tip.trim()) {
      return { tip: data.tip };
    }
    return analyzeEmotionFallback(text, true);
  }

  const data = await postPythonMood('/analyze', { text });
  const coerced = coercePythonAnalysis(data, text);
  if (coerced) return coerced;
  return analyzeEmotionFallback(text, false);
};

const summarizeWeeklyMood = async (posts, lang) => {
  const usePythonWeekly = String(process.env.PYTHON_MOOD_WEEKLY || '').toLowerCase() === 'true';
  if (!usePythonWeekly) return summarizeWeeklyMoodFallback(posts, lang);

  const data = await postPythonMood('/weekly-summary', { posts, lang });
  if (data && typeof data.summary === 'string' && data.summary.trim()) {
    return data.summary.trim().slice(0, 500);
  }
  return summarizeWeeklyMoodFallback(posts, lang);
};

const pickMoodSong = async ({ emotion, text, lang }) => {
  const data = await postPythonMood('/api/mood-song/pick', { emotion, text, lang });
  return assertSafeMoodSongUrls(coerceMoodSong(data));
};

module.exports = {
  analyzeEmotion,
  summarizeWeeklyMood,
  pickMoodSong,
  suggestMoodSongs,
  normalizeClientMoodSong,
};
