import { useMemo, useLayoutEffect, useState, useRef } from 'react';

/**
 * Represents the measured dimensions of a card in both collapsed and expanded states
 */
export interface CardMeasurement {
  index: number;
  collapsedHeight: number;
  expandedHeight: number;
  isExpanded: boolean;
}

/**
 * Configuration options for card animations
 */
export interface AnimationConfig {
  duration: number; // milliseconds (300ms default)
  easing: string; // CSS easing function ('ease-in-out' default)
  useReducedMotion: boolean; // from prefers-reduced-motion
}

/**
 * Return type for the useCardAnimations hook
 */
export interface UseCardAnimationsReturn {
  cardRefs: React.RefObject<HTMLDivElement>[];
  positionOffsets: number[];
  registerCard: (index: number) => React.RefObject<HTMLDivElement>;
}

/**
 * Custom hook to manage card animations for expandable/collapsible cards
 * 
 * This hook handles:
 * - Creating and managing refs for all cards
 * - Measuring card heights after each render
 * - Calculating cumulative position offsets based on expanded cards
 * 
 * @param cardCount - The total number of cards to manage
 * @returns Object containing card refs, position offsets, and a register function
 */
export function useCardAnimations(cardCount: number): UseCardAnimationsReturn {
  // Create refs array for all cards - use useMemo to avoid recreating on every render
  const cardRefs = useMemo(() => {
    return Array.from({ length: cardCount }, () => ({ current: null as HTMLDivElement | null }));
  }, [cardCount]);

  // Use refs to store measurements — avoids triggering re-renders from the effect itself
  const cardMeasurementsRef = useRef<CardMeasurement[]>([]);

  // State to store position offsets for each card
  const [positionOffsets, setPositionOffsets] = useState<number[]>(() => Array(cardCount).fill(0));

  // Measure heights and calculate offsets after each render
  useLayoutEffect(() => {
    const measurements: CardMeasurement[] = [];
    const prevMeasurements = cardMeasurementsRef.current;

    for (let i = 0; i < cardCount; i++) {
      const cardElement = cardRefs[i]?.current;

      if (!cardElement) {
        measurements.push({ index: i, collapsedHeight: 0, expandedHeight: 0, isExpanded: false });
        continue;
      }

      const currentHeight = cardElement.offsetHeight;
      const hasExpandedContent = cardElement.querySelector('pre') !== null;
      const prev = prevMeasurements[i];

      measurements.push(hasExpandedContent
        ? { index: i, collapsedHeight: prev?.collapsedHeight ?? 0, expandedHeight: currentHeight, isExpanded: true }
        : { index: i, collapsedHeight: currentHeight, expandedHeight: prev?.expandedHeight ?? currentHeight, isExpanded: false }
      );
    }

    // Calculate cumulative offsets
    const offsets: number[] = [];
    for (let i = 0; i < cardCount; i++) {
      let offset = 0;
      for (let j = 0; j < i; j++) {
        if (measurements[j].isExpanded) {
          offset += measurements[j].expandedHeight - measurements[j].collapsedHeight;
        }
      }
      offsets.push(offset);
    }

    // Only update state if offsets actually changed — avoids infinite re-render loop
    const prevOffsets = positionOffsets;
    const offsetsChanged = offsets.length !== prevOffsets.length ||
      offsets.some((v, i) => v !== prevOffsets[i]);

    cardMeasurementsRef.current = measurements;

    if (offsetsChanged) {
      setPositionOffsets(offsets);
    }
  }); // Run after every render to handle animation interruptions (req 8.1-8.4)

  /**
   * Register a card at a specific index and return its ref
   * @param index - The index of the card to register
   * @returns The ref for the card at the specified index
   */
  const registerCard = (index: number): React.RefObject<HTMLDivElement> => {
    return cardRefs[index];
  };

  return {
    cardRefs: cardRefs,
    positionOffsets,
    registerCard,
  };
}
