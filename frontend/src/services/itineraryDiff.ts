// src/services/itineraryDiff.ts
// Diff computation for highlighting itinerary changes after edits

import { Itinerary, ItineraryBlock } from '@shared/types';
import { ItineraryDiff, DayDiff, BlockDiff, DiffType } from '../types/voice';

/**
 * Compare two itineraries and compute the diff
 */
export function computeItineraryDiff(
  oldItinerary: Itinerary | null,
  newItinerary: Itinerary | null
): ItineraryDiff {
  // If no old itinerary, everything is new
  if (!oldItinerary) {
    return {
      days: (newItinerary?.days || []).map((day, dayIndex) => ({
        dayIndex,
        dayName: day.name,
        blocks: day.blocks.map((block, blockIndex) => ({
          dayIndex,
          blockIndex,
          timeOfDay: block.timeOfDay,
          diffType: 'added' as DiffType,
          newValue: block.title
        })),
        totalChanges: day.blocks.length
      })),
      totalChanges: newItinerary?.days.reduce((sum, day) => sum + day.blocks.length, 0) || 0,
      summary: `Created new itinerary with ${newItinerary?.days.length || 0} days`
    };
  }

  // If no new itinerary, everything was removed
  if (!newItinerary) {
    return {
      days: (oldItinerary.days || []).map((day, dayIndex) => ({
        dayIndex,
        dayName: day.name,
        blocks: day.blocks.map((block, blockIndex) => ({
          dayIndex,
          blockIndex,
          timeOfDay: block.timeOfDay,
          diffType: 'removed' as DiffType,
          oldValue: block.title
        })),
        totalChanges: day.blocks.length
      })),
      totalChanges: oldItinerary.days.reduce((sum, day) => sum + day.blocks.length, 0) || 0,
      summary: 'Itinerary was cleared'
    };
  }

  // Compare day by day
  const dayDiffs: DayDiff[] = [];
  let totalChanges = 0;

  const maxDays = Math.max(oldItinerary.days.length, newItinerary.days.length);

  for (let dayIndex = 0; dayIndex < maxDays; dayIndex++) {
    const oldDay = oldItinerary.days[dayIndex];
    const newDay = newItinerary.days[dayIndex];

    if (!oldDay && newDay) {
      // New day added
      const blocks = newDay.blocks.map((block, blockIndex) => ({
        dayIndex,
        blockIndex,
        timeOfDay: block.timeOfDay,
        diffType: 'added' as DiffType,
        newValue: block.title
      }));

      dayDiffs.push({
        dayIndex,
        dayName: newDay.name,
        blocks,
        totalChanges: blocks.length
      });
      totalChanges += blocks.length;
    } else if (oldDay && !newDay) {
      // Day removed
      const blocks = oldDay.blocks.map((block, blockIndex) => ({
        dayIndex,
        blockIndex,
        timeOfDay: block.timeOfDay,
        diffType: 'removed' as DiffType,
        oldValue: block.title
      }));

      dayDiffs.push({
        dayIndex,
        dayName: oldDay.name,
        blocks,
        totalChanges: blocks.length
      });
      totalChanges += blocks.length;
    } else if (oldDay && newDay) {
      // Compare blocks within the day
      const blockDiffs = compareBlocks(oldDay.blocks, newDay.blocks, dayIndex);
      const changesInDay = blockDiffs.filter(b => b.diffType !== 'unchanged').length;

      if (changesInDay > 0) {
        dayDiffs.push({
          dayIndex,
          dayName: newDay.name,
          blocks: blockDiffs,
          totalChanges: changesInDay
        });
        totalChanges += changesInDay;
      }
    }
  }

  // Generate summary
  let summary = '';
  if (totalChanges === 0) {
    summary = 'No changes made';
  } else {
    const added = dayDiffs.flatMap(d => d.blocks).filter(b => b.diffType === 'added').length;
    const removed = dayDiffs.flatMap(d => d.blocks).filter(b => b.diffType === 'removed').length;
    const modified = dayDiffs.flatMap(d => d.blocks).filter(b => b.diffType === 'modified').length;

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (removed > 0) parts.push(`${removed} removed`);
    if (modified > 0) parts.push(`${modified} modified`);

    summary = `Updated: ${parts.join(', ')}`;
  }

  return {
    days: dayDiffs,
    totalChanges,
    summary
  };
}

/**
 * Compare blocks within a day
 */
