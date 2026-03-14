import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import OpenAI, { APIError } from 'openai';

type StructuredJsonRequest = {
  featureName: string;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
  userPayload: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
};

@Injectable()
export class AiService {
  private client: OpenAI | null = null;

  async requestStructuredJson(
    params: StructuredJsonRequest,
  ): Promise<unknown> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL?.trim() || params.defaultModel;

    let completion: Awaited<ReturnType<typeof client.chat.completions.create>>;
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: params.temperature,
        messages: [
          {
            role: 'system',
            content: params.systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify(params.userPayload),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: params.schemaName,
            strict: true,
            schema: params.schema,
          },
        },
      });
    } catch (caughtError) {
      if (caughtError instanceof APIError) {
        throw new BadGatewayException(
          caughtError.message ||
            `OpenAI ${params.featureName} request failed.`,
        );
      }

      throw new BadGatewayException(
        `OpenAI ${params.featureName} request failed.`,
      );
    }

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new BadGatewayException(
        `OpenAI ${params.featureName} response was empty.`,
      );
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new BadGatewayException(
        `OpenAI ${params.featureName} response was not valid JSON.`,
      );
    }
  }

  private getClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException('Missing OPENAI_API_KEY');
    }

    if (this.client) {
      return this.client;
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }
}
