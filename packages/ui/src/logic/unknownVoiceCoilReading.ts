/** Explain a retained manufacturer Re/BL reading when it cannot safely be a simulation value. */
export function unknownVoiceCoilReading(device: unknown, key: 'Re_ohm' | 'BL_Tm'): string[] {
  if (!isRecord(device) || !isRecord(device.specs) || !isRecord(device.specs.woofer)) return [];
  const entry = device.specs.woofer[key];
  if (!isRecord(entry) || entry.state !== 'N' || !isRecord(entry.readings)) return [];

  const readings = Object.values(entry.readings)
    .filter(isRecord)
    .map(reading => reading.actual_reading)
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  const distinct = [...new Set(readings)];
  if (distinct.length === 0) return [];

  const reported = distinct.map(value => `“${value}”`).join(', ');
  return [`Manufacturer source reports ${key === 'Re_ohm' ? 'Re' : 'BL'} as ${reported}. `
    + 'The voice-coil count or basis is not specified, so this reading is retained for reference and not used in simulation.'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