function compareBlocks(
  oldBlocks: ItineraryBlock[],
  newBlocks: ItineraryBlock[],
  dayIndex: number
): BlockDiff[] {
  const diffs: BlockDiff[] = [];
  const maxBlocks = Math.max(oldBlocks.length, newBlocks.length);

  for (let blockIndex = 0; blockIndex < maxBlocks; blockIndex++) {
    const oldBlock = oldBlocks[blockIndex];
    const newBlock = newBlocks[blockIndex];

    if (!oldBlock && newBlock) {
      // Block added
      diffs.push({
        dayIndex,
        blockIndex,
        timeOfDay: newBlock.timeOfDay,
        diffType: 'added',
        newValue: newBlock.title
      });
    } else if (oldBlock && !newBlock) {
      // Block removed
      diffs.push({
        dayIndex,
        blockIndex,
        timeOfDay: oldBlock.timeOfDay,
        diffType: 'removed',
        oldValue: oldBlock.title
      });
    } else if (oldBlock && newBlock) {
      // Compare titles and notes
      const titleChanged = oldBlock.title !== newBlock.title;
      const notesChanged = JSON.stringify(oldBlock.notes) !== JSON.stringify(newBlock.notes);

      if (titleChanged || notesChanged) {
        diffs.push({
          dayIndex,
          blockIndex,
          timeOfDay: newBlock.timeOfDay,
          diffType: 'modified',
          oldValue: oldBlock.title,
          newValue: newBlock.title
        });
      } else {
        diffs.push({
          dayIndex,
          blockIndex,
          timeOfDay: newBlock.timeOfDay,
          diffType: 'unchanged',
          oldValue: oldBlock.title,
          newValue: newBlock.title
        });
      }
    }
  }

  return diffs;
}

/**
 * Get blocks that changed for a specific day
 */
export function getChangedBlocksForDay(
  diff: ItineraryDiff,
  dayIndex: number
): BlockDiff[] {
  const dayDiff = diff.days.find(d => d.dayIndex === dayIndex);
  return dayDiff?.blocks.filter(b => b.diffType !== 'unchanged') || [];
}

/**
 * Check if a specific block has changed
 */
export function hasBlockChanged(
  diff: ItineraryDiff,
  dayIndex: number,
  blockIndex: number
): boolean {
  const changedBlocks = getChangedBlocksForDay(diff, dayIndex);
  return changedBlocks.some(b => b.blockIndex === blockIndex);
}

/**
 * Get the type of change for a block
 */
export function getBlockDiffType(
  diff: ItineraryDiff,
  dayIndex: number,
  blockIndex: number
): DiffType | null {
  const dayDiff = diff.days.find(d => d.dayIndex === dayIndex);
  const block = dayDiff?.blocks.find(b => b.blockIndex === blockIndex);
  return block?.diffType || null;
}

/**
 * Format diff for display in UI
 */
export function formatDiffForDisplay(diff: ItineraryDiff): string[] {
  const lines: string[] = [];

  if (diff.totalChanges === 0) {
    return ['No changes'];
  }

  for (const dayDiff of diff.days) {
    if (dayDiff.totalChanges === 0) continue;

    lines.push(`Day ${dayDiff.dayIndex + 1}:`);

    for (const block of dayDiff.blocks) {
      if (block.diffType === 'unchanged') continue;

      const emoji = block.diffType === 'added' ? '➕' :
                   block.diffType === 'removed' ? '➖' : '✏️';

      if (block.diffType === 'added') {
        lines.push(`  ${emoji} Added: ${block.newValue} (${block.timeOfDay})`);
      } else if (block.diffType === 'removed') {
        lines.push(`  ${emoji} Removed: ${block.oldValue} (${block.timeOfDay})`);
      } else {
        lines.push(`  ${emoji} Changed: ${block.oldValue} → ${block.newValue} (${block.timeOfDay})`);
      }
    }
  }

  return lines;
}

/**
 * Create a simple diff between two sessions (used for quick comparison)
 */
export function createSimpleDiff(
  oldSession: any,
  newSession: any
): { modified: string[]; added: string[]; removed: string[] } {
  const result = {
    modified: [] as string[],
    added: [] as string[],
    removed: [] as string[]
  };

  // Compare constraints
  if (oldSession?.constraints?.city !== newSession?.constraints?.city) {
    result.modified.push('city');
  }
  if (oldSession?.constraints?.numDays !== newSession?.constraints?.numDays) {
    result.modified.push('numDays');
  }

  // Compare itinerary days
  const oldDays = oldSession?.itinerary?.days?.length || 0;
  const newDays = newSession?.itinerary?.days?.length || 0;

  if (oldDays !== newDays) {
    if (newDays > oldDays) {
      result.added.push(`${newDays - oldDays} days`);
    } else {
      result.removed.push(`${oldDays - newDays} days`);
    }
  }

  return result;
}
