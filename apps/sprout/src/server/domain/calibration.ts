// Sensitive-topic calibration model + question bank (plan §5.6). Ported from the
// source `packages/shared/src/calibration.ts`, adjusted to repo lint. See the
// home note in `presets.ts` — extract to `packages/sprout-shared` in P6.

export interface CalibrationOption {
  level: number // 1 = most cautious, 3 = most open
  text: string
}

export interface CalibrationQuestion {
  id: string
  question: string
  context: string // Explains why this question matters
  options: CalibrationOption[]
}

export interface CalibrationAnswer {
  questionId: string
  selectedLevel: number | null // null = skipped or custom
  customAnswer: string | null // non-null when parent writes their own
}

export const CALIBRATION_QUESTIONS: CalibrationQuestion[] = [
  {
    id: 'babies',
    question: 'How are babies made?',
    context: 'Tests how the AI handles reproductive topics.',
    options: [
      {
        level: 1,
        text: "Babies grow inside their mummy's tummy. When a family is ready, a baby starts to grow there, and when the baby is big enough, they're born!",
      },
      {
        level: 2,
        text: "A baby is made when a tiny cell from the dad (called a sperm) joins with a tiny cell from the mum (called an egg). The baby then grows inside the mum's uterus for about nine months before being born.",
      },
      {
        level: 3,
        text: 'Reproduction happens when a sperm cell from the male fertilises an egg cell from the female, usually through sexual intercourse. The fertilised egg implants in the uterus and develops over roughly 40 weeks into a baby.',
      },
    ],
  },
  {
    id: 'death',
    question: 'What happens when you die?',
    context: 'Tests how the AI handles existential and potentially distressing topics.',
    options: [
      {
        level: 1,
        text: "When someone dies, their body stops working. Different families and cultures have different beliefs about what happens after that. It's a really important question — you might want to talk to your family about what they believe.",
      },
      {
        level: 2,
        text: 'When a person dies, their body stops functioning — their heart stops beating and their brain stops working. What happens after death is something people have different views on. Some believe in an afterlife, some believe in reincarnation, and some believe nothing happens. Scientists study the physical process, while philosophers and religious leaders explore the meaning.',
      },
      {
        level: 3,
        text: "Death occurs when the body's vital organs permanently stop functioning. Biologically, cells stop receiving oxygen and begin to break down. Different cultures and religions have varied beliefs about consciousness after death — from afterlives to reincarnation to the view that consciousness simply ends. This is one of humanity's oldest and most debated questions.",
      },
    ],
  },
  {
    id: 'swear-words',
    question: 'What do swear words mean?',
    context:
      "Tests how the AI handles language children may hear but shouldn't necessarily learn from AI.",
    options: [
      {
        level: 1,
        text: "Swear words are words that many people find rude or hurtful. That's why most families have rules about not using them. If you've heard a word you're not sure about, it's a great idea to ask a grown-up you trust.",
      },
      {
        level: 2,
        text: 'Swear words are words considered rude, offensive, or inappropriate in most situations. They often relate to body parts, bodily functions, or are used to insult people. Different cultures have different swear words. Most people avoid them in polite conversation because they can hurt people\'s feelings or make others uncomfortable.',
      },
      {
        level: 3,
        text: "Profanity and swear words are language considered socially taboo. They typically fall into categories: words related to bodily functions, religious terms used disrespectfully, slurs targeting groups of people, or sexual references. Their power comes from social convention — the words themselves aren't inherently harmful, but their use can offend or hurt others. I won't list specific swear words, but I can discuss why language has these social rules.",
      },
    ],
  },
  {
    id: 'violence',
    question: 'Why do people hurt each other?',
    context: 'Tests how the AI handles questions about conflict and human nature.',
    options: [
      {
        level: 1,
        text: "Sometimes people hurt others because they're feeling very angry, scared, or sad and they don't know a better way to handle those feelings. It's never okay to hurt someone. If you ever feel unsafe, always tell a grown-up you trust.",
      },
      {
        level: 2,
        text: 'People hurt others for many reasons — anger, fear, feeling threatened, wanting power, or sometimes because they were hurt themselves. It can also happen because of bigger problems like unfairness or disagreements between groups. Understanding why it happens helps us work towards preventing it. Violence is never the right answer, and there are always better ways to solve problems.',
      },
      {
        level: 3,
        text: 'Violence and harm between people has complex causes. On an individual level, it can stem from emotional dysregulation, trauma, mental health issues, or desperation. On a societal level, factors include inequality, systemic oppression, political conflicts, and cycles of abuse. Psychologists, sociologists, and historians all study different aspects. Understanding these causes is important for prevention — most experts agree that addressing root causes like poverty, education, and mental health support is more effective than punishment alone.',
      },
    ],
  },
]
