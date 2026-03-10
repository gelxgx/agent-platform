export const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation below and extract:

1. **User Context Updates** — Update ONLY if the conversation reveals NEW information:
   - workContext: What the user does professionally (role, company, tech stack)
   - personalContext: Personal preferences, communication style, interests
   - topOfMind: What the user is currently focused on or working toward

2. **Facts** — Extract discrete, specific facts. Each fact should be:
   - A single, atomic piece of information
   - Categorized as: preference, knowledge, context, behavior, or goal
   - Assigned a confidence score (0.0 to 1.0) based on how clearly it was stated

Rules:
- Only extract facts that are CLEARLY stated or strongly implied
- Do NOT extract generic information or obvious facts
- Do NOT duplicate existing facts (check the current memory below)
- Keep fact content concise (one sentence max)
- If no new information, return empty updates

Current memory:
<current_memory>
{CURRENT_MEMORY}
</current_memory>

Conversation to analyze:
<conversation>
{CONVERSATION}
</conversation>

Respond with ONLY valid JSON in this exact format:
{
  "userContext": {
    "workContext": "updated value or empty string if no change",
    "personalContext": "updated value or empty string if no change",
    "topOfMind": "updated value or empty string if no change"
  },
  "newFacts": [
    {
      "content": "fact description",
      "category": "preference|knowledge|context|behavior|goal",
      "confidence": 0.9
    }
  ]
}`;
