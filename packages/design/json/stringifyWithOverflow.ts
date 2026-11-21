/** Write signed overflow as JSON number literals, since JSON.stringify writes infinities as null. */
export function stringifyWithOverflow(
    value: unknown,
    options: {readonly replacer?: (key: string, value: unknown) => unknown; readonly indent?: number | undefined},
): string {
    const {replacer, indent} = options;
    let hasOverflow = false;
    const encode = (marker: string | null): string => JSON.stringify(value, (key, input: unknown) => {
        const output = replacer === undefined ? input : replacer(key, input);
        if (output !== Infinity && output !== -Infinity) return output;
        hasOverflow = true;
        return marker === null ? output : `${marker}${output > 0 ? '+' : '-'}`;
    }, indent);

    const text = encode(null);
    if (!hasOverflow) return text;
    // Pick a marker absent from all the original JSON keys and strings before substituting it.
    let marker = 'OpenISD numeric overflow';
    while (text.includes(marker)) marker += '_';
    return encode(marker).replaceAll(`"${marker}+"`, '1e999').replaceAll(`"${marker}-"`, '-1e999');
}
