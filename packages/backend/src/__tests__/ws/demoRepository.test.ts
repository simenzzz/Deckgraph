import { describe, expect, it } from 'vitest';
import { DemoRepositoryError, parseDemoRepositories } from '../../ws/demoRepository.js';

function repo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deckgraph-fixture',
    label: 'Deckgraph Fixture',
    url: 'https://github.com/simenzzz/Deckgraph.git',
    description: 'A public demo repository.',
    ...overrides,
  };
}

describe('parseDemoRepositories', () => {
  it('validates configured repositories with the shared ready-message limits', () => {
    const repos = Array.from({ length: 21 }, (_, index) =>
      repo({ id: `repo-${index}`, label: `Repo ${index}` }),
    );

    expect(() => parseDemoRepositories(JSON.stringify(repos))).toThrow(DemoRepositoryError);
  });

  it('rejects repository fields that exceed shared schema limits', () => {
    expect(() =>
      parseDemoRepositories(JSON.stringify([repo({ label: 'a'.repeat(129) })])),
    ).toThrow(DemoRepositoryError);
  });

  it('keeps demo repositories restricted to GitHub clone URLs', () => {
    expect(() =>
      parseDemoRepositories(JSON.stringify([repo({ url: 'https://gitlab.com/acme/demo.git' })])),
    ).toThrow(DemoRepositoryError);
  });

  it('returns normalized configured repositories', () => {
    expect(parseDemoRepositories(JSON.stringify([repo({ label: ' Deckgraph Fixture ' })]))).toEqual([
      repo(),
    ]);
  });
});
