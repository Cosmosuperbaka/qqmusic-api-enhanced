export declare const ENCRYPT = 1;
export declare const DECRYPT = 0;
export declare function desCrypt(inputData: Uint8Array, key: number[][]): Uint8Array;
export declare function keySchedule(key: Uint8Array, mode: number): number[][];
export declare function tripleDesKeySetup(key: Uint8Array, mode: number): number[][][];
export declare function tripleDesCrypt(data: Uint8Array, key: number[][][]): Uint8Array;
