import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { EffectsBoundary } from '@ui/animation/EffectsBoundary';

function Bomb(): React.ReactElement {
  throw new Error('animation exploded');
}

async function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
}

describe('EffectsBoundary', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    // React logs caught render errors; keep test output clean.
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => errorSpy.mockRestore());

  it('renders its children normally', async () => {
    const r = await render(
      <EffectsBoundary>
        <Text>fine</Text>
      </EffectsBoundary>,
    );
    expect(JSON.stringify(r.toJSON())).toContain('fine');
  });

  it('swallows a failing child, reports it, and renders nothing', async () => {
    const onError = jest.fn();
    const r = await render(
      <EffectsBoundary onError={onError}>
        <Bomb />
      </EffectsBoundary>,
    );
    expect(r.toJSON()).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe(
      'animation exploded',
    );
  });

  it('works without an onError handler', async () => {
    const r = await render(
      <EffectsBoundary>
        <Bomb />
      </EffectsBoundary>,
    );
    expect(r.toJSON()).toBeNull();
  });
});
