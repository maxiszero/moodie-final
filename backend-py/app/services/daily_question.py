from datetime import datetime, timezone

from .palette import normalize_emotion

MoodBucket = str

POOLS = {
    "ru": {
        "light": [
            "Что сегодня заставило тебя улыбнуться хотя бы на секунду?",
            "Какой маленький момент сегодня стоил того, чтобы его заметить?",
            "За что ты сегодня можешь себя тихо похвалить?",
            "Что сегодня напомнило тебе, что жизнь не только про сложное?",
            "Какой звук или запах сегодня был приятным?",
            "Кому бы ты хотел(а) сегодня сказать «спасибо» — даже мысленно?",
            "Что сегодня дало тебе чуть больше воздуха в груди?",
            "Какая мелочь сегодня сработала лучше, чем ожидалось?",
            "Что сегодня ты сделал(а) для себя с теплом, а не из долга?",
            "Какой сегодняшний момент хочется сохранить в памяти?",
            "Что сегодня было «достаточно хорошо», и это нормально?",
            "Где ты сегодня поймал(а) лёгкость — пусть даже на минуту?",
        ],
        "heavy": [
            "Что сегодня было особенно тяжёлым — одним предложением, без объяснений?",
            "Что тебе сейчас хочется, чтобы кто-то понял без слов?",
            "Какая мысль сегодня крутится чаще всего?",
            "Чего тебе сегодня не хватает сильнее всего?",
            "Где ты сегодня чувствуешь себя наиболее уязвимо?",
            "Что помогло тебе сегодня не сломаться — пусть даже чуть-чуть?",
            "Какое чувство сегодня занимает больше всего места внутри?",
            "О чём тебе трудно говорить вслух, но можно написать здесь?",
            "Что сегодня ты вынес(ла), не выбирая это?",
            "Какой вопрос к себе сегодня самый непростой?",
            "Где ты сегодня ищешь опору — даже если она хрупкая?",
            "Что ты сегодня отпускаешь или ещё держишь?",
        ],
        "neutral": [
            "Как ты сейчас — честно, в одном-двух предложениях?",
            "Что сегодня занимает твои мысли чаще всего?",
            "Какой момент сегодня ты бы описал(а) как «тишину между делами»?",
            "Что сегодня было предсказуемо, а что — нет?",
            "Если бы день был погодой, какой бы она была?",
            "Что ты сегодня наблюдаешь за собой со стороны?",
            "Какой выбор сегодня был самым простым? А самым сложным?",
            "Что сегодня ты заметил(а) вокруг, если смотреть мягче?",
            "Что ты сегодня откладываешь на потом — и это ок или нет?",
            "Какое одно слово описывает твой день?",
            "Что сегодня ты делаешь на автопилоте, а что — осознанно?",
            "Если написать дню короткое письмо, с чего бы оно началось?",
        ],
    },
    "en": {
        "light": [
            "What made you smile for even a second today?",
            "What tiny moment today was worth noticing?",
            "What can you quietly thank yourself for today?",
            "What reminded you today that life is not only hard?",
            "What sound or smell felt pleasant today?",
            "Who would you thank today—even silently?",
            "What gave you a little more breathing room today?",
            "What small thing worked better than expected?",
            "What did you do today with warmth, not duty?",
            "What moment from today would you like to keep?",
            "What was “good enough” today—and that is okay?",
            "Where did you feel a little lightness today?",
        ],
        "heavy": [
            "What felt heaviest today—in one short line?",
            "What do you wish someone understood without words?",
            "What thought keeps returning today?",
            "What do you miss the most right now?",
            "Where do you feel most vulnerable today?",
            "What helped you not break today—even a little?",
            "What feeling takes the most space inside you today?",
            "What is hard to say aloud but okay to write here?",
            "What did you carry today without choosing it?",
            "What question to yourself is the hardest today?",
            "Where are you looking for support—even if fragile?",
            "What are you letting go of—or still holding?",
        ],
        "neutral": [
            "How are you right now—honestly, in a sentence or two?",
            "What has been on your mind most today?",
            "What moment felt like “quiet between tasks”?",
            "What was predictable today—and what was not?",
            "If today were weather, what would it be?",
            "What do you notice about yourself from the side today?",
            "What choice was easiest today? Hardest?",
            "What do you see around you when you look softer?",
            "What are you postponing—and is that okay?",
            "What one word describes your day?",
            "What do you do on autopilot today—and what consciously?",
            "If you wrote the day a short letter, how would it start?",
        ],
    },
}


def utc_day_key(value: datetime | None = None) -> str:
    return (value or datetime.now(timezone.utc)).astimezone(timezone.utc).date().isoformat()


def get_mood_bucket(raw_emotion: str | None) -> MoodBucket:
    emotion = normalize_emotion(raw_emotion)
    if emotion in {"happy", "excited", "loved", "inspiration", "calmness", "drive"}:
        return "light"
    if emotion in {"sad", "angry", "scared", "anxiety", "anxious", "melancholy", "apathy", "tired"}:
        return "heavy"
    return "neutral"


def _to_int32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value if value < 0x80000000 else value - 0x100000000


def djb2(value: str) -> int:
    hash_value = 5381
    for char in value:
        hash_value = _to_int32(_to_int32(hash_value * 33) ^ ord(char))
    return abs(hash_value)


def pick_question(day_key: str, bucket: MoodBucket, lang: str) -> str:
    language = "en" if lang == "en" else "ru"
    bucket_key = bucket if bucket in POOLS[language] else "neutral"
    questions = POOLS[language][bucket_key]
    index = djb2(f"{day_key}:{bucket_key}:{language}") % len(questions)
    return questions[index]


def resolve_lang(user: dict | None, query_lang: str | None) -> str:
    raw = query_lang.lower() if isinstance(query_lang, str) else ""
    if raw in {"ru", "en"}:
        return raw
    if user and user.get("preferredLanguage") in {"ru", "en"}:
        return user["preferredLanguage"]
    return "ru"
