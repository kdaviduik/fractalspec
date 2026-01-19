import { describe, it, expect } from 'bun:test';
import { command } from './create';
import { STATUSES } from '../types';

describe('create command - status flag', () => {
  it('should provide help documentation with --status flag', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--status');
    expect(help?.flags).toBeDefined();

    const statusFlag = help?.flags?.find((f) => f.flag.includes('--status'));
    expect(statusFlag).toBeDefined();
    expect(statusFlag?.description).toContain('ready');
    expect(statusFlag?.description).toContain('blocked');
  });

  it('should include status examples in help documentation', () => {
    const help = command.getHelp?.();
    expect(help?.examples).toBeDefined();

    const examplesText = help?.examples?.join('\n') ?? '';
    expect(examplesText).toContain('--status');
    expect(examplesText).toContain('blocked');
  });

  it('should list all valid statuses in flag description', () => {
    const help = command.getHelp?.();
    const statusFlag = help?.flags?.find((f) => f.flag.includes('--status'));

    for (const status of STATUSES) {
      expect(statusFlag?.description).toContain(status);
    }
  });

  it('should mention status is settable at creation in help notes', () => {
    const help = command.getHelp?.();
    expect(help?.notes).toBeDefined();

    const notesText = help?.notes?.join('\n') ?? '';
    expect(notesText).toContain('status');
  });
});
