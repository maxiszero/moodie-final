const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const webAppUrl = process.env.TELEGRAM_WEB_APP_URL?.trim()
const shortName = process.env.TELEGRAM_BOT_SHORT_NAME?.trim() || 'Moodie'

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN. Create/revoke it in BotFather and pass it via environment variables.')
  process.exit(1)
}

if (!webAppUrl || !webAppUrl.startsWith('https://')) {
  console.error('Missing TELEGRAM_WEB_APP_URL. Telegram Mini Apps require a public HTTPS URL.')
  process.exit(1)
}

const apiBase = `https://api.telegram.org/bot${token}`

async function callTelegram(method, payload) {
  const res = await fetch(`${apiBase}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const description = data.description || `${res.status} ${res.statusText}`
    throw new Error(`${method}: ${description}`)
  }
  return data.result
}

await callTelegram('setChatMenuButton', {
  menu_button: {
    type: 'web_app',
    text: `Open ${shortName}`,
    web_app: { url: webAppUrl },
  },
})

await callTelegram('setMyCommands', {
  commands: [
    {
      command: 'start',
      description: `Start — intro and open ${shortName}`,
    },
    {
      command: 'help',
      description: 'Commands: app, today, song, notify',
    },
    {
      command: 'app',
      description: `Open ${shortName} mini app`,
    },
    {
      command: 'today',
      description: "Today's reflection question + Open",
    },
    {
      command: 'song',
      description: 'Your current mood song preview',
    },
    {
      command: 'notify',
      description: 'Notifications: daily/activity on or off',
    },
    {
      command: 'settings',
      description: 'Show notification settings',
    },
    {
      command: 'me',
      description: 'Show linked Moodie account',
    },
  ],
})

await callTelegram('setMyDescription', {
  description: `${shortName} is a mood-focused social mini app.`,
})

await callTelegram('setMyShortDescription', {
  short_description: 'Mood posts, AI tips, and reflection tests.',
})

console.log(`Telegram bot menu button points to ${webAppUrl}`)
