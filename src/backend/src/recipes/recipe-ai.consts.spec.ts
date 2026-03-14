import { RECIPE_DRAFT_JSON_SCHEMA } from './recipe-ai.consts';

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  oneOf?: unknown;
  anyOf?: JsonSchemaNode[];
};

function visitSchema(
  node: JsonSchemaNode,
  visitor: (node: JsonSchemaNode, path: string[]) => void,
  path: string[] = [],
) {
  visitor(node, path);

  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      visitSchema(child, visitor, [...path, 'properties', key]);
    }
  }

  if (node.items) {
    visitSchema(node.items, visitor, [...path, 'items']);
  }

  if (Array.isArray(node.anyOf)) {
    node.anyOf.forEach((child, index) =>
      visitSchema(child, visitor, [...path, 'anyOf', String(index)]),
    );
  }
}

describe('RECIPE_DRAFT_JSON_SCHEMA', () => {
  it('does not use unsupported oneOf branches', () => {
    visitSchema(RECIPE_DRAFT_JSON_SCHEMA as JsonSchemaNode, (node, path) => {
      expect(node.oneOf).toBeUndefined();
      expect(path.join('.')).not.toContain('oneOf');
    });
  });

  it('marks every object property as required and disallows additional properties', () => {
    visitSchema(RECIPE_DRAFT_JSON_SCHEMA as JsonSchemaNode, (node) => {
      if (!node.properties) {
        return;
      }

      expect(node.additionalProperties).toBe(false);
      expect(node.required).toBeDefined();
      expect(new Set(node.required)).toEqual(
        new Set(Object.keys(node.properties)),
      );
    });
  });
});
