import OpenAI from 'openai'
import { z } from 'zod'

const ExtractSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  policy: z.string(),
  vehicle: z.string().nullable(),
  plate: z.string().nullable(),
  city: z.string().nullable(),
})

export type AgentToolName =
  | 'click'
  | 'type'
  | 'wait_human'
  | 'extract_fields'
  | 'abort'
  | 'done'

export type AgentPlan = {
  tool: AgentToolName
  selector?: string
  text?: string
  reason: string
  reasonCode?: 'otp' | 'captcha' | 'password' | 'consent' | 'other'
  extract?: z.infer<typeof ExtractSchema>
}

const SYSTEM = `You are a read-only browser import agent for a Moroccan insurance broker desk (Med Assurance).
You help a human broker import visible policy fields from an authorised TRT Broker or OuiAssur client portal.
Rules:
- Only navigate/read within the current portal. Never purchase, pay, change a contract, submit a claim, or contact a provider.
- Registration and login are allowed only with explicit human authorisation; the human enters passwords, OTP, and CAPTCHA.
- When you see a password field, OTP, CAPTCHA, or consent that needs the human, call wait_human.
- When policy/client fields are visible, call extract_fields with structured JSON.
- If the page is unexpected or identity is ambiguous, call abort.
- Prefer CSS selectors from the accessibility snapshot text.
Respond with a single JSON object only:
{"tool":"click"|"type"|"wait_human"|"extract_fields"|"abort"|"done","selector?":"...","text?":"...","reason":"...","reasonCode?":"otp"|"captcha"|"password"|"consent"|"other","extract?":{"name":"...","phone":null,"policy":"...","vehicle":null,"plate":null,"city":null}}`

export function createDeepseekClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com',
  })
}

export async function planNextAction(input: {
  source: string
  url: string
  snapshot: string
  steps: string[]
}): Promise<AgentPlan> {
  const client = createDeepseekClient()
  if (!client) {
    return {
      tool: 'abort',
      reason: 'DEEPSEEK_API_KEY missing',
    }
  }
  const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
  const user = [
    `Source: ${input.source}`,
    `URL: ${input.url}`,
    `Recent steps: ${input.steps.slice(-8).join(' | ') || 'none'}`,
    'Accessibility snapshot (truncated):',
    input.snapshot.slice(0, 12000),
  ].join('\n')

  const res = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  })
  const raw = res.choices[0]?.message?.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { tool: 'abort', reason: 'model_json_parse_failed' }
  }
  const obj = parsed as Record<string, unknown>
  const tool = String(obj.tool ?? 'abort') as AgentToolName
  const allowed: AgentToolName[] = [
    'click',
    'type',
    'wait_human',
    'extract_fields',
    'abort',
    'done',
  ]
  if (!allowed.includes(tool)) {
    return { tool: 'abort', reason: `unknown_tool:${tool}` }
  }
  let extract: AgentPlan['extract']
  if (obj.extract) {
    const e = ExtractSchema.safeParse(obj.extract)
    if (e.success) extract = e.data
  }
  return {
    tool,
    selector: typeof obj.selector === 'string' ? obj.selector : undefined,
    text: typeof obj.text === 'string' ? obj.text : undefined,
    reason: typeof obj.reason === 'string' ? obj.reason : tool,
    reasonCode:
      obj.reasonCode === 'otp' ||
      obj.reasonCode === 'captcha' ||
      obj.reasonCode === 'password' ||
      obj.reasonCode === 'consent' ||
      obj.reasonCode === 'other'
        ? obj.reasonCode
        : undefined,
    extract,
  }
}
