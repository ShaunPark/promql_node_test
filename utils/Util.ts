export const average = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;
export const percent = (child: number, parent: number) => ((child / parent) * 100).toFixed(2);
export const bytesToSize = (bytes: number): string => {
    if (bytes <= 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}