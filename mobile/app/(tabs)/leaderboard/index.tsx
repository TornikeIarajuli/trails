import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { LeaderboardView } from '../../../components/leaderboard/LeaderboardView';
import { LEADERBOARD_HREF } from '../../../utils/feedSegment';

const MAX_REDIRECT_ATTEMPTS = 10;

/**
 * The leaderboard moved into the Feed tab ("Activity | Leaderboard"). This hidden tab
 * only keeps old links working: it sends them to the Feed with the Leaderboard segment
 * selected. It redirects once, on mount, and otherwise shows the leaderboard itself, so
 * stepping back onto it through tab history cannot bounce the user in a loop.
 */
export default function LeaderboardRedirect() {
  useEffect(() => {
    let frame: number | undefined;
    let attempts = 0;
    const redirect = () => {
      try {
        router.navigate(LEADERBOARD_HREF as any);
      } catch {
        // Opened by a link at app start, the navigator may not be ready on this frame yet.
        // If it never is, the leaderboard below is still shown.
        attempts += 1;
        if (attempts < MAX_REDIRECT_ATTEMPTS) frame = requestAnimationFrame(redirect);
      }
    };
    redirect();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return <LeaderboardView showTitle />;
}
