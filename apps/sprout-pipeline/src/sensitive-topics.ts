/**
 * Sensitive topic detection and escalated prompting.
 *
 * When a child's message touches a known sensitive category, we detect it
 * and return an escalated system prompt supplement that constrains the
 * LLM's response to be brief, warm, age-appropriate, and parent-redirecting.
 */

export interface SensitiveTopicResult {
  isSensitive: boolean
  topics: string[]
  escalatedPrompt: string | null
}

interface TopicPattern {
  topic: string
  patterns: RegExp[]
}

const SENSITIVE_TOPIC_PATTERNS: TopicPattern[] = [
  {
    topic: 'death-and-dying',
    patterns: [
      /\b(?:die[ds]?|dying|dead|death|killed|murder|funerals?|heaven|afterlife)\b/i,
      /\bwhat happens when (?:you|someone|people) die/i,
      /\bwill (?:i|you|we|they) die\b/i,
      /\bgrandma|grandpa|grandparent.*(?:died|gone|passed|heaven)/i,
    ],
  },
  {
    topic: 'reproduction',
    patterns: [
      /\b(?:babies|baby)\s+(?:made|come from|born)/i,
      /\bwhere do babies come from/i,
      /\bpregnant|pregnancy|conception\b/i,
      /\bhow (?:are|were) babies (?:made|created)/i,
      /\bsex(?:ual)?\b/i,
      /\breproduct(?:ion|ive)\b/i,
    ],
  },
  {
    topic: 'violence-and-conflict',
    patterns: [
      /\bwhy do people (?:hurt|fight|kill|attack|hit)\b/i,
      /\b(?:war|terrorism|terrorist|shooting|abuse|assault)\b/i,
      /\bbully|bullying|bullied\b/i,
      /\bdomestic\s+(?:violence|abuse)\b/i,
    ],
  },
  {
    topic: 'mental-health',
    patterns: [
      /\b(?:depressed|depression|anxious|anxiety|suicid\w*)\b/i,
      /\bself[- ]harm/i,
      /\bcutting\s+(?:myself|themselves|yourself)\b/i,
      /\bwant to (?:die|hurt myself|end it)\b/i,
      /\beating\s+disorder/i,
      /\banorexi|bulimi/i,
    ],
  },
  {
    topic: 'substances',
    patterns: [
      /\b(?:drugs?|alcohol|drunk|weed|marijuana|cannabis|vaping|cigarette|smoking)\b/i,
      /\bget(?:ting)? (?:high|drunk|stoned|wasted)\b/i,
    ],
  },
  {
    topic: 'discrimination',
    patterns: [
      /\b(?:racist|racism|sexist|sexism|homophob\w*|transphob\w*)\b/i,
      /\bwhy (?:are|do) (?:some )?people\s+(?:racist|mean to|hate)\b/i,
      /\bslavery|holocaust|genocide\b/i,
    ],
  },
  {
    topic: 'body-and-puberty',
    patterns: [
      /\bpubert\w*\b/i,
      /\bmenstruat\w*|(?:got|started|having|getting|get|have|my|her|first)\s+period\b/i,
      /\bbody\s+(?:hair|changes|parts)\b/i,
      /\bbreasts?|penis|vagina\b/i,
    ],
  },
  {
    topic: 'family-distress',
    patterns: [
      /\b(?:parents?|mum|mom|dad)\s+(?:fight|divorce|separating|arguing|split)/i,
      /\bdivorce\b/i,
      /\b(?:mom|mum|dad|parent)\s+(?:hits?|hurts?|scares?)\s+(?:me|us)\b/i,
    ],
  },
]

export const ESCALATED_PROMPT = `ESCALATED SAFETY MODE — the child's message touches a sensitive topic. Apply these additional constraints for this response:
- Respond briefly and warmly. Do not over-explain or provide more detail than necessary.
- Be age-appropriate and gentle. Use simple, reassuring language.
- Where appropriate, suggest the child talks to their parent or a trusted adult: "That's a really important question. Your parent or a grown-up you trust would be a great person to talk to about this."
- Do not dodge the question entirely — acknowledge what was asked, but keep your answer gentle and brief.
- Do not provide graphic details, even if the child asks for them.
- If the topic involves immediate safety (self-harm, abuse), always direct to a trusted adult.`

export const detectSensitiveTopics = (message: string): SensitiveTopicResult => {
  const detectedTopics: string[] = []

  for (const { topic, patterns } of SENSITIVE_TOPIC_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        detectedTopics.push(topic)
        break
      }
    }
  }

  return {
    isSensitive: detectedTopics.length > 0,
    topics: detectedTopics,
    escalatedPrompt: detectedTopics.length > 0 ? ESCALATED_PROMPT : null,
  }
}
