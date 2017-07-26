export interface IAsteriskServer {

    managers: any;

    sendAction(param: { Action: string; Command: string }, bind: any): void;

    sendEventGeneratingAction(param: { Action: string; Command?: string }, bind: any): void;
}