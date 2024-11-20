export type EventDefinition<
  TEvent extends Record<string, unknown> = Record<string, unknown>
> = {
  id: string;
  name: string;
  description: string;
  cached?: undefined | false;
  manualMetadata?: TEvent;
}

export type EventSource = {
  id: string;
  name: string;
  events: Array<EventDefinition>;
};

export type EventManager = {
  registerEventSource: (
    eventSource: EventSource,
  ) => void;
  triggerEvent: <
    TEvent extends Record<string, unknown> = Record<string, unknown>
  > (
    sourceId: string,
    eventId: string,
    meta: TEvent,
    isManual?: boolean,
  ) => void;
};
