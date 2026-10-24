type NamedExercise = { name: string };

export function mergeAndSortExercises<Predefined extends NamedExercise, Custom extends NamedExercise>(
    predefined: Predefined[],
    custom: Custom[]
): Array<Predefined | Custom> {
    return [...predefined, ...custom].sort((a, b) => a.name.localeCompare(b.name));
}
