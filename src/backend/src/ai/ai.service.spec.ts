import { InternalServerErrorException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
      return;
    }

    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('fails clearly when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const service = new AiService();

    await expect(
      service.requestStructuredJson({
        featureName: 'planner',
        defaultModel: 'gpt-4.1-mini',
        temperature: 0.4,
        systemPrompt: 'test',
        userPayload: { ok: true },
        schemaName: 'test_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
