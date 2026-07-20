// File neeed by Ackee Analytics
declare global {
  interface AckeeRecordHandle {
    stop: () => void;
  }

  interface AckeeTracker {
    record: (
      domainId: string,
      attributes?: Record<string, unknown>,
    ) => AckeeRecordHandle;
  }

  interface Window {
    ackeeTracker?: AckeeTracker;
  }

  var ackeeTracker: AckeeTracker | undefined;
}

export {};
