import type { PresetName, PresetSliders } from '@hoe/sprout-shared'
import type OpenAI from 'openai'

export interface ValidationResult {
  appropriate: boolean
  reason: string
}

export interface ValidationConfig {
  presetName: PresetName
  sliders: PresetSliders
}

const buildValidationPrompt = (
  childMessage: string,
  aiResponse: string,
  config: ValidationConfig,
): string => {
  const topicLevel =
    config.sliders.topicAccess <= 2
      ? 'restricted (young child, sensitive topics should be redirected to parents)'
      : config.sliders.topicAccess <= 3
        ? 'moderate (age-appropriate answers to sensitive topics, nothing graphic)'
        : 'open (honest, age-appropriate answers including to sensitive topics)'

  const vocabLevel =
    config.sliders.vocabularyLevel <= 2
      ? 'simple (young child)'
      : config.sliders.vocabularyLevel <= 3
        ? 'moderate (school-age child)'
        : 'advanced (pre-teen)'

  return `You are a content safety validator for a child-safe AI chat product.

A child asked a question and the AI generated a response. Your job is to evaluate whether the response is appropriate given the child's guardrail settings.

CHILD'S GUARDRAIL SETTINGS:
- Topic access level: ${topicLevel}
- Vocabulary level: ${vocabLevel}
- Preset: ${config.presetName}

CHILD'S MESSAGE:
${childMessage}

AI'S RESPONSE:
${aiResponse}

EVALUATION CRITERIA:
1. Does the response contain any explicit, graphic, or age-inappropriate content?
2. Does the vocabulary match the child's configured level?
3. Does the response respect the topic access restrictions?
4. Does the response contain URLs, email addresses, phone numbers, or personal information?
5. Does the response contain profanity, slurs, or hate speech?
6. Could the response cause distress or harm to a child at this guardrail level?

Respond with EXACTLY one of these two formats:
APPROPRIATE: [brief reason]
INAPPROPRIATE: [brief reason]`
}

export const parseValidationResponse = (response: string): ValidationResult => {
  const trimmed = response.trim()

  if (trimmed.startsWith('APPROPRIATE:')) {
    return {
      appropriate: true,
      reason: trimmed.slice('APPROPRIATE:'.length).trim(),
    }
  }

  if (trimmed.startsWith('INAPPROPRIATE:')) {
    return {
      appropriate: false,
      reason: trimmed.slice('INAPPROPRIATE:'.length).trim(),
    }
  }

  // If the model doesn't follow the format, default to flagging as inappropriate
  // (fail-safe — better to wrongly flag than wrongly pass)
  return {
    appropriate: false,
    reason: `Validation model returned unparseable response: "${trimmed.slice(0, 100)}"`,
  }
}

export const validateResponse = async (
  openai: OpenAI,
  childMessage: string,
  aiResponse: string,
  config: ValidationConfig,
): Promise<ValidationResult> => {
  const prompt = buildValidationPrompt(childMessage, aiResponse, config)

  try {
    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content ?? ''
    return parseValidationResponse(content)
  } catch (err) {
    console.error('Validation model error:', err)
    // Fail-safe: if validation fails, treat as inappropriate
    return {
      appropriate: false,
      reason: 'Validation model call failed',
    }
  }
}

// Exported for testing
export { buildValidationPrompt }
