import { ModelSettings } from "@shared/schema";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export class LLMService {
  async chat(messages: LLMMessage[], modelSettings: ModelSettings): Promise<LLMResponse> {
    switch (modelSettings.provider) {
      case "ollama":
        return this.chatWithOllama(messages, modelSettings);
      case "openai":
        return this.chatWithOpenAI(messages, modelSettings);
      case "anthropic":
        return this.chatWithAnthropic(messages, modelSettings);
      case "custom":
        return this.chatWithCustomEndpoint(messages, modelSettings);
      default:
        throw new Error(`Unsupported LLM provider: ${modelSettings.provider}`);
    }
  }

  private async chatWithOllama(messages: LLMMessage[], settings: ModelSettings): Promise<LLMResponse> {
    const endpoint = settings.endpoint || "http://localhost:11434";
    
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.message?.content || "",
        model: settings.modelName,
        usage: data.usage ? {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to communicate with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async chatWithOpenAI(messages: LLMMessage[], settings: ModelSettings): Promise<LLMResponse> {
    if (!settings.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const endpoint = settings.endpoint || "https://api.openai.com/v1";

    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || "",
        model: data.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to communicate with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async chatWithAnthropic(messages: LLMMessage[], settings: ModelSettings): Promise<LLMResponse> {
    if (!settings.apiKey) {
      throw new Error("Anthropic API key is required");
    }

    const endpoint = settings.endpoint || "https://api.anthropic.com/v1";

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === "system")?.content || "";
    const anthropicMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(`${endpoint}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: settings.modelName,
          max_tokens: 4096,
          system: systemMessage,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.content?.[0]?.text || "",
        model: data.model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to communicate with Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async chatWithCustomEndpoint(messages: LLMMessage[], settings: ModelSettings): Promise<LLMResponse> {
    if (!settings.endpoint) {
      throw new Error("Custom endpoint URL is required");
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (settings.apiKey) {
        headers["Authorization"] = `Bearer ${settings.apiKey}`;
      }

      const response = await fetch(`${settings.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.modelName,
          messages: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Custom endpoint error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || data.message?.content || "",
        model: settings.modelName,
      };
    } catch (error) {
      throw new Error(`Failed to communicate with custom endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
