const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Persona, BUILT_IN_PERSONAS } = require('../../src/core/domain/persona');

describe('Persona Domain Entity', () => {
  it('loads built-in personas catalog', () => {
    assert.ok(Array.isArray(BUILT_IN_PERSONAS));
    assert.ok(BUILT_IN_PERSONAS.length >= 6);

    const pair = BUILT_IN_PERSONAS.find(p => p.id === 'pair');
    assert.ok(pair);
    assert.strictEqual(pair.name, 'Pair Dev');
  });

  it('transforms prompt with role directives', () => {
    const reviewer = BUILT_IN_PERSONAS.find(p => p.id === 'reviewer');
    assert.ok(reviewer);

    const enriched = reviewer.applyToPrompt('Check this auth function');
    assert.ok(enriched.includes('[Role Directive:'));
    assert.ok(enriched.includes('Check this auth function'));
  });

  it('prepends slash command when configured', () => {
    const goal = BUILT_IN_PERSONAS.find(p => p.id === 'goal');
    assert.ok(goal);

    const enriched = goal.applyToPrompt('Implement user login system');
    assert.ok(enriched.startsWith('/goal '));
    assert.ok(enriched.includes('Implement user login system'));
  });

  it('preserves prompt when no directives are present', () => {
    const persona = new Persona({
      id: 'custom-1',
      name: 'Custom Minimal',
      icon: '⚡',
      description: 'Minimal persona'
    });

    const enriched = persona.applyToPrompt('Hello world');
    assert.strictEqual(enriched, 'Hello world');
  });
});
