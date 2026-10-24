export declare const ENCRYPT = 1;
export declare const DECRYPT = 0;
export declare function desCrypt(input: Uint8Array, schedule: Uint8Array[]): Uint8Array;
export declare function keySchedule(key: Uint8Array, mode: number): Uint8Array[];
export declare function tripleDesKeySetup(key: Uint8Array, mode: number): Uint8Array[][];
export declare function tripleDesCrypt(data: Uint8Array, schedules: Uint8Array[][]): Uint8Array;
