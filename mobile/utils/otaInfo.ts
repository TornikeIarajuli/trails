/** "Built in" for the update bundled with the APK, else the first characters of the update id. */
export function describeRunningUpdate(updateId: string | null | undefined, isEmbedded: boolean): string {
  if (isEmbedded || !updateId) return 'built-in';
  return updateId.slice(0, 8);
}
