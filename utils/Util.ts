export const average = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;
export const percent = (child: number, parent: number) => ((child / parent) * 100).toFixed(2);