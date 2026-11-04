// BackgroundTask expresses its minimum interval in minutes, unlike the former
// BackgroundFetch API. The OS chooses actual execution times.
export const HEALTH_BACKGROUND_INTERVAL_MINUTES = 15;

export async function runBackgroundHealthSync(
  getOwner: () => Promise<string | null>,
  sync: (owner: string) => Promise<unknown>,
): Promise<'success' | 'failed'> {
  try {
    const owner = await getOwner();
    if (owner) await sync(owner);
    // No connected owner or no changed measurements is a successful no-op.
    return 'success';
  } catch {
    return 'failed';
  }
}
