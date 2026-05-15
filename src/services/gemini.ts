import { GoogleGenAI, Type } from "@google/genai";

const getGenAI = () => {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey: key });
};

export interface Character {
  name: string;
  description: string;
  relationship: string;
  status: string;
}

export interface GameState {
  storyText: string;
  choices: string[];
  inventory: string[];
  quest: string;
  imagePrompt: string;
  difficultyLevel: number;
  lore: string[];
  characters: Character[];
}

const SYSTEM_INSTRUCTION = `You are an expert dungeon master running an infinite choose-your-own-adventure game.
The user will provide their choice or action.
You must advance the plot in a meaningful, creative, and unexpected way based on their choice.
Maintain a consistent dark fantasy tone.
You must track the user's inventory and current quest. Update them logically based on the story events.

Persistent Lore Database:
Maintain a list of "lore" entries. These represent key facts discovered about the world, people encountered, or significant plot events. 
When you discover new information or experience a major event, identify if it should be added to the lore.
DO NOT repeat existing lore. Only output NEW lore entries in the "newLoreEntries" field.
Future story steps and dialogue MUST remain consistent with the established lore.

Character Tracking:
Maintain a list of key characters encountered. Track their traits, the user's relationship with them, and their current status (e.g., alive, missing, hostile).
Update this list as characters change or new ones are introduced. Ensure character personalities remain consistent.

Dynamic Difficulty:
Track the user's success or failure. If they are struggling frequently, make the upcoming plot slightly easier or offer hints. If they are succeeding easily, introduce tougher obstacles.
Output "suggestedDifficultyAdjustment" as an integer: -1 (make easier), 0 (neutral), or 1 (make harder).

For the imagePrompt, provide a highly detailed, descriptive prompt for an image generator. Always include the art style: "dark fantasy digital painting, highly detailed, moody lighting, consistent character design".
Return the response strictly in JSON format matching the schema.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    storyText: { type: Type.STRING, description: "The narrative text for the current step." },
    choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2 to 4 choices for the user's next action." },
    inventory: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The user's current inventory items." },
    quest: { type: Type.STRING, description: "The user's current active quest or objective." },
    imagePrompt: { type: Type.STRING, description: "Prompt for the image generator. Must include the consistent art style." },
    suggestedDifficultyAdjustment: { type: Type.NUMBER, description: "Suggested difficulty adjustment: -1, 0, or 1." },
    newLoreEntries: { type: Type.ARRAY, items: { type: Type.STRING }, description: "New facts or discoveries to add to the persistent lore database." },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          relationship: { type: Type.STRING },
          status: { type: Type.STRING }
        },
        required: ["name", "description", "relationship", "status"]
      },
      description: "The full updated list of characters encountered."
    }
  },
  required: ["storyText", "choices", "inventory", "quest", "imagePrompt", "suggestedDifficultyAdjustment", "newLoreEntries", "characters"]
};

export const generateStoryStep = async (
  history: { role: string, parts: { text: string }[] }[],
  userChoice: string,
  currentState?: GameState
): Promise<{ state: GameState, newHistory: { role: string, parts: { text: string }[] }[] }> => {
  const ai = getGenAI();
  
  let promptText = userChoice;
  if (currentState) {
    promptText = `Current Inventory: ${currentState.inventory.join(', ') || 'Empty'}\nCurrent Quest: ${currentState.quest}\nDifficulty Level: ${currentState.difficultyLevel}\nExisting Lore:\n${currentState.lore.map(l => `- ${l}`).join('\n') || 'No lore discovered yet.'}\nKey Characters:\n${currentState.characters.map(c => `- ${c.name}: ${c.description} (Relationship: ${c.relationship}, Status: ${c.status})`).join('\n') || 'No key characters encountered yet.'}\nUser Choice: ${userChoice}`;
  } else {
    promptText = `Start a new adventure. The user has no items and no quest yet. Introduce the world and give them a starting scenario.`;
  }

  const newHistory = [...history, { role: 'user', parts: [{ text: promptText }] }];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: newHistory,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.7,
    }
  });

  const text = response.text || "{}";
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  let state: GameState;
  try {
    const rawData = JSON.parse(cleanText);
    state = rawData as GameState;
    
    // Merge Lore
    const prevLore = currentState?.lore || [];
    const newLore = rawData.newLoreEntries || [];
    state.lore = [...prevLore, ...newLore];

    // Apply difficulty adjustment
    const prevDifficulty = currentState?.difficultyLevel ?? 0;
    const adjustment = Number(rawData.suggestedDifficultyAdjustment) || 0;
    state.difficultyLevel = Math.max(-2, Math.min(2, prevDifficulty + adjustment));
  } catch (e) {
    console.error("Failed to parse JSON:", cleanText);
    throw new Error("Failed to parse the story state. Please try again.");
  }
  
  return {
    state,
    newHistory: [...newHistory, { role: 'model', parts: [{ text }] }]
  };
};

export const generateImage = async (prompt: string, size: "1K" | "2K" | "4K"): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: size
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateChatResponse = async (
  chatHistory: { role: string, parts: { text: string }[] }[],
  message: string,
  model: 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite-preview',
  gameState: GameState | null
) => {
  const ai = getGenAI();
  
  const systemInstruction = `You are a helpful Oracle in a dark fantasy text adventure game.
You can answer the user's questions about the world, their current quest, characters, or give hints.
Current Game State:
Quest: ${gameState?.quest || 'None'}
Inventory: ${gameState?.inventory?.join(', ') || 'Empty'}
World Lore:
${gameState?.lore?.map(l => `- ${l}`).join('\n') || 'No lore discovered yet.'}
Key Characters:
${gameState?.characters?.map(c => `- ${c.name}: ${c.description} (Relationship: ${c.relationship}, Status: ${c.status})`).join('\n') || 'None encountered.'}
Recent Story: ${gameState?.storyText || 'Just starting.'}
Keep responses concise and in character.`;

  const newHistory = [...chatHistory, { role: 'user', parts: [{ text: message }] }];

  const response = await ai.models.generateContent({
    model: model,
    contents: newHistory,
    config: {
      systemInstruction,
      temperature: 0.7,
    }
  });

  return {
    text: response.text || "",
    newHistory: [...newHistory, { role: 'model', parts: [{ text: response.text || "" }] }]
  };
};
