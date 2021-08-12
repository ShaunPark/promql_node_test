export const average = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;
export const percent = (child: number, parent: number) => ((child / parent) * 100).toFixed(2);
export const bytesToSize = (bytes: number): string => {
    if (bytes <= 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}
export const betweenTimes = (target: Date, from: Date, to: Date): boolean =>{
    const stTime = new Date(target)
    stTime.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), 0)
    const edTime = new Date(target)
    edTime.setHours(to.getHours(), to.getMinutes(), to.getSeconds(), 0)

    return stTime.getTime() < target.getTime() && edTime.getTime() > target.getTime()
}

export function parseTimeStr(str: string): Date {
    const tempDt = new Date("2021-07-20T" + str.trim())
    const dt = new Date()
    dt.setHours(tempDt.getHours(), tempDt.getMinutes(), 0, 0)
    return dt
}

export function timeStrToDate(timeStr: string, def: string): Date {
    try {
        return parseTimeStr(timeStr)
    } catch (err) {
        return parseTimeStr(def)
    }
}