import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PuzzleFrame } from '@ui/components/PuzzleFrame';

const ids = (r: ReactTestRenderer.ReactTestRenderer, prefix: string) =>
  r.root
    .findAll(
      n =>
        typeof n.type === 'string' &&
        typeof n.props.testID === 'string' &&
        n.props.testID.startsWith(prefix),
    )
    .map(n => n.props.testID as string);

const render = (element: React.ReactElement) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(element);
  });
  return r;
};

describe('PuzzleFrame', () => {
  it('shows earned pieces as the picture and the rest as numbered slots', () => {
    const r = render(<PuzzleFrame revealed={2} />);
    expect(ids(r, 'puzzle-piece-')).toEqual([
      'puzzle-piece-0',
      'puzzle-piece-1',
    ]);
    expect(ids(r, 'puzzle-empty-')).toEqual([
      'puzzle-empty-2',
      'puzzle-empty-3',
    ]);
    expect(JSON.stringify(r.toJSON())).toContain('2/4');
  });

  it('holds the coin prize in the last slot until the picture is complete', () => {
    const open = render(<PuzzleFrame revealed={3} />);
    expect(JSON.stringify(open.toJSON())).toContain('x150');
    const done = render(<PuzzleFrame revealed={4} />);
    expect(ids(done, 'puzzle-empty-')).toEqual([]);
    expect(JSON.stringify(done.toJSON())).not.toContain('x150');
  });

  it('keeps a just-earned piece as a numbered slot until the reveal flash, then shows it', () => {
    jest.useFakeTimers();
    const r = render(
      <PuzzleFrame revealed={1} playKey={1} revealDelayMs={100} />,
    );
    expect(ids(r, 'puzzle-piece-')).toEqual([]);
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(ids(r, 'puzzle-piece-')).toEqual(['puzzle-piece-0']);
    jest.useRealTimers();
  });

  it('shows a just-earned piece at once with no reveal playing', () => {
    const r = render(<PuzzleFrame revealed={1} playKey={0} />);
    expect(ids(r, 'puzzle-piece-')).toEqual(['puzzle-piece-0']);
  });
});
